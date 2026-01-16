import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isIndexedDBAvailable, resetStorageInstance } from '../StorageFactory';

/**
 * Tests for Safari Private Mode and other restricted storage scenarios.
 * These verify that our fallback mechanism works correctly.
 */

describe('Storage Fallback Scenarios', () => {
    beforeEach(() => {
        resetStorageInstance();
        vi.clearAllMocks();
    });

    describe('isIndexedDBAvailable', () => {
        it('should return false when indexedDB is undefined', async () => {
            // Save original
            const originalIDB = window.indexedDB;

            // Remove indexedDB
            Object.defineProperty(window, 'indexedDB', {
                value: undefined,
                writable: true,
                configurable: true,
            });

            const result = await isIndexedDBAvailable();
            expect(result).toBe(false);

            // Restore
            Object.defineProperty(window, 'indexedDB', {
                value: originalIDB,
                writable: true,
                configurable: true,
            });
        });

        it('should return false when indexedDB.open throws (Safari Private Mode simulation)', async () => {
            const originalIDB = window.indexedDB;

            // Mock IDB that throws on open (simulates Safari Private Mode)
            const mockIDB = {
                open: vi.fn().mockImplementation(() => {
                    const request: any = {
                        error: new Error('Access to IndexedDB is denied'),
                    };
                    // Trigger error async
                    setTimeout(() => {
                        if (request.onerror) {
                            request.onerror();
                        }
                    }, 0);
                    return request;
                }),
                deleteDatabase: vi.fn(),
            };

            Object.defineProperty(window, 'indexedDB', {
                value: mockIDB,
                writable: true,
                configurable: true,
            });

            const result = await isIndexedDBAvailable();
            expect(result).toBe(false);

            // Restore
            Object.defineProperty(window, 'indexedDB', {
                value: originalIDB,
                writable: true,
                configurable: true,
            });
        });

        it('should return true when indexedDB works correctly', async () => {
            const originalIDB = window.indexedDB;

            // Mock working IDB
            const mockIDB = {
                open: vi.fn().mockImplementation(() => {
                    const request: any = {
                        result: { close: vi.fn() },
                        error: null,
                    };
                    setTimeout(() => {
                        if (request.onsuccess) {
                            request.onsuccess();
                        }
                    }, 0);
                    return request;
                }),
                deleteDatabase: vi.fn(),
            };

            Object.defineProperty(window, 'indexedDB', {
                value: mockIDB,
                writable: true,
                configurable: true,
            });

            const result = await isIndexedDBAvailable();
            expect(result).toBe(true);

            // Restore
            Object.defineProperty(window, 'indexedDB', {
                value: originalIDB,
                writable: true,
                configurable: true,
            });
        });
    });
});
