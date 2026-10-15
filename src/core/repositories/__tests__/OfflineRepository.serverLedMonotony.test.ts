/**
 * A-08f3a-F (Review `task-A-08f3a-review.md` F1, F3): Feldweg ohne Schein-Änderung bei NULL aus der Cloud und
 * Monotonie-Ablage als Vereinigung (ein veralteter Abruf ohne Übernahme leert sie nicht).
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
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

function tournament(m1: Partial<Match>): Tournament {
  const matches = [createMockMatch({ id: 'm1', matchStatus: 'scheduled', ...m1 }), createMockMatch({ id: 'm2', matchStatus: 'scheduled' })];
  return createMockTournament({ id: 'T', ownerId: 'olli', version: 7, updatedAt: UPDATED_AT, matches });
}

function revisions(m1: number): Map<string, number> {
  return new Map([['m1', m1], ['m2', 1]]);
}

function storedM1(): Match | undefined {
  return (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T')?.matches.find((m) => m.id === 'm1');
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('A-08f3a-F Feldweg: NULL aus der Cloud und Monotonie-Ablage', () => {
  let repo: OfflineRepository | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = 'olli';
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    repo?.mutationQueue.dispose();
    repo = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('F1 Gegenbeispiel: Cloud decided_by NULL, lokal undefined, sonst gleich → keine Änderung, nichts geschrieben', async () => {
    const running: Partial<Match> = { scoreA: 1, scoreB: 0, matchStatus: 'running' };
    stores.raw.set('tournaments', [tournament(running)]);
    const cloudMatch1 = { ...running, decidedBy: null } as unknown as Partial<Match>;
    const cloud = createFakeCloud({ tournament: tournament(cloudMatch1), revisions: revisions(3) });
    const local = new LocalStorageRepository();
    const apply = vi.spyOn(local, 'applyServerMatchFields');
    repo = new OfflineRepository(local, cloud.fake as never, 'olli');

    await repo.get('T');
    await flush();

    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(1);
    expect(apply).not.toHaveBeenCalled();
    expect(storedM1()?.decidedBy).toBeUndefined();
  });

  it('F3 Monotonie: zwei veraltete Abrufe (Revision 5) nach Revision 6 → Endstand bleibt Revision 6', async () => {
    stores.raw.set('tournaments', [tournament({})]);
    const cloud = createFakeCloud({ tournament: tournament({ scoreA: 1, scoreB: 0, matchStatus: 'running' }), revisions: revisions(5) });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    const staleA = cloud.holdNextRead();
    const staleB = cloud.holdNextRead();

    await repo.get('T'); // Abruf A: Revision 5, hängt
    await repo.get('T'); // Abruf B: Revision 5, hängt
    cloud.setState({ tournament: tournament({ scoreA: 2, scoreB: 0, matchStatus: 'running' }), revisions: revisions(6) });
    await repo.get('T'); // Abruf C: Revision 6
    await flush();
    expect(storedM1()?.scoreA).toBe(2);

    staleA.release(); // übernimmt nichts – darf die Ablage nicht leeren
    await flush();
    staleB.release();
    await flush();

    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(3);
    expect(storedM1()).toMatchObject({ scoreA: 2, scoreB: 0 });
  });
});
