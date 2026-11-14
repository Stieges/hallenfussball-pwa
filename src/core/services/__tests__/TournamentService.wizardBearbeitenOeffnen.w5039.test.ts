/**
 * Befund C-BEARBEITEN-SPEICHERT-VERALTETE-KOPIE -- @W5-039 (docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md), Weg
 * „Im Wizard bearbeiten“ in den Einstellungen der Verwaltung: Der Einstieg speichert nichts; der Assistent lädt das Turnier selbst
 * frisch (`useWizardTournament` -> `repository.get(id, { fresh: true })`). Echtes `OfflineRepository`, nur der Server ist ein Fake.
 * Mutation: in App.tsx `handleEditInWizard` den Aufruf `saveTournament(tournament)` zurückholen -> App.wizardBearbeitenOeffnen.w5039.test.tsx rot.
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



describe('@W5-039 „Im Wizard bearbeiten“ (Einstellungen) öffnet den Assistenten mit dem Stand des Servers und schreibt nichts', () => {
  const created: OfflineRepository[] = [];

  function open(cloud: ReturnType<typeof createFakeCloud>): { repo: OfflineRepository; service: TournamentService } {
    const repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    created.push(repo);
    return { repo, service: new TournamentService(repo) };
  }

  /** Der Assistent lädt wie `useWizardTournament`, danach vergehen die 15 Sekunden ohne Eingabe. */
  async function openWizard(repo: OfflineRepository): Promise<Tournament | null> {
    const loaded = await repo.get('T', { fresh: true });
    await vi.advanceTimersByTimeAsync(15_000);
    await flush();
    return loaded;
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

  it('ältere Kopie als der Server: der Assistent zeigt 6 Teams und 15 Spiele des Servers, nichts wird geschrieben', async () => {
    stores.raw.set('tournaments', [staleLocal()]);
    const cloud = createFakeCloud({ tournament: server(2, fifteenMatches()), revisions: new Map() });
    const { repo } = open(cloud);

    const shown = await openWizard(repo);

    expect(shown?.teams).toHaveLength(6);
    expect(shown?.matches).toHaveLength(15);
    expectNothingWritten(cloud, repo);
  });

  it('eine Kopie ohne wartende Änderung (gleicher Stand wie der Server): nichts wird geschrieben, Zeitpunkt der letzten Änderung unverändert', async () => {
    const same = server(2, fifteenMatches());
    stores.raw.set('tournaments', [same]);
    const cloud = createFakeCloud({ tournament: server(2, fifteenMatches()), revisions: new Map() });
    const { repo } = open(cloud);

    const shown = await openWizard(repo);

    expect(shown?.teams).toHaveLength(6);
    expect(shown?.matches).toHaveLength(15);
    expect(shown?.updatedAt).toBe(same.updatedAt);
    expectNothingWritten(cloud, repo);
  });

  it('Gegenbeispiel: eine echte Änderung im Assistenten (Team umbenennen) wird weiter gespeichert', async () => {
    stores.raw.set('tournaments', [staleLocal()]);
    const cloud = createFakeCloud({ tournament: server(2, fifteenMatches()), revisions: new Map() });
    const { repo, service } = open(cloud);
    const shown = await openWizard(repo);
    expectNothingWritten(cloud, repo);

    await service.updateTournament({ ...shown!, teams: shown!.teams.map((t, i) => (i === 0 ? { ...t, name: 'Umbenannt' } : t)) });
    await flush();
    await vi.advanceTimersByTimeAsync(1000);
    await flush();

    expect(cloud.fake.save).toHaveBeenCalledTimes(1);
    expect(cloud.fake.save.mock.calls[0][0].teams[0].name).toBe('Umbenannt');
    expect(repo.mutationQueue.getFailedCount()).toBe(0);
  });
});
