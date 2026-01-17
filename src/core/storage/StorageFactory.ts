import { IStorageAdapter } from './IStorageAdapter';
import { IndexedDBAdapter } from './IndexedDBAdapter';
import { LocalStorageAdapter } from './LocalStorageAdapter';

let storageInstance: IStorageAdapter | null = null;
let initializationPromise: Promise<IStorageAdapter> | null = null;

/**
 * Creates and initializes the storage adapter.
 * Uses Singleton pattern to ensure only one DB connection.
 * Falls back to LocalStorage if IndexedDB is not available or fails.
 */
export async function createStorage(): Promise<IStorageAdapter> {
  // Return existing instance if available
  if (storageInstance) {
    return storageInstance;
  }

  // Prevent multiple simultaneous initializations
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    // 1. Try IndexedDB
    if (await isIndexedDBAvailable()) {
      try {
        const adapter = new IndexedDBAdapter();
        await adapter.init();
        storageInstance = adapter;
        return adapter;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('StorageFactory: IndexedDB initialization failed, falling back to LocalStorage.', error);
        }
      }
    }

    // 2. Fallback to LocalStorage
    storageInstance = new LocalStorageAdapter();
    return storageInstance;
  })();

  return initializationPromise;
}

/**
 * Checks if IndexedDB is available and usable (not blocked by privacy settings).
 */
export async function isIndexedDBAvailable(): Promise<boolean> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return false;
  }

  try {
    // Try to open a dummy DB to check for privacy blocking (Safari Private Mode)
    await new Promise<void>((resolve, reject) => {
      const dbName = 'idb-check';
      const request = indexedDB.open(dbName);
      request.onerror = () => {
        reject(new Error(request.error?.message || 'Unknown IDB error'));
      };
      request.onsuccess = () => {
        const db = request.result;
        db.close();
        indexedDB.deleteDatabase(dbName);
        resolve();
      };
    });
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Gets the current storage usage and quota.
 * Returns null if the API is not supported.
 */
export async function getStorageQuota(): Promise<{ usage: number; quota: number } | null> {
  try {
    const estimate = await navigator.storage.estimate();
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (estimate && typeof estimate.usage === 'number' && typeof estimate.quota === 'number') {
      return {
        usage: estimate.usage,
        quota: estimate.quota,
      };
    }
  } catch {
    // Storage API not available
  }
  return null;
}

/**
 * Resets the storage instance (mainly for testing).
 * Only available in development/test mode.
 */
export function resetStorageInstance(): void {
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    throw new Error('resetStorageInstance() is only available in development/test mode');
  }
  storageInstance = null;
  initializationPromise = null;
}
