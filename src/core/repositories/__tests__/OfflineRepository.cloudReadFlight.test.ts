/**
 * A-08f3b-F (Review `task-A-08f3b-review.md` F1, F2): ein Abruf je Turnier MIT Nachzügler und mit Zeitlimit.
 * F1: Ein frisches Lesen während eines laufenden Abrufs löst danach genau einen weiteren Abruf aus (Push während
 * des Abrufs → 2:0, nicht 1:0; @FU-087 bei offenem Kanal). F2: Ein hängender Abruf blockiert nicht – nach dem
 * Zeitlimit kommt die lokale Kopie, der nächste Abruf startet neu.
 * Anforderungen: @FU-087, @FU-001 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
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
import { CLOUD_READ_TIMEOUT_MS } from '../cloudAdoption';

type Score = Partial<Match>;
const RUNNING = (a: number): Score => ({ scoreA: a, scoreB: 0, matchStatus: 'running' });

function tournament(version: number, m1: Score, ids: string[] = ['m1', 'm2']): Tournament {
  const matches = ids.map((id) => createMockMatch({ id, matchStatus: 'scheduled', ...(id === 'm1' ? m1 : {}) }));
  return createMockTournament({ id: 'T', ownerId: 'olli', version, matches });
}

const revs = (m1: number) => new Map([['m1', m1], ['m2', 1]]);
const state = (version: number, m1: Score, rev: number) => ({ tournament: tournament(version, m1), revisions: revs(rev) });

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('A-08f3b-F Cloud-Abruf: Nachzügler und Zeitlimit', () => {
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

  it('F1 Pflicht: Push während des laufenden Abrufs → genau ein Folgeabruf, fresh liefert 2:0', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(1), 3));
    const slow = cloud.holdNextRead();
    const repo = repoFor(cloud);

    await repo.get('T'); // erstes Laden: Abruf (1:0) läuft noch
    cloud.setState(state(7, RUNNING(2), 4)); // Push: das 2:0 ist am Server
    const fresh = repo.get('T', { fresh: true });
    slow.release();

    expect((await fresh)?.matches.find((m) => m.id === 'm1')).toMatchObject(RUNNING(2));
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: zwei Hintergrund-Ladevorgänge gleichzeitig → ein Abruf (kein Nachzügler ohne fresh)', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(1), 3));
    const slow = cloud.holdNextRead();
    const repo = repoFor(cloud);

    await repo.get('T');
    await repo.get('T');
    slow.release();
    await flush();

    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(1);
  });

  it('F2: hängender Abruf → fresh liefert nach dem Zeitlimit die lokale Kopie, der nächste Abruf startet neu', async () => {
    const cloud = createFakeCloud(state(7, RUNNING(1), 3));
    cloud.holdNextRead(); // hängt dauerhaft
    const repo = repoFor(cloud);

    const fresh = repo.get('T', { fresh: true });
    await vi.advanceTimersByTimeAsync(CLOUD_READ_TIMEOUT_MS);
    expect((await fresh)?.matches.find((m) => m.id === 'm1')?.matchStatus).toBe('scheduled');

    const next = await repo.get('T', { fresh: true });
    expect(next?.matches.find((m) => m.id === 'm1')).toMatchObject(RUNNING(1));
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(2);
  });
});
