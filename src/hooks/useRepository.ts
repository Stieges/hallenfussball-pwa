/**
 * useRepository Hook
 *
 * Factory hook that returns the appropriate repository implementation
 * based on user authentication status:
 * - Authenticated users → SupabaseRepository (cloud sync)
 * - Guest users → LocalStorageRepository (local only)
 *
 * This enables seamless switching between storage backends
 * while maintaining the same API through ITournamentRepository.
 */

import { useMemo } from 'react';
import { useAuth } from '../features/auth/hooks';
import { ITournamentRepository } from '../core/repositories/ITournamentRepository';
import { LocalStorageRepository } from '../core/repositories/LocalStorageRepository';
import { SupabaseRepository } from '../core/repositories/SupabaseRepository';

// Singleton instances to avoid recreating on every render
let localStorageRepo: LocalStorageRepository | null = null;
let supabaseRepo: SupabaseRepository | null = null;

function getLocalStorageRepository(): LocalStorageRepository {
  if (!localStorageRepo) {
    localStorageRepo = new LocalStorageRepository();
  }
  return localStorageRepo;
}

function getSupabaseRepository(): SupabaseRepository {
  if (!supabaseRepo) {
    supabaseRepo = new SupabaseRepository();
  }
  return supabaseRepo;
}

/**
 * Hook to get the appropriate tournament repository
 *
 * @returns ITournamentRepository - LocalStorage for guests, Supabase for authenticated users
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const repository = useRepository();
 *
 *   const loadTournament = async (id: string) => {
 *     const tournament = await repository.get(id);
 *     // ...
 *   };
 * }
 * ```
 */
export function useRepository(): ITournamentRepository {
  const { isGuest, isAuthenticated } = useAuth();

  const repository = useMemo(() => {
    // Use Supabase for authenticated users, localStorage for guests
    if (isAuthenticated && !isGuest) {
      return getSupabaseRepository();
    }
    return getLocalStorageRepository();
  }, [isAuthenticated, isGuest]);

  return repository;
}

/**
 * Get repository instance outside of React components
 * Useful for services and utilities
 *
 * @param isAuthenticated - Whether user is authenticated with Supabase
 * @param isGuest - Whether user is in guest mode
 */
export function getRepository(
  isAuthenticated: boolean,
  isGuest: boolean
): ITournamentRepository {
  if (isAuthenticated && !isGuest) {
    return getSupabaseRepository();
  }
  return getLocalStorageRepository();
}

/**
 * Get the SupabaseRepository directly
 * Use this for Supabase-specific operations like listForCurrentUser()
 */
export function getSupabaseRepo(): SupabaseRepository {
  return getSupabaseRepository();
}

/**
 * Get the LocalStorageRepository directly
 * Use this for local-only operations
 */
export function getLocalStorageRepo(): LocalStorageRepository {
  return getLocalStorageRepository();
}

/**
 * Reset singleton instances (useful for testing)
 */
export function resetRepositories(): void {
  localStorageRepo = null;
  supabaseRepo = null;
}

export default useRepository;
