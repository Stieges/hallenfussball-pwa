/**
 * A-08f3b (Plan `task-A-08f3-plan.md` v4, Paket b) + offene Punkte aus `task-A-08f3a-review.md`:
 * frisch lesen, ein Abruf je Turnier, Revisionen je Spiel in der lokalen Kopie (Versionsweg, erster Cloud-Weg,
 * zwei Tabs), Ablage leeren beim Löschen und Neugenerieren.
 * Anforderungen: @FU-087, @FU-001, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament, Match } from '../../models/types';

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

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { createMockMatch, createMockTournament } from '../../../test/factories';

type Score = Partial<Match>;
const RUNNING = (a: number): Score => ({ scoreA: a, scoreB: 0, matchStatus: 'running' });

function tournament(version: number, m1: Score, ids: string[] = ['m1', 'm2']): Tournament {
  const matches = ids.map((id) => createMockMatch({ id, matchStatus: 'scheduled', ...(id === 'm1' ? m1 : {}) }));
  return createMockTournament({ id: 'T', ownerId: 'olli', version, matches });
}

const revs = (m1: number) => new Map([['m1', m1], ['m2', 1]]);
const state = (version: number, m1: Score, rev: number) => ({ tournament: tournament(version, m1), revisions: revs(rev) });

function storedM1(): Match | undefined {
  return (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === 'T')?.matches.find((m) => m.id === 'm1');
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('A-08f3b frisch lesen, ein Abruf je Turnier, Revisionen in der lokalen Kopie', () => {
  const created: OfflineRepository[] = [];

  function repoFor(cloud: ReturnType<typeof createFakeCloud>): OfflineRepository {
    const repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    created.push(repo);
    return repo;
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('navigator', { onLine: true });
    stores.raw.clear();
    stores.queue.clear();
    stores.raw.set('tournaments', [tournament(7, {})]);
  });

  afterEach(() => {
    created.splice(0).forEach((repo) => repo.mutationQueue.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('@FU-087 fresh: wartet, führt zusammen und liefert 1:0 – lokale Version bleibt', async () => {
    const repo = repoFor(createFakeCloud(state(7, RUNNING(1), 3)));

    const got = await repo.get('T', { fresh: true });

    expect(got?.matches.find((m) => m.id === 'm1')).toMatchObject(RUNNING(1));
    expect(got?.version).toBe(7);
  });

  it('Gegenbeispiel: Cloud wirft → fresh liefert die lokale Kopie', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(1), 3));
    cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('netz weg'));
    const repo = repoFor(cloud);

    const got = await repo.get('T', { fresh: true });

    expect(got?.matches.find((m) => m.id === 'm1')?.matchStatus).toBe('scheduled');
  });

  it('Gegenbeispiel: hängende Cloud → erstes Laden liefert sofort die lokale Kopie', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(1), 3));
    cloud.holdNextRead();
    const repo = repoFor(cloud);

    const got = await repo.get('T');

    expect(got?.matches.find((m) => m.id === 'm1')?.matchStatus).toBe('scheduled');
  });

  it('ein Abruf je Turnier: fresh während eines Hintergrund-Abrufs → höchstens ein Folgeabruf, fresh sieht das Ergebnis', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(1), 3));
    const slow = cloud.holdNextRead();
    const repo = repoFor(cloud);

    await repo.get('T');
    const fresh = repo.get('T', { fresh: true });
    slow.release();

    expect((await fresh)?.matches.find((m) => m.id === 'm1')).toMatchObject(RUNNING(1));
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(2); // A-08f3b-F F1: Nachzügler
  });

  it('Versionsweg pflegt die Revisionen: danach rückt ein älterer Stand (Revision 5) nicht nach', async () => {
    const cloud = createFakeCloud(state(8, RUNNING(2), 6));
    const repo = repoFor(cloud);
    await repo.get('T', { fresh: true });
    expect(storedM1()).toMatchObject(RUNNING(2));

    cloud.setState(state(8, RUNNING(1), 5));
    await repo.get('T', { fresh: true });

    expect(storedM1()).toMatchObject(RUNNING(2));
  });

  it('erster Cloud-Weg (keine lokale Kopie) liest mit Revisionen: Spiel gilt als server-geführt, älterer Stand rückt nicht nach', async () => {
    stores.raw.set('tournaments', []);
    const cloud = createFakeCloud(state(7, RUNNING(2), 6));
    const repo = repoFor(cloud);

    expect((await repo.get('T'))?.matches.find((m) => m.id === 'm1')).toMatchObject(RUNNING(2));
    await flush();
    expect(repo.serverLedMatchIds('T')).toEqual(new Set(['m1']));

    cloud.setState(state(7, RUNNING(1), 5));
    await repo.get('T', { fresh: true });
    expect(storedM1()).toMatchObject(RUNNING(2));
  });

  it('zwei Tabs: Tab B bekommt den älteren Stand (Revision 5) nach Tab A (Revision 6) → bleibt Revision 6', async () => {
    const tabA = repoFor(createFakeCloud(state(7, RUNNING(2), 6)));
    const tabB = repoFor(createFakeCloud(state(7, RUNNING(1), 5)));

    await tabA.get('T', { fresh: true });
    await tabB.get('T', { fresh: true });

    expect(storedM1()).toMatchObject(RUNNING(2));
  });

  it('Löschen leert die Ablage: neu angelegtes Turnier übernimmt danach Revision 2', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(2), 6));
    const repo = repoFor(cloud);
    await repo.get('T', { fresh: true });

    await repo.delete('T');
    expect(repo.serverLedMatchIds('T').size).toBe(0);
    stores.raw.set('tournaments', [tournament(7, {})]);
    cloud.setState(state(7, RUNNING(1), 2));
    await repo.get('T', { fresh: true });

    expect(storedM1()).toMatchObject(RUNNING(1));
  });

  it('Neugenerieren (Speichern mit neuen Spielen) leert die Ablage der alten Spiele; Speichern ohne neue Spiele nicht', async () => {
    const repo = repoFor(createFakeCloud(state(7, RUNNING(2), 6)));
    await repo.get('T', { fresh: true });

    await repo.save(tournament(7, {}, ['m1', 'm2']));
    expect(repo.serverLedMatchIds('T')).toEqual(new Set(['m1']));
    expect(stores.raw.get('serverRevisions-T')).toMatchObject({ m1: 6 });

    await repo.save(tournament(7, {}, ['n1', 'n2']));
    expect(repo.serverLedMatchIds('T').size).toBe(0);
    expect(stores.raw.get('serverRevisions-T')).not.toHaveProperty('m1');
  });
});
