/**
 * Centralized localStorage key constants
 *
 * Using constants instead of magic strings:
 * - Prevents typos
 * - Enables easy refactoring
 * - Provides single source of truth
 */

export const STORAGE_KEYS = {
  /** All tournaments list */
  TOURNAMENTS: 'tournaments',

  /** User profile data */
  USER_PROFILE: 'user-profile',

  /** Smart config settings */
  SMART_CONFIG: 'smart-config',

  /** Tournament creation wizard state prefix */
  WIZARD_PREFIX: 'tournament-wizard-state-',

  /** Live matches for a specific tournament */
  liveMatches: (tournamentId: string) => `liveMatches-${tournamentId}`,

  /** Tournament-specific data */
  tournament: (tournamentId: string) => `tournament-${tournamentId}`,
} as const;

/**
 * BroadcastChannel names for multi-tab communication
 */
export const BROADCAST_CHANNELS = {
  /** Match management sync between tabs */
  MATCH_MANAGEMENT: 'match-management',
} as const;
