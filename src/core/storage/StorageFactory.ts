/**
 * StorageFactory - Auto-detects best available storage backend
 *
 * Priority:
 * 1. IndexedDB (preferred) - No 5MB limit, async, structured
 * 2. localStorage (fallback) - 5MB limit, sync, simple
 *
 * Usage:
 * ```typescript
 * const storage = await createStorage();
 * await storage.set('key', value);
 * const value = await storage.get<Type>('key');
 * ```
 */

import { IStorageAdapter } from './IStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';

/**
 * Create storage adapter with automatic backend detection
 * @returns Initialized storage adapter (IndexedDB or localStorage)
 */
export async function createStorage(): Promise<IStorageAdapter> {
  // Try IndexedDB first (preferred for large tournaments)
  if ('indexedDB' in window) {
    try {
      const adapter = new IndexedDBAdapter();
      await adapter.init();

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('✅ Storage: IndexedDB initialized');
      }

      return adapter;
    } catch (error) {
      if (import.meta.env.DEV) {
         
        console.warn('⚠️ IndexedDB initialization failed, falling back to localStorage:', error);
      }
      // Fall through to localStorage
    }
  } else if (import.meta.env.DEV) {
    console.warn('⚠️ IndexedDB not available, using localStorage');
  }

  // Fallback to localStorage
  const fallback = new LocalStorageAdapter();

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('✅ Storage: localStorage initialized (5MB limit)');
  }

  return fallback;
}

/**
 * Check if IndexedDB is available and functional
 * Useful for feature detection and error messages
 */
export function isIndexedDBAvailable(): boolean {
  if (!('indexedDB' in window)) {
    return false;
  }

  try {
    // Quick check - some browsers have indexedDB but it's broken
    const testDB = indexedDB.open('test');
    testDB.onerror = () => false;
    return true;
  } catch {
    return false;
  }
}

/**
 * Estimate available storage quota (IndexedDB only)
 * Returns null if not supported or localStorage is used
 */
export async function getStorageQuota(): Promise<{
  usage: number;
  quota: number;
  percentage: number;
} | null> {
  if (!('storage' in navigator && 'estimate' in navigator.storage)) {
    return null;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percentage = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percentage };
  } catch {
    return null;
  }
}
