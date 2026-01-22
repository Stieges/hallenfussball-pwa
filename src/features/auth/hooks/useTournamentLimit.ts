/**
 * useTournamentLimit Hook
 *
 * Provides tournament creation limit information for anonymous users.
 * Anonymous users are limited to 3 active tournaments.
 * Authenticated users have unlimited tournaments.
 *
 * @see AUTH-KONZEPT-ERWEITERT.md - Section on anonymous user limits
 */

import { useMemo } from 'react';
import { useAuth } from './useAuth';
import { useTournaments } from '../../../hooks/useTournaments';
import { isFeatureEnabled } from '../../../config';

/**
 * Tournament limit for anonymous users
 * This matches the RLS policy in 005_anonymous_limit.sql
 */
export const ANONYMOUS_TOURNAMENT_LIMIT = 3;

/**
 * Return type for useTournamentLimit hook
 */
export interface UseTournamentLimitReturn {
  /**
   * True if user is subject to tournament limits (anonymous users)
   */
  isLimited: boolean;

  /**
   * Maximum number of tournaments allowed (3 for anonymous, Infinity for authenticated)
   */
  limit: number;

  /**
   * Number of active tournaments currently owned by the user
   */
  used: number;

  /**
   * Number of tournaments the user can still create
   */
  remaining: number;

  /**
   * True if the user can create a new tournament
   */
  canCreate: boolean;

  /**
   * True if user is approaching the limit (2 or more used)
   */
  isNearLimit: boolean;

  /**
   * True if user has hit the limit
   */
  isAtLimit: boolean;

  /**
   * Loading state (while tournaments are being fetched)
   */
  isLoading: boolean;
}

/**
 * Hook for checking tournament creation limits
 *
 * @example
 * ```tsx
 * const { canCreate, remaining, isLimited } = useTournamentLimit();
 *
 * if (!canCreate) {
 *   return <TournamentLimitModal />;
 * }
 *
 * if (isLimited && remaining === 1) {
 *   // Show warning about last slot
 * }
 * ```
 */
export function useTournamentLimit(): UseTournamentLimitReturn {
  const { user, isAnonymous } = useAuth();
  const { activeTournaments, loading } = useTournaments();

  return useMemo(() => {
    // Only apply limits if TOURNAMENT_LIMIT feature flag is enabled
    // When disabled, all users have unlimited tournaments
    if (!isFeatureEnabled('TOURNAMENT_LIMIT')) {
      return {
        isLimited: false,
        limit: Infinity,
        used: activeTournaments.length,
        remaining: Infinity,
        canCreate: true,
        isNearLimit: false,
        isAtLimit: false,
        isLoading: loading,
      };
    }

    // Anonymous Supabase users are limited
    // Local guests (globalRole='guest') are also limited since they can't sync anyway
    const isLimited = isAnonymous || user?.globalRole === 'guest';

    // Determine limit
    const limit = isLimited ? ANONYMOUS_TOURNAMENT_LIMIT : Infinity;

    // Count active (non-deleted) tournaments
    // activeTournaments already filters out deletedAt !== undefined
    const used = activeTournaments.length;

    // Calculate remaining
    const remaining = Math.max(0, limit - used);

    // Can create if below limit
    const canCreate = remaining > 0;

    // Near limit: 2+ tournaments for anonymous (only 1 left)
    const isNearLimit = isLimited && used >= ANONYMOUS_TOURNAMENT_LIMIT - 1;

    // At limit: all 3 slots used
    const isAtLimit = isLimited && used >= ANONYMOUS_TOURNAMENT_LIMIT;

    return {
      isLimited,
      limit,
      used,
      remaining,
      canCreate,
      isNearLimit,
      isAtLimit,
      isLoading: loading,
    };
  }, [user, isAnonymous, activeTournaments, loading]);
}

export default useTournamentLimit;
