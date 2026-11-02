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

  /**
   * Turniergrafiken (Turnierlogo, zweite Grafik) nur auf diesem Gerät (@W3-030, PDF-Paket T3). Eigener Schlüssel je
   * Turnier-ID, nie im Turnier-Objekt und nie in `TOURNAMENTS`: so kennt kein Mapper und kein Abgleich mit der Cloud ihn.
   */
  tournamentGraphics: (tournamentId: string) => `tournament-graphics-${tournamentId}`,
} as const;

/**
 * BroadcastChannel names for multi-tab communication
 */
export const BROADCAST_CHANNELS = {
  /** Match management sync between tabs */
  MATCH_MANAGEMENT: 'match-management',
  /** Engine meldet geaenderte Spiel-Kopien an andere Tabs (W10); der Monitor im selben Browser hoert mit (R5, @ZM-179). */
  MATCH_ENGINE: 'hallenfussball-matches',
} as const;
