export interface IStorageAdapter {
  /**
   * Get a value from storage.
   * @param key The key to retrieve.
   * @returns The value or null if not found.
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set a value in storage.
   * @param key The key to set.
   * @param value The value to store.
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Delete a value from storage.
   * @param key The key to delete.
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all values from storage.
   */
  clear(): Promise<void>;

  /**
   * Get all keys in storage.
   */
  keys(): Promise<string[]>;
}
