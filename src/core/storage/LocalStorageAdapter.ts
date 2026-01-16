import { IStorageAdapter } from './IStorageAdapter';
import { StorageError } from './StorageError';

/**
 * LocalStorage implementation of IStorageAdapter.
 * Used as a fallback when IndexedDB is not available.
 */
export class LocalStorageAdapter implements IStorageAdapter {
  async get<T>(key: string): Promise<T | null> {
    try {
      const item = localStorage.getItem(key);
      if (item === null) {return null;}
      return JSON.parse(item) as T;
    } catch (error) {
      throw new StorageError(`Failed to get item '${key}' from LocalStorage`, error);
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Check for quota exceeded error
      if (error instanceof Error && (
        error.name === 'QuotaExceededError' ||
        error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
      )) {
        throw new StorageError('LocalStorage quota exceeded', error);
      }
      throw new StorageError(`Failed to set item '${key}' in LocalStorage`, error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      throw new StorageError(`Failed to delete item '${key}' from LocalStorage`, error);
    }
  }

  async clear(): Promise<void> {
    try {
      localStorage.clear();
    } catch (error) {
      throw new StorageError('Failed to clear LocalStorage', error);
    }
  }

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
      throw new StorageError('Failed to get keys from LocalStorage', error);
    }
  }
}
