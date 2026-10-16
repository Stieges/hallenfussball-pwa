/**
 * A-07e N-2 (H4, @FU-006, @AN-024): Eine fremde lokale Kopie bleibt unangetastet. Liest ein
 * Konto A ein Turnier, dessen lokale Kopie einem anderen Konto B gehört, bekommt A den
 * Cloud-Stand zurück, aber die Kopie von B wird weder überschrieben noch umgeschrieben.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';

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
        stores.raw.set(key, value);
        return Promise.resolve();
      },
    }),
}));

vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      stores.queue.set(key, value);
    }),
    setItemPersisted: vi.fn((key: string, value: string) => {
      stores.queue.set(key, value);
      return true;
    }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => {
      stores.queue.delete(key);
    }),
  },
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: session.userId ? { user: { id: session.userId } } : null },
        error: null,
      })),
    },
  },
}));

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { readWithRevisions } from '../../../test/fakeCloudRepository';

function t(id: string, extra: Partial<Tournament> = {}): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    status: 'draft',
    teams: [],
    matches: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  } as unknown as Tournament;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

describe('A-07e N-2: fremde lokale Kopie bleibt unangetastet (H4)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = 'A';
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('A bekommt den Cloud-Stand v4, lokal bleibt die Kopie von B (v5, Marker B) unveraendert', async () => {
    stores.raw.set('tournaments', [t('T', { ownerId: 'B', version: 5, title: 'B-lokal' })]);
    const get = vi.fn(async () => t('T', { version: 4, title: 'cloud-v4' }));
    const cloudA = {
      get,
      getWithMatchRevisions: vi.fn(readWithRevisions(get)),
      save: vi.fn(async () => undefined),
      listForCurrentUser: vi.fn(async () => []),
      getByShareCode: vi.fn(async () => null),
    };
    const repoA = new OfflineRepository(new LocalStorageRepository(), cloudA as never, 'A');

    try {
      const got = await repoA.get('T');
      await flush();

      expect(got?.title).toBe('cloud-v4');
      const stored = (stores.raw.get('tournaments') as Tournament[]).find((x) => x.id === 'T');
      expect(stored?.title).toBe('B-lokal');
      expect(stored?.version).toBe(5);
      expect(stored?.ownerId).toBe('B');
    } finally {
      repoA.mutationQueue.dispose();
    }
  });
});
