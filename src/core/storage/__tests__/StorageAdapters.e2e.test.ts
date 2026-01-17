import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBAdapter } from '../IndexedDBAdapter';

/**
 * Integration tests for IndexedDB Adapter.
 * 
 * These tests require a real IndexedDB implementation.
 * In JSDOM/happy-dom, IndexedDB may not be available or may be mocked.
 * 
 * For full E2E testing with real browser APIs, use Playwright.
 */

describe('IndexedDBAdapter (Integration)', () => {
    // Check if IndexedDB is available and functional in this environment
    const isIDBAvailable = typeof indexedDB !== 'undefined';

    // Skip all tests if IndexedDB is not available
    const describeReal = isIDBAvailable ? describe : describe.skip;

    describeReal('when IndexedDB is available', () => {
        let adapter: IndexedDBAdapter;

        beforeEach(async () => {
            adapter = new IndexedDBAdapter();
            await adapter.init();
            await adapter.clear();
        });

        afterEach(async () => {
            await adapter.clear();
        });

        it('should set and get a value', async () => {
            await adapter.set('test-key', { name: 'Test Tournament', teams: 8 });
            const result = await adapter.get<{ name: string; teams: number }>('test-key');

            expect(result).toEqual({ name: 'Test Tournament', teams: 8 });
        });

        it('should return null for missing key', async () => {
            const result = await adapter.get('non-existent');
            expect(result).toBeNull();
        });

        it('should delete a value', async () => {
            await adapter.set('to-delete', 'value');
            await adapter.delete('to-delete');
            const result = await adapter.get('to-delete');

            expect(result).toBeNull();
        });

        it('should list all keys', async () => {
            await adapter.set('key1', 'value1');
            await adapter.set('key2', 'value2');
            const keys = await adapter.keys();

            expect(keys).toContain('key1');
            expect(keys).toContain('key2');
        });

        it('should clear all values', async () => {
            await adapter.set('key1', 'value1');
            await adapter.set('key2', 'value2');
            await adapter.clear();
            const keys = await adapter.keys();

            expect(keys).toHaveLength(0);
        });

        it('should handle complex nested objects', async () => {
            const tournament = {
                id: 'abc-123',
                name: 'Champions League',
                teams: [
                    { id: 't1', name: 'Team A' },
                    { id: 't2', name: 'Team B' },
                ],
                settings: {
                    matchDuration: 10,
                    halftimeBreak: 2,
                },
            };

            await adapter.set('tournament', tournament);
            const result = await adapter.get<typeof tournament>('tournament');

            expect(result).toEqual(tournament);
        });

        it('should handle large datasets efficiently', async () => {
            const tournaments = Array.from({ length: 100 }, (_, i) => ({
                id: `tournament-${i}`,
                name: `Tournament ${i}`,
                teams: Array.from({ length: 16 }, (__, j) => ({ id: `team-${j}`, name: `Team ${j}` })),
            }));

            const start = performance.now();
            await adapter.set('tournaments', tournaments);
            const result = await adapter.get<typeof tournaments>('tournaments');
            const duration = performance.now() - start;

            expect(result).toHaveLength(100);
            expect(duration).toBeLessThan(1000); // Should complete in under 1 second
        });
    });

    // Note for LocalStorageAdapter:
    // Direct testing of LocalStorageAdapter is unreliable in JSDOM due to mock quirks.
    // LocalStorageAdapter is tested indirectly via:
    // 1. StorageFactory.test.ts (fallback logic)
    // 2. StorageFallback.test.ts (Safari Private Mode scenarios)
    // 3. Full E2E via Playwright (real browser)
});
