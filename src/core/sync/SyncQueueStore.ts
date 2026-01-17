/**
 * SyncQueueStore - Offline Mutation Queue
 *
 * Persists mutations in IndexedDB for offline-first sync.
 * Uses a dedicated database separate from main app storage.
 *
 * Queue semantics:
 * - FIFO ordering by createdAt
 * - Automatic retry with exponential backoff
 * - Failed mutations kept for manual retry
 */

import { QueuedMutation, SyncTable, SyncOperation } from './types';

const DB_NAME = 'hallenfussball-sync-queue';
const DB_VERSION = 1;
const STORE_NAME = 'mutations';

/**
 * Maximum number of retries before marking as permanently failed
 */
const MAX_RETRIES = 5;

/**
 * Interface for the SyncQueueStore
 */
export interface ISyncQueueStore {
  /** Add a mutation to the queue */
  enqueue(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retries' | 'status'>
  ): Promise<string>;

  /** Get and remove the next pending mutation (FIFO) */
  dequeue(): Promise<QueuedMutation | null>;

  /** Get all pending mutations without removing */
  peek(): Promise<QueuedMutation[]>;

  /** Mark a mutation as failed and increment retry count */
  markFailed(id: string, errorMessage: string): Promise<void>;

  /** Mark a mutation as processing */
  markProcessing(id: string): Promise<void>;

  /** Remove a mutation from the queue (after successful sync) */
  remove(id: string): Promise<void>;

  /** Get the number of pending mutations */
  getQueueSize(): Promise<number>;

  /** Get all failed mutations */
  getFailedMutations(): Promise<QueuedMutation[]>;

  /** Retry a failed mutation (reset status to pending) */
  retryFailed(id: string): Promise<void>;

  /** Clear all mutations (use with caution) */
  clear(): Promise<void>;
}

/**
 * IndexedDB-based sync queue store
 */
export class SyncQueueStore implements ISyncQueueStore {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  private async init(): Promise<void> {
    if (this.db) {return;}

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        reject(new Error(`Failed to open sync queue database: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create the mutations store with indexes
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });

          // Index for FIFO ordering
          store.createIndex('createdAt', 'createdAt', { unique: false });

          // Index for filtering by status
          store.createIndex('status', 'status', { unique: false });

          // Index for filtering by table
          store.createIndex('table', 'table', { unique: false });

          // Compound index for efficient queries
          store.createIndex('status_createdAt', ['status', 'createdAt'], { unique: false });
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Get the object store for a transaction
   */
  private async getStore(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    await this.init();
    if (!this.db) {
      throw new Error('Database not initialized');
    }
    const tx = this.db.transaction(STORE_NAME, mode);
    return tx.objectStore(STORE_NAME);
  }

  /**
   * Generate a UUID for mutation IDs
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  async enqueue(
    mutation: Omit<QueuedMutation, 'id' | 'createdAt' | 'retries' | 'status'>
  ): Promise<string> {
    const store = await this.getStore('readwrite');

    const id = this.generateId();
    const queuedMutation: QueuedMutation = {
      ...mutation,
      id,
      createdAt: new Date(),
      retries: 0,
      status: 'pending',
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queuedMutation);
      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(new Error(`Failed to enqueue mutation: ${request.error?.message}`));
    });
  }

  async dequeue(): Promise<QueuedMutation | null> {
    const store = await this.getStore('readwrite');
    const index = store.index('status_createdAt');

    return new Promise((resolve, reject) => {
      // Get the oldest pending mutation
      const range = IDBKeyRange.bound(['pending', new Date(0)], ['pending', new Date()]);
      const request = index.openCursor(range);

      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          const mutation = cursor.value as QueuedMutation;
          // Remove from queue
          const deleteRequest = cursor.delete();
          deleteRequest.onsuccess = () => resolve(mutation);
          deleteRequest.onerror = () => reject(new Error('Failed to dequeue mutation'));
        } else {
          resolve(null);
        }
      };

      request.onerror = () => reject(new Error(`Failed to dequeue: ${request.error?.message}`));
    });
  }

  async peek(): Promise<QueuedMutation[]> {
    const store = await this.getStore('readonly');
    const index = store.index('status_createdAt');

    return new Promise((resolve, reject) => {
      const range = IDBKeyRange.bound(['pending', new Date(0)], ['pending', new Date()]);
      const request = index.getAll(range);

      request.onsuccess = () => resolve(request.result as QueuedMutation[]);
      request.onerror = () => reject(new Error(`Failed to peek queue: ${request.error?.message}`));
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<void> {
    const store = await this.getStore('readwrite');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const mutation = getRequest.result as QueuedMutation | undefined;
        if (!mutation) {
          reject(new Error(`Mutation ${id} not found`));
          return;
        }

        const newRetries = mutation.retries + 1;
        const updatedMutation: QueuedMutation = {
          ...mutation,
          retries: newRetries,
          status: newRetries >= MAX_RETRIES ? 'failed' : 'pending',
          errorMessage,
        };

        const putRequest = store.put(updatedMutation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update mutation status'));
      };

      getRequest.onerror = () => reject(new Error(`Failed to get mutation: ${getRequest.error?.message}`));
    });
  }

  async markProcessing(id: string): Promise<void> {
    const store = await this.getStore('readwrite');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const mutation = getRequest.result as QueuedMutation | undefined;
        if (!mutation) {
          reject(new Error(`Mutation ${id} not found`));
          return;
        }

        const updatedMutation: QueuedMutation = {
          ...mutation,
          status: 'processing',
        };

        const putRequest = store.put(updatedMutation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to update mutation status'));
      };

      getRequest.onerror = () => reject(new Error(`Failed to get mutation: ${getRequest.error?.message}`));
    });
  }

  async remove(id: string): Promise<void> {
    const store = await this.getStore('readwrite');

    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to remove mutation: ${request.error?.message}`));
    });
  }

  async getQueueSize(): Promise<number> {
    const store = await this.getStore('readonly');
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.count(IDBKeyRange.only('pending'));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(new Error(`Failed to count queue: ${request.error?.message}`));
    });
  }

  async getFailedMutations(): Promise<QueuedMutation[]> {
    const store = await this.getStore('readonly');
    const index = store.index('status');

    return new Promise((resolve, reject) => {
      const request = index.getAll(IDBKeyRange.only('failed'));
      request.onsuccess = () => resolve(request.result as QueuedMutation[]);
      request.onerror = () => reject(new Error(`Failed to get failed mutations: ${request.error?.message}`));
    });
  }

  async retryFailed(id: string): Promise<void> {
    const store = await this.getStore('readwrite');

    return new Promise((resolve, reject) => {
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const mutation = getRequest.result as QueuedMutation | undefined;
        if (!mutation) {
          reject(new Error(`Mutation ${id} not found`));
          return;
        }

        const updatedMutation: QueuedMutation = {
          ...mutation,
          status: 'pending',
          retries: 0,
          errorMessage: undefined,
        };

        const putRequest = store.put(updatedMutation);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(new Error('Failed to retry mutation'));
      };

      getRequest.onerror = () => reject(new Error(`Failed to get mutation: ${getRequest.error?.message}`));
    });
  }

  async clear(): Promise<void> {
    const store = await this.getStore('readwrite');

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to clear queue: ${request.error?.message}`));
    });
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
    }
  }
}

/**
 * Singleton instance for app-wide sync queue
 */
export const syncQueueStore = new SyncQueueStore();

/**
 * Helper to create a mutation for a tournament operation
 */
export function createTournamentMutation(
  operation: SyncOperation,
  recordId: string,
  payload: Record<string, unknown>
): Omit<QueuedMutation, 'id' | 'createdAt' | 'retries' | 'status'> {
  return {
    table: 'tournaments' as SyncTable,
    operation,
    recordId,
    payload,
  };
}

/**
 * Helper to create a mutation for a match operation
 */
export function createMatchMutation(
  operation: SyncOperation,
  recordId: string,
  payload: Record<string, unknown>
): Omit<QueuedMutation, 'id' | 'createdAt' | 'retries' | 'status'> {
  return {
    table: 'matches' as SyncTable,
    operation,
    recordId,
    payload,
  };
}
