import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IndexedDBAdapter } from '../IndexedDBAdapter';

/**
 * Schema-Lock regression test for IndexedDBAdapter.
 *
 * This test snapshots the current IndexedDB schema configuration. It fails
 * the moment anyone changes the DB name, store name, version, or keyPath
 * — making it impossible to silently break persisted user data.
 *
 * If you need to change any of the locked values, you MUST also implement
 * a migration path inside `onupgradeneeded` AND update the expected values
 * here in the same commit. Bumping the version without writing a migration
 * will trigger a destructive schema reset for every existing user.
 *
 * Locked values (snapshot 2026-05-23):
 *   dbName    = 'hallenfussball'
 *   storeName = 'cache'
 *   version   = 1
 *   keyPath   = 'key'
 */

interface FakeIDBRequest {
  result: unknown;
  error: DOMException | null;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
  onupgradeneeded: ((event: { target: { result: unknown } }) => void) | null;
}

interface CapturedOpen {
  dbName: string;
  version: number;
}

interface CapturedCreateStore {
  storeName: string;
  options: IDBObjectStoreParameters | undefined;
}

const EXPECTED_SCHEMA = Object.freeze({
  dbName: 'hallenfussball',
  storeName: 'cache',
  version: 1,
  keyPath: 'key',
});

function setupFakeIndexedDB(): {
  opens: CapturedOpen[];
  creates: CapturedCreateStore[];
  triggerUpgrade: () => void;
  triggerSuccess: () => void;
} {
  const opens: CapturedOpen[] = [];
  const creates: CapturedCreateStore[] = [];

  const fakeStore = {};
  const fakeDB = {
    objectStoreNames: {
      contains: vi.fn(() => false),
    },
    createObjectStore: vi.fn((storeName: string, options?: IDBObjectStoreParameters) => {
      creates.push({ storeName, options });
      return fakeStore;
    }),
  };

  const request: FakeIDBRequest = {
    result: fakeDB,
    error: null,
    onsuccess: null,
    onerror: null,
    onupgradeneeded: null,
  };

  const fakeIndexedDB = {
    open: vi.fn((dbName: string, version: number) => {
      opens.push({ dbName, version });
      return request;
    }),
  };

  vi.stubGlobal('indexedDB', fakeIndexedDB);

  return {
    opens,
    creates,
    triggerUpgrade: () => {
      request.onupgradeneeded?.({ target: { result: fakeDB } });
    },
    triggerSuccess: () => {
      request.onsuccess?.();
    },
  };
}

describe('IndexedDBAdapter — schema lock (HP-5c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens the IndexedDB with the locked dbName and version', async () => {
    const fake = setupFakeIndexedDB();

    const adapter = new IndexedDBAdapter();
    const initPromise = adapter.init();
    fake.triggerSuccess();
    await initPromise;

    expect(fake.opens).toHaveLength(1);
    expect(fake.opens[0].dbName).toBe(EXPECTED_SCHEMA.dbName);
    expect(fake.opens[0].version).toBe(EXPECTED_SCHEMA.version);
  });

  it('creates the locked object store with the locked keyPath on upgrade', async () => {
    const fake = setupFakeIndexedDB();

    const adapter = new IndexedDBAdapter();
    const initPromise = adapter.init();
    fake.triggerUpgrade();
    fake.triggerSuccess();
    await initPromise;

    expect(fake.creates).toHaveLength(1);
    expect(fake.creates[0].storeName).toBe(EXPECTED_SCHEMA.storeName);
    expect(fake.creates[0].options?.keyPath).toBe(EXPECTED_SCHEMA.keyPath);
  });

  it('snapshot guard — schema constants must not drift silently', () => {
    expect(EXPECTED_SCHEMA).toEqual({
      dbName: 'hallenfussball',
      storeName: 'cache',
      version: 1,
      keyPath: 'key',
    });
  });
});
