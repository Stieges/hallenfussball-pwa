/**
 * Profile Cache Service - IndexedDB-based offline profile caching
 *
 * Caches user profile data for offline access.
 * IMPORTANT: Only caches profile data, NOT JWT/session tokens.
 *
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md - Section on offline-first
 */

import { IndexedDBAdapter } from '../../../core/storage/IndexedDBAdapter';
import { User } from '../types/auth.types';

// Storage key for cached profile
const PROFILE_CACHE_KEY = 'auth:cachedProfile';

// Cache validity duration: 30 days
const CACHE_VALIDITY_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Cached profile data structure
 */
interface CachedProfile {
  user: User;
  cachedAt: string; // ISO 8601
}

// Singleton adapter instance
let adapter: IndexedDBAdapter | null = null;
let initPromise: Promise<void> | null = null;

/**
 * Gets the initialized IndexedDB adapter
 */
async function getAdapter(): Promise<IndexedDBAdapter> {
  adapter ??= new IndexedDBAdapter();
  initPromise ??= adapter.init();
  await initPromise;
  return adapter;
}

/**
 * Caches a user profile in IndexedDB for offline access.
 *
 * @param user - The user profile to cache
 *
 * @example
 * ```typescript
 * await cacheUserProfile(currentUser);
 * ```
 */
export async function cacheUserProfile(user: User): Promise<void> {
  try {
    const db = await getAdapter();
    const cachedData: CachedProfile = {
      user,
      cachedAt: new Date().toISOString(),
    };
    await db.set(PROFILE_CACHE_KEY, cachedData);
  } catch (error) {
    // Silently fail - caching is not critical
    console.warn('[ProfileCache] Failed to cache profile:', error);
  }
}

/**
 * Retrieves a cached user profile from IndexedDB.
 * Returns null if no cache exists or cache is expired.
 *
 * @param ignoreExpiry - If true, returns cached profile even if expired (useful for offline)
 *
 * @example
 * ```typescript
 * const cachedUser = await getCachedProfile();
 * if (cachedUser) {
 *   // Use cached profile while fetching fresh data
 * }
 * ```
 */
export async function getCachedProfile(ignoreExpiry = false): Promise<User | null> {
  try {
    const db = await getAdapter();
    const cachedData = await db.get<CachedProfile>(PROFILE_CACHE_KEY);

    if (!cachedData) {
      return null;
    }

    // Check cache validity (unless ignoring expiry)
    if (!ignoreExpiry) {
      const cachedAt = new Date(cachedData.cachedAt).getTime();
      const now = Date.now();
      if (now - cachedAt > CACHE_VALIDITY_MS) {
        // Cache expired, clear it
        await clearProfileCache();
        return null;
      }
    }

    return cachedData.user;
  } catch (error) {
    // Silently fail - just return null
    console.warn('[ProfileCache] Failed to retrieve cached profile:', error);
    return null;
  }
}

/**
 * Clears the cached profile from IndexedDB.
 * Should be called on logout.
 *
 * @example
 * ```typescript
 * const handleLogout = async () => {
 *   await clearProfileCache();
 *   // ... rest of logout logic
 * };
 * ```
 */
export async function clearProfileCache(): Promise<void> {
  try {
    const db = await getAdapter();
    await db.delete(PROFILE_CACHE_KEY);
  } catch (error) {
    // Silently fail - clearing is not critical
    console.warn('[ProfileCache] Failed to clear profile cache:', error);
  }
}

/**
 * Updates specific fields in the cached profile.
 * Useful for partial updates without fetching full profile.
 *
 * @param updates - Partial user data to merge into cached profile
 *
 * @example
 * ```typescript
 * await updateCachedProfile({ name: 'New Name' });
 * ```
 */
export async function updateCachedProfile(updates: Partial<User>): Promise<void> {
  try {
    const cachedUser = await getCachedProfile(true);
    if (!cachedUser) {
      return;
    }

    const updatedUser: User = {
      ...cachedUser,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await cacheUserProfile(updatedUser);
  } catch (error) {
    console.warn('[ProfileCache] Failed to update cached profile:', error);
  }
}

/**
 * Checks if a valid cached profile exists.
 *
 * @param ignoreExpiry - If true, considers expired cache as valid
 */
export async function hasCachedProfile(ignoreExpiry = false): Promise<boolean> {
  const profile = await getCachedProfile(ignoreExpiry);
  return profile !== null;
}

/**
 * Gets the timestamp when the profile was last cached.
 *
 * @returns ISO 8601 timestamp or null if no cache
 */
export async function getCacheTimestamp(): Promise<string | null> {
  try {
    const db = await getAdapter();
    const cachedData = await db.get<CachedProfile>(PROFILE_CACHE_KEY);
    return cachedData?.cachedAt ?? null;
  } catch {
    return null;
  }
}
