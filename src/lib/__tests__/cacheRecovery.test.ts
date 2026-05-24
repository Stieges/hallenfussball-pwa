import { describe, expect, it, vi } from 'vitest';

import { clearCachesAndReload } from '../cacheRecovery';

function makeDeps() {
  const unregister1 = vi.fn().mockResolvedValue(true);
  const unregister2 = vi.fn().mockResolvedValue(true);
  const getRegistrations = vi
    .fn()
    .mockResolvedValue([{ unregister: unregister1 }, { unregister: unregister2 }]);
  const cacheKeys = vi.fn().mockResolvedValue(['workbox-precache-v2', 'supabase-api-cache']);
  const cacheDelete = vi.fn().mockResolvedValue(true);
  const reload = vi.fn();
  const capture = vi.fn();
  const order: string[] = [];

  return {
    deps: {
      serviceWorker: {
        getRegistrations: vi.fn(async () => {
          order.push('getRegistrations');
          return getRegistrations.mock.results[0]?.value ?? (await getRegistrations());
        }),
      } as unknown as ServiceWorkerContainer,
      cacheStorage: {
        keys: vi.fn(async () => {
          order.push('caches.keys');
          return cacheKeys();
        }),
        delete: vi.fn(async (n: string) => {
          order.push(`caches.delete:${n}`);
          return cacheDelete(n);
        }),
      } as unknown as CacheStorage,
      reload: () => {
        order.push('reload');
        reload();
      },
      capture: (...args: Parameters<typeof capture>) => {
        order.push('capture');
        capture(...args);
      },
    },
    spies: { unregister1, unregister2, cacheKeys, cacheDelete, reload, capture, order },
  };
}

describe('clearCachesAndReload', () => {
  it('captures a Sentry breadcrumb with build hash and online state', async () => {
    const { deps, spies } = makeDeps();
    await clearCachesAndReload({ buildHash: 'abc123', onLine: false }, deps);
    expect(spies.capture).toHaveBeenCalledOnce();
    const [error, feature, action, extra] = spies.capture.mock.calls[0];
    expect((error as Error).message).toBe('UserTriggeredCacheReset');
    expect(feature).toBe('auth');
    expect(action).toBe('recovery');
    expect(extra).toEqual({ buildHash: 'abc123', onLine: false });
  });

  it('runs capture, unregister, cache-clear, then reload in that order', async () => {
    const { deps, spies } = makeDeps();
    await clearCachesAndReload({ buildHash: 'h', onLine: true }, deps);
    expect(spies.order).toEqual([
      'capture',
      'getRegistrations',
      'caches.keys',
      'caches.delete:workbox-precache-v2',
      'caches.delete:supabase-api-cache',
      'reload',
    ]);
  });

  it('unregisters every service-worker registration', async () => {
    const { deps, spies } = makeDeps();
    await clearCachesAndReload({ buildHash: 'h', onLine: true }, deps);
    expect(spies.unregister1).toHaveBeenCalledOnce();
    expect(spies.unregister2).toHaveBeenCalledOnce();
  });

  it('deletes every cache returned by caches.keys()', async () => {
    const { deps, spies } = makeDeps();
    await clearCachesAndReload({ buildHash: 'h', onLine: true }, deps);
    expect(spies.cacheDelete).toHaveBeenCalledTimes(2);
    expect(spies.cacheDelete).toHaveBeenCalledWith('workbox-precache-v2');
    expect(spies.cacheDelete).toHaveBeenCalledWith('supabase-api-cache');
  });

  it('reloads even if SW unregister fails (partial recovery still better than none)', async () => {
    const { deps, spies } = makeDeps();
    deps.serviceWorker = {
      getRegistrations: vi.fn().mockRejectedValue(new Error('sandbox')),
    } as unknown as ServiceWorkerContainer;
    await clearCachesAndReload({ buildHash: 'h', onLine: true }, deps);
    expect(spies.reload).toHaveBeenCalledOnce();
  });

  it('reloads even if cache-delete fails', async () => {
    const { deps, spies } = makeDeps();
    deps.cacheStorage = {
      keys: vi.fn().mockRejectedValue(new Error('quota')),
      delete: vi.fn(),
    } as unknown as CacheStorage;
    await clearCachesAndReload({ buildHash: 'h', onLine: true }, deps);
    expect(spies.reload).toHaveBeenCalledOnce();
  });

  it('does not propagate capture failures', async () => {
    const { deps } = makeDeps();
    deps.capture = vi.fn(() => {
      throw new Error('sentry down');
    });
    await expect(clearCachesAndReload({ buildHash: 'h', onLine: true }, deps)).resolves.toBeUndefined();
  });
});
