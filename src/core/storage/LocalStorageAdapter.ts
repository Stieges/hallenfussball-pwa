/**
 * LocalStorageAdapter - localStorage-based storage implementation
 *
 * Fallback storage when IndexedDB is unavailable.
 *
 * Limitations:
 * - 5MB storage limit
 * - Synchronous API (wrapped in Promises for interface consistency)
 * - String-only storage (requires JSON serialization)
 * - May throw QuotaExceededError on large data
 *
 * Use cases:
 * - Private browsing modes where IndexedDB is disabled
 * - Older browsers without IndexedDB support
 * - Testing environments
 */

import { IStorageAdapter } from './IStorageAdapter';

export class LocalStorageAdapter implements IStorageAdapter {
  /**
   * Get value by key
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {
        return null;
      }
      return JSON.parse(item) as T;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`LocalStorageAdapter.get failed for key "${key}":`, error);
      }
      return null;
    }
  }

  /**
   * Set value by key
   */
  async set<T>(key: string, value: T): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      localStorage.setItem(key, serialized);
    } catch (error) {
      // QuotaExceededError is common when approaching 5MB limit
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        throw new Error(
          `localStorage quota exceeded. Consider using IndexedDB for large tournaments.`
        );
      }
      throw new Error(`LocalStorageAdapter.set failed: ${(error as Error).message}`);
    }
  }

  /**
   * Delete value by key
   */
  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(`LocalStorageAdapter.delete failed for key "${key}":`, error);
      }
      // Don't throw - deletion failure is non-critical
    }
  }

  /**
   * Clear all data
   */
  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      throw new Error(`LocalStorageAdapter.clear failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get all keys
   */
  async keys(): Promise<string[]> {
    try {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key !== null) {
          keys.push(key);
        }
      }
      return keys;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('LocalStorageAdapter.keys failed:', error);
      }
      return [];
    }
  }
}
