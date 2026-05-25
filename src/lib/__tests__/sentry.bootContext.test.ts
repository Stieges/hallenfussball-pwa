import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { collectBootContext } from '../sentry';

interface ServiceWorkerLike {
  state: string;
  scriptURL: string;
}

interface RegistrationLike {
  installing: ServiceWorkerLike | null;
  waiting: ServiceWorkerLike | null;
  active: ServiceWorkerLike | null;
}

interface MockSwOptions {
  controller?: ServiceWorkerLike | null;
  registrations?: RegistrationLike[];
}

function installServiceWorkerMock(options: MockSwOptions): void {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: {
      controller: options.controller ?? null,
      getRegistrations: vi.fn().mockResolvedValue(options.registrations ?? []),
    },
  });
}

function removeServiceWorker(): void {
  // Re-define as non-existent (delete property)
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: undefined,
  });
}

function installCachesMock(names: string[]): void {
  (globalThis as { caches?: CacheStorage }).caches = {
    keys: vi.fn().mockResolvedValue(names),
  } as unknown as CacheStorage;
}

// jsdom doesn't ship indexedDB. We synthesize a minimal stub so the
// `databases()`-feature check in collectBootContext can flip between
// supported/unsupported per test.
function ensureIndexedDB(): { databases?: () => Promise<IDBDatabaseInfo[]> } {
  const g = globalThis as unknown as {
    indexedDB?: { databases?: () => Promise<IDBDatabaseInfo[]> };
  };
  g.indexedDB ??= {};
  return g.indexedDB;
}

function installIdbDatabasesMock(names: string[]): void {
  ensureIndexedDB().databases = vi
    .fn()
    .mockResolvedValue(names.map((n) => ({ name: n, version: 1 })));
}

const originalOnLineDescriptor = Object.getOwnPropertyDescriptor(
  Object.getPrototypeOf(navigator) as object,
  'onLine',
);
const originalServiceWorker = (navigator as Navigator & {
  serviceWorker?: ServiceWorkerContainer;
}).serviceWorker;
const originalCaches = (globalThis as { caches?: CacheStorage }).caches;

function setOnLine(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
}

afterEach(() => {
  if (originalOnLineDescriptor) {
    Object.defineProperty(navigator, 'onLine', originalOnLineDescriptor);
  }
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: originalServiceWorker,
  });
  (globalThis as { caches?: CacheStorage }).caches = originalCaches;
  // Reset indexedDB stub between tests so feature detection stays deterministic
  const g = globalThis as unknown as { indexedDB?: { databases?: unknown } };
  if (g.indexedDB) {
    delete g.indexedDB.databases;
  }
});

describe('collectBootContext', () => {
  beforeEach(() => {
    setOnLine(true);
    installCachesMock([]);
    installIdbDatabasesMock([]);
  });

  it('reports the injected build hash', async () => {
    installServiceWorkerMock({ controller: null });
    const ctx = await collectBootContext();
    expect(ctx.buildHash).toBe(__BUILD_HASH__);
  });

  it('reports navigator.onLine value', async () => {
    setOnLine(false);
    installServiceWorkerMock({ controller: null });
    const ctx = await collectBootContext();
    expect(ctx.navigatorOnLine).toBe(false);
  });

  it('reports SW state "active" when a controller is present', async () => {
    installServiceWorkerMock({
      controller: { state: 'activated', scriptURL: 'https://example.com/sw.js' },
    });
    const ctx = await collectBootContext();
    expect(ctx.swState).toBe('activated');
    expect(ctx.swScriptURL).toBe('https://example.com/sw.js');
  });

  it('reports SW state "none" when no controller and no registrations', async () => {
    installServiceWorkerMock({ controller: null, registrations: [] });
    const ctx = await collectBootContext();
    expect(ctx.swState).toBe('none');
    expect(ctx.swScriptURL).toBeNull();
  });

  it('reports SW state "waiting" when registration has a waiting worker', async () => {
    installServiceWorkerMock({
      controller: null,
      registrations: [
        {
          installing: null,
          waiting: { state: 'installed', scriptURL: 'https://example.com/sw-new.js' },
          active: { state: 'activated', scriptURL: 'https://example.com/sw-old.js' },
        },
      ],
    });
    const ctx = await collectBootContext();
    expect(ctx.swState).toBe('waiting');
    expect(ctx.swScriptURL).toBe('https://example.com/sw-new.js');
  });

  it('reports SW state "unsupported" when navigator.serviceWorker is absent', async () => {
    removeServiceWorker();
    const ctx = await collectBootContext();
    expect(ctx.swState).toBe('unsupported');
    expect(ctx.swScriptURL).toBeNull();
  });

  it('lists cache-storage keys for stale-precache diagnosis', async () => {
    installServiceWorkerMock({ controller: null });
    installCachesMock([
      'workbox-precache-v2-https://example.com/',
      'supabase-api-cache',
      'google-fonts-cache',
    ]);
    const ctx = await collectBootContext();
    expect(ctx.cacheNames).toEqual([
      'workbox-precache-v2-https://example.com/',
      'supabase-api-cache',
      'google-fonts-cache',
    ]);
  });

  it('lists indexedDB database names', async () => {
    installServiceWorkerMock({ controller: null });
    installIdbDatabasesMock(['hallenfussball', 'hallenfussball-sync-queue']);
    const ctx = await collectBootContext();
    expect(ctx.idbDatabases).toEqual(['hallenfussball', 'hallenfussball-sync-queue']);
  });

  it('survives caches.keys() failure without throwing', async () => {
    installServiceWorkerMock({ controller: null });
    (globalThis as { caches?: CacheStorage }).caches = {
      keys: vi.fn().mockRejectedValue(new Error('opaque')),
    } as unknown as CacheStorage;
    const ctx = await collectBootContext();
    expect(ctx.cacheNames).toEqual([]);
  });

  it('survives getRegistrations() failure without throwing', async () => {
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        getRegistrations: vi.fn().mockRejectedValue(new Error('sandbox')),
      },
    });
    const ctx = await collectBootContext();
    expect(ctx.swState).toBe('unsupported');
  });
});
