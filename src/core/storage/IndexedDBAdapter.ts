/**
 * IndexedDBAdapter - IndexedDB-based storage implementation
 *
 * Features:
 * - No 5MB limit (supports large tournaments with 50+ teams)
 * - Async API (non-blocking)
 * - Structured data storage
 * - Transaction support
 *
 * Database Schema:
 * - Database: 'hallenfussball'
 * - Store: 'cache'
 * - Key Path: 'key'
 */

import { IStorageAdapter } from './IStorageAdapter';

interface StorageItem<T = unknown> {
  key: string;
  value: T;
}

export class IndexedDBAdapter implements IStorageAdapter {
  private db: IDBDatabase | null = null;
  private readonly dbName = 'hallenfussball';
  private readonly storeName = 'cache';
  private readonly version = 1;

  /**
   * Initialize IndexedDB connection
   * Must be called before using any other methods
   */
  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`IndexedDB open failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Get value by key
   */
  async get<T>(key: string): Promise<T | null> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const db = this.db as IDBDatabase; // Safe after ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onerror = () => {
        reject(new Error(`IndexedDB get failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        const item = request.result as StorageItem<T> | undefined;
        resolve(item ? item.value : null);
      };
    });
  }

  /**
   * Set value by key
   */
  async set<T>(key: string, value: T): Promise<void> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const db = this.db as IDBDatabase; // Safe after ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const item: StorageItem<T> = { key, value };
      const request = store.put(item);

      request.onerror = () => {
        reject(new Error(`IndexedDB set failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Delete value by key
   */
  async delete(key: string): Promise<void> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const db = this.db as IDBDatabase; // Safe after ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onerror = () => {
        reject(new Error(`IndexedDB delete failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const db = this.db as IDBDatabase; // Safe after ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onerror = () => {
        reject(new Error(`IndexedDB clear failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve();
      };
    });
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    this.ensureInitialized();
    // eslint-disable-next-line @typescript-eslint/non-nullable-type-assertion-style
    const db = this.db as IDBDatabase; // Safe after ensureInitialized()

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onerror = () => {
        reject(new Error(`IndexedDB keys failed: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        resolve(request.result as string[]);
      };
    });
  }

  /**
   * Ensure database is initialized before operations
   */
  private ensureInitialized(): void {
    if (!this.db) {
      throw new Error('IndexedDBAdapter not initialized. Call init() first.');
    }
  }

  /**
   * Close database connection
   * Optional cleanup method
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }
}
