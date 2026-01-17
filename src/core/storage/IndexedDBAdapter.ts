import { IStorageAdapter } from './IStorageAdapter';
import { StorageError } from './StorageError';

/**
 * IndexedDB implementation for high-performance offline storage.
 * Wraps the raw IndexedDB API in Promises.
 */
export class IndexedDBAdapter implements IStorageAdapter {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'hallenfussball';
  private readonly storeName = 'cache';
  private readonly version = 1;

  /**
   * Initializes the IndexedDB connection.
   * Must be called before any other operations.
   */
  async init(): Promise<void> {
    if (this.db) { return; }

    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open(this.dbName, this.version);

        request.onerror = () => {
          reject(new StorageError('Failed to open IndexedDB', request.error));
        };

        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'key' });
          }
        };
      } catch (error) {
        reject(new StorageError('Unexpected error opening IndexedDB', error));
      }
    });
  }

  private getStore(mode: IDBTransactionMode): IDBObjectStore {
    if (!this.db) {
      throw new StorageError('IndexedDB not initialized. Call init() first.');
    }
    const transaction = this.db.transaction(this.storeName, mode);
    return transaction.objectStore(this.storeName);
  }

  async get<T>(key: string): Promise<T | null> {
    return new Promise((resolve, reject) => {
      try {
        const request = this.getStore('readonly').get(key);

        request.onerror = () => {
          reject(new StorageError(`Failed to get key '${key}' from IndexedDB`, request.error));
        };

        request.onsuccess = () => {
          const result = request.result as { key: string; value: T } | undefined;
          // Result matches the shape stored in 'put', which is { key: string, value: T }
          // We need to return the 'value' property.
          resolve(result ? result.value : null);
        };
      } catch (error) {
        reject(new StorageError(`Unexpected error getting key '${key}'`, error));
      }
    });
  }

  async set<T>(key: string, value: T): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // We store the object as { key: "...", value: ... } because keyPath is "key"
        const request = this.getStore('readwrite').put({ key, value });

        request.onerror = () => {
          reject(new StorageError(`Failed to set key '${key}' in IndexedDB`, request.error));
        };

        request.onsuccess = () => {
          resolve();
        };
      } catch (error) {
        reject(new StorageError(`Unexpected error setting key '${key}'`, error));
      }
    });
  }

  async delete(key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const request = this.getStore('readwrite').delete(key);

        request.onerror = () => {
          reject(new StorageError(`Failed to delete key '${key}' from IndexedDB`, request.error));
        };

        request.onsuccess = () => {
          resolve();
        };
      } catch (error) {
        reject(new StorageError(`Unexpected error deleting key '${key}'`, error));
      }
    });
  }

  async clear(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const request = this.getStore('readwrite').clear();

        request.onerror = () => {
          reject(new StorageError('Failed to clear IndexedDB', request.error));
        };

        request.onsuccess = () => {
          resolve();
        };
      } catch (error) {
        reject(new StorageError('Unexpected error clearing IndexedDB', error));
      }
    });
  }

  async keys(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      try {
        const request = this.getStore('readonly').getAllKeys();

        request.onerror = () => {
          reject(new StorageError('Failed to get keys from IndexedDB', request.error));
        };

        request.onsuccess = () => {
          resolve(request.result.map(k => String(k)));
        };
      } catch (error) {
        reject(new StorageError('Unexpected error getting keys', error));
      }
    });
  }
}
