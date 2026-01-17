import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStorage, resetStorageInstance } from '../StorageFactory';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { LocalStorageAdapter } from '../LocalStorageAdapter';
import type { IStorageAdapter } from '../IStorageAdapter';

/** Mock interface for IDBOpenDBRequest */
interface MockIDBOpenDBRequest {
    result?: { close: () => void };
    error: Error | null;
    onsuccess?: (() => void) | null;
    onerror?: (() => void) | null;
}

/** Mock adapter interface that includes init() method from IndexedDBAdapter */
interface MockStorageAdapter extends IStorageAdapter {
    init: () => Promise<void>;
}

// Mock IndexedDB
const mockIndexedDB = {
    open: vi.fn(() => ({} as MockIDBOpenDBRequest)),
    deleteDatabase: vi.fn(),
};

// Mock adapters
vi.mock('../IndexedDBAdapter');
vi.mock('../LocalStorageAdapter');

/** Helper to create a mock storage adapter with init() */
function createMockAdapter(overrides: Partial<MockStorageAdapter> = {}): MockStorageAdapter {
    return {
        init: vi.fn().mockResolvedValue(undefined),
        get: vi.fn(),
        set: vi.fn(),
        delete: vi.fn(),
        clear: vi.fn(),
        keys: vi.fn(),
        ...overrides,
    };
}

describe('StorageFactory', () => {
    beforeEach(() => {
        resetStorageInstance();
        vi.clearAllMocks();

        // Default mock implementation for Adapters
        // Note: Using function() instead of arrow for constructor compatibility
        vi.mocked(IndexedDBAdapter).mockImplementation(function () {
            return createMockAdapter();
        } as unknown as () => IndexedDBAdapter);
        vi.mocked(LocalStorageAdapter).mockImplementation(function () {
            return createMockAdapter();
        } as unknown as () => LocalStorageAdapter);

        // Improve IndexedDB mock to handle isIndexedDBAvailable check
        mockIndexedDB.open.mockImplementation(() => {
            const request: MockIDBOpenDBRequest = {
                result: { close: vi.fn() },
                error: null,
            };
            // Trigger success async to allow callback assignment
            setTimeout(() => {
                if (request.onsuccess) {
                    request.onsuccess();
                }
            }, 0);
            return request;
        });

        // Setup window.indexedDB
        Object.defineProperty(window, 'indexedDB', {
            value: mockIndexedDB,
            writable: true,
            configurable: true,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should return IndexedDBAdapter when available', async () => {
        await createStorage();
        expect(IndexedDBAdapter).toHaveBeenCalled();
        expect(LocalStorageAdapter).not.toHaveBeenCalled();
    });

    it('should fallback to LocalStorageAdapter if IndexedDB is missing', async () => {
        // Override mock for this test to throw or return null?
        // Actually stubGlobal won't work easily with Object.defineProperty, 
        // better to re-define or use a different mock.
        Object.defineProperty(window, 'indexedDB', {
            value: undefined,
            writable: true
        });

        await createStorage();
        expect(IndexedDBAdapter).not.toHaveBeenCalled();
        expect(LocalStorageAdapter).toHaveBeenCalled();
    });

    it('should fallback to LocalStorageAdapter if IndexedDB init fails', async () => {
        // Mock init failure
        vi.mocked(IndexedDBAdapter).mockImplementation(function () {
            return createMockAdapter({
                init: vi.fn().mockRejectedValue(new Error('Init failed')),
            });
        } as unknown as () => IndexedDBAdapter);

        await createStorage();

        expect(IndexedDBAdapter).toHaveBeenCalled();
        expect(LocalStorageAdapter).toHaveBeenCalled();
    });

    it('should return singleton instance', async () => {
        const storage1 = await createStorage();
        const storage2 = await createStorage();

        expect(storage1).toBe(storage2);
        expect(IndexedDBAdapter).toHaveBeenCalledTimes(1);
    });
});
