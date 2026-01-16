import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStorage, resetStorageInstance } from '../StorageFactory';
import { IndexedDBAdapter } from '../IndexedDBAdapter';
import { LocalStorageAdapter } from '../LocalStorageAdapter';

// Mock IndexedDB
const mockIndexedDB = {
    open: vi.fn(),
    deleteDatabase: vi.fn(),
};

// Mock adapters
vi.mock('../IndexedDBAdapter');
vi.mock('../LocalStorageAdapter');

describe('StorageFactory', () => {
    beforeEach(() => {
        resetStorageInstance();
        vi.clearAllMocks();

        // Default mock implementation for Adapters
        (IndexedDBAdapter as any).mockImplementation(function () {
            return {
                init: vi.fn().mockResolvedValue(undefined),
            };
        });
        (LocalStorageAdapter as any).mockImplementation(function () { return {}; });

        // Improve IndexedDB mock to handle isIndexedDBAvailable check
        (mockIndexedDB.open as any).mockImplementation(() => {
            const request: any = {
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
        // Mock init failure using function (not arrow) for constructibility
        (IndexedDBAdapter as any).mockImplementation(function () {
            return {
                init: vi.fn().mockRejectedValue(new Error('Init failed')),
            };
        });

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
