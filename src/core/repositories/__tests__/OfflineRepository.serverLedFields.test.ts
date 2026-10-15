/**
 * A-08f3a (Plan `task-A-08f3-plan.md` v3, Paket a): Spielstand aus der Cloud – Feldweg (Regel S Stufe 1),
 * Monotonie je Spiel, Schreibkette im lokalen Speicher.
 *
 * Anforderungen (`docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * @FU-087 (Spielplan zeigt fremde Einträge), @FU-023 (jedes Gerät zeigt den Stand der Einträge).
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Storage, Fake-Cloud (wie Probe 1.2 der Analyse).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament, Match } from '../../models/types';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const net = vi.hoisted(() => ({ online: true }));
const stores = vi.hoisted(() => ({
  raw: new Map<string, unknown>(),
  queue: new Map<string, string>(),
}));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => {
        stores.raw.set(key, structuredClone(value));
        return Promise.resolve();
      },
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
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: session.userId ? { user: { id: session.userId } } : null }, error: null })),
    },
  },
}));

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { createMockMatch, createMockTournament } from '../../../test/factories';

const UPDATED_AT = '2026-10-15T08:00:00.000Z';
const KICKOFF_OLD = '1970-01-01T14:30:00.000Z';
const KICKOFF_NEW = '1970-01-01T14:40:00.000Z';

function match(id: string, extra: Partial<Match> = {}): Match {
  return createMockMatch({ id, matchStatus: 'scheduled', ...extra });
}

function tournament(version: number, matches: Match[]): Tournament {
  return createMockTournament({ id: 'T', ownerId: 'olli', version, updatedAt: UPDATED_AT, matches });
}

/** Lokal v7: m1 geplant (Uhr lokal 10 s), m2 2:1 beendet und m3 übersprungen aus dem Altpfad (ohne Einträge). */
function localV7(): Tournament {
  return tournament(7, [
    match('m1', { timerElapsedSeconds: 10 }),
    match('m2', { scoreA: 2, scoreB: 1, matchStatus: 'finished' }),
    match('m3', { matchStatus: 'skipped', skippedReason: 'Team fehlt', skippedAt: '2026-10-15T09:00:00.000Z' }),
  ]);
}

/** Cloud v7: m1 läuft 1:0 (Revision 3, Uhr der Engine), m2/m3 ohne Einträge (Revision 1). */
function cloudV7(m1: Partial<Match> = { scoreA: 1, scoreB: 0, matchStatus: 'running' }): Tournament {
  return tournament(7, [
    match('m1', { ...m1, timerElapsedSeconds: 99, timerStartTime: '2026-10-15T10:00:00.000Z' }),
    match('m2'),
    match('m3'),
  ]);
}

function revisions(m1: number): Map<string, number> {
  return new Map([['m1', m1], ['m2', 1], ['m3', 1]]);
}

function stored(): Tournament {
  const list = stores.raw.get('tournaments') as Tournament[];
  const found = list.find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}

function storedMatch(id: string): Match {
  const found = stored().matches.find((m) => m.id === id);
  if (!found) { throw new Error(`Spiel ${id} fehlt`); }
  return found;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('A-08f3a Feldweg: Spielstand aus der Cloud beim Eigentümer (@FU-087, @FU-023)', () => {
  let repo: OfflineRepository | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = 'olli';
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
    stores.raw.set('tournaments', [localV7()]);
  });

  afterEach(() => {
    repo?.mutationQueue.dispose();
    repo = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setup(cloudState = { tournament: cloudV7(), revisions: revisions(3) }) {
    const cloud = createFakeCloud(cloudState);
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    return { cloud, repo };
  }

  it('@FU-087 Pflichttest: gleiche Version, fremdes 1:0 (Revision 3) wird übernommen – Version und updatedAt bleiben', async () => {
    const { repo: r } = setup();

    const first = await r.get('T');
    expect(first?.matches.find((m) => m.id === 'm1')?.matchStatus).toBe('scheduled');
    await flush();

    expect(storedMatch('m1')).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    expect(stored().version).toBe(7);
    expect(stored().updatedAt).toBe(UPDATED_AT);
    expect(stored().ownerId).toBe('olli');
    const second = await r.get('T');
    expect(second?.matches.find((m) => m.id === 'm1')).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
  });

  it('Gegenbeispiel (i): Altpfad-Ergebnis m2 2:1 und übersprungenes m3 bleiben bei Revision 1', async () => {
    const { repo: r } = setup();

    await r.get('T');
    await flush();

    expect(storedMatch('m2')).toMatchObject({ scoreA: 2, scoreB: 1, matchStatus: 'finished' });
    expect(storedMatch('m3')).toMatchObject({ matchStatus: 'skipped', skippedReason: 'Team fehlt' });
  });

  it('Gegenbeispiel (ii): wartende eigene Änderung der Anstoßzeit bleibt, Version 8', async () => {
    const { repo: r } = setup();
    net.online = false;
    await r.updateMatches('T', [{ id: 'm1', scheduledTime: new Date(KICKOFF_NEW) }]);
    expect(stored().version).toBe(8);

    await r.get('T');
    await flush();

    expect(storedMatch('m1')).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    expect(new Date(storedMatch('m1').scheduledTime ?? KICKOFF_OLD).toISOString()).toBe(KICKOFF_NEW);
    expect(stored().version).toBe(8);
  });

  it('Gegenbeispiel (iii): Uhrfelder der lokalen Kopie bleiben (die Uhr gehört der Engine)', async () => {
    const { repo: r } = setup();

    await r.get('T');
    await flush();

    expect(storedMatch('m1').timerElapsedSeconds).toBe(10);
    expect(storedMatch('m1').timerStartTime).toBeUndefined();
  });

  it('Gegenbeispiel (v) Monotonie: Revision 5 wird nach Revision 6 ausgewertet → Endstand Revision 6', async () => {
    // A-08f3b: ein Abruf je Turnier – ein älterer Stand kommt nur noch nacheinander an (z. B. verzögerte Replik).
    const { cloud, repo: r } = setup({ tournament: cloudV7({ scoreA: 2, scoreB: 0, matchStatus: 'running' }), revisions: revisions(6) });

    await r.get('T');
    await flush();
    expect(storedMatch('m1').scoreA).toBe(2);
    cloud.setState({ tournament: cloudV7({ scoreA: 1, scoreB: 0, matchStatus: 'running' }), revisions: revisions(5) });
    await r.get('T');
    await flush();

    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(2);
    expect(storedMatch('m1')).toMatchObject({ scoreA: 2, scoreB: 0 });
  });
});
