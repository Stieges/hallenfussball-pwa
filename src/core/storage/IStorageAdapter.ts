/**
 * IStorageAdapter - Storage abstraction interface
 *
 * Provides a unified interface for different storage backends:
 * - IndexedDB (primary) - No 5MB limit, supports large tournaments
 * - localStorage (fallback) - 5MB limit, broad compatibility
 *
 * All methods are async to support IndexedDB's async API.
 * localStorage adapter wraps sync operations in Promises for consistency.
 *
 * @example
 * ```typescript
 * const storage = await createStorage(); // Auto-detects best available
 * await storage.set('tournaments', tournamentData);
 * const data = await storage.get<Tournament[]>('tournaments');
 * ```
 */

export interface IStorageAdapter {
  /**
   * Retrieve a value by key
   * @param key Storage key
   * @returns Parsed value or null if not found
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Store a value by key
   * @param key Storage key
   * @param value Value to store (will be JSON serialized)
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Delete a value by key
   * @param key Storage key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all stored data
   * WARNING: Use with caution - removes all keys
   */
  clear(): Promise<void>;

  /**
   * List all stored keys
   * @returns Array of storage keys
   */
  keys(): Promise<string[]>;
}
