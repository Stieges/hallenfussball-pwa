/**
 * Befund C-VERWALTUNG-OEFFNEN-ERZEUGT-SPIELPLAN (Ursachensuche 13.11.): Die Verwaltung erzeugte beim Laden einer Kopie ohne Spiele
 * einen Spielplan und speicherte ihn ganz (PATCH tournaments + POST teams), ohne dass jemand etwas eingegeben hatte.
 * Szenario: docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md -- @W5-042 (Öffnen der Verwaltung ändert nichts am Server und
 * erzeugt keinen Spielplan). Echtes `OfflineRepository` + `TournamentService`, nur der Server ist ein Fake mit Versionsprüfung.
 */
import 'fake-indexeddb/auto'; // die Warteschlange prüft vor dem Senden die lokalen Engine-Einträge; ohne sie scheitert jedes Senden und „nichts gesendet“ wäre leer
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Match, Tournament } from '../../models/types';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'olli' } } }, error: null })) } },
}));

import { OfflineRepository } from '../../repositories/OfflineRepository';
import { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import { TournamentService } from '../TournamentService';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { createMockMatch, createMockTeams, createMockTournament } from '../../../test/factories';

const TEAMS = createMockTeams(6);

/** 15 Spiele: jeder gegen jeden bei 6 Teams. */
function fifteenMatches(): Match[] {
  const matches: Match[] = [];
  for (let a = 0; a < TEAMS.length; a++) {
    for (let b = a + 1; b < TEAMS.length; b++) {
      matches.push(createMockMatch({ id: `m${matches.length + 1}`, teamA: TEAMS[a].id, teamB: TEAMS[b].id, matchStatus: 'scheduled' }));
    }
  }
  return matches;
}

const server = (version: number, matches: Match[]): Tournament =>
  createMockTournament({ id: 'T', ownerId: 'olli', version, serverVersion: version, status: 'published', teams: TEAMS, matches });

/** Ältere lokale Kopie: noch Entwurf, gleiche Teams, KEINE Spiele, keine wartende Änderung. */
const staleLocal = (): Tournament =>
  createMockTournament({ id: 'T', ownerId: 'olli', version: 1, serverVersion: 1, status: 'draft', teams: TEAMS, matches: [] });

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('@W5-042 Das Öffnen der Verwaltung ändert nichts am Server und erzeugt keinen Spielplan', () => {
  const created: OfflineRepository[] = [];

  function open(cloud: ReturnType<typeof createFakeCloud>): { repo: OfflineRepository; service: TournamentService } {
    const repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    created.push(repo);
    return { repo, service: new TournamentService(repo) };
  }

  /** Das Öffnen der Verwaltung wie `useTournamentManager`: erst local-first, dann das frische Lesen (die 15 Sekunden darauf). */
  async function openManagement(service: TournamentService): Promise<{ first: Tournament | null; shown: Tournament | null }> {
    const first = await service.loadTournament('T');
    await flush();
    const shown = await service.loadTournament('T', { fresh: true });
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    return { first, shown };
  }

  function expectNothingWritten(cloud: ReturnType<typeof createFakeCloud>, repo: OfflineRepository): void {
    expect(cloud.fake.save).not.toHaveBeenCalled();
    expect(cloud.fake.updateMatches).not.toHaveBeenCalled();
    expect(cloud.fake.updateTournamentMetadata).not.toHaveBeenCalled();
    expect(repo.mutationQueue.getPendingCount()).toBe(0);
    expect(repo.mutationQueue.getFailedCount()).toBe(0); // keine abgelehnte Änderung
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('navigator', { onLine: true });
    stores.raw.clear();
    stores.queue.clear();
  });

  afterEach(() => {
    created.splice(0).forEach((repo) => repo.mutationQueue.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('Server mit 6 Teams und 15 Spielen, lokal eine ältere Kopie ohne Spiele: kein Schreibauftrag, die Verwaltung zeigt den Stand des Servers', async () => {
    stores.raw.set('tournaments', [staleLocal()]);
    const cloud = createFakeCloud({ tournament: server(2, fifteenMatches()), revisions: new Map() });
    const { repo, service } = open(cloud);

    const { first, shown } = await openManagement(service);

    expect(first?.matches).toHaveLength(0); // local-first: erst die alte Kopie, hier wird nichts erzeugt
    expect(shown?.teams).toHaveLength(6);
    expect(shown?.matches).toHaveLength(15);
    expectNothingWritten(cloud, repo);
    const stored = (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T');
    expect(stored?.matches).toHaveLength(15); // auch die lokale Kopie trägt jetzt den Stand des Servers
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalled();
  });

  it('Turnier hat wirklich keine Spiele (Entwurf): kein Speichern, kein erzeugter Plan (die Anzeige weist auf den Wizard hin)', async () => {
    stores.raw.set('tournaments', [staleLocal()]);
    const cloud = createFakeCloud({ tournament: createMockTournament({ id: 'T', ownerId: 'olli', version: 1, serverVersion: 1, status: 'draft', teams: TEAMS, matches: [] }), revisions: new Map() });
    const { repo, service } = open(cloud);

    const { first, shown } = await openManagement(service);

    expect(first?.matches).toEqual([]);
    expect(shown?.matches).toEqual([]);
    expectNothingWritten(cloud, repo);
  });

  it('Gegenbeispiel: eine echte Änderung in der Verwaltung (Team umbenennen) wird weiter gespeichert', async () => {
    stores.raw.set('tournaments', [server(2, fifteenMatches())]);
    const cloud = createFakeCloud({ tournament: server(2, fifteenMatches()), revisions: new Map() });
    const { repo, service } = open(cloud);
    const { shown } = await openManagement(service);
    expectNothingWritten(cloud, repo);

    const renamed = { ...shown!, teams: shown!.teams.map((t, i) => (i === 0 ? { ...t, name: 'Umbenannt' } : t)) };
    await service.updateTournament(renamed);
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(cloud.fake.save).toHaveBeenCalledTimes(1);
    expect(cloud.fake.save.mock.calls[0][0].teams[0].name).toBe('Umbenannt');
    expect(repo.mutationQueue.getFailedCount()).toBe(0);
  });
});
