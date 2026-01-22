/**
 * Feature Flags Configuration
 *
 * Controls rollout of new features via environment variables.
 * All flags default to false in production for safe rollout.
 *
 * Rollout Strategy:
 * - Week 1: Internal Testing (all flags = true)
 * - Week 2: 10% Users (ANONYMOUS_AUTH = true)
 * - Week 3: 50% Users
 * - Week 4: 100% + TOURNAMENT_LIMIT
 *
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md
 */

/**
 * Feature flag configuration object.
 * Each flag can be controlled via environment variables.
 */
export const FEATURE_FLAGS = {
  /**
   * Enable anonymous Supabase authentication.
   * When enabled, guest users get a real Supabase anonymous user instead of localStorage-only.
   * This enables cloud sync for anonymous users.
   */
  ANONYMOUS_AUTH: import.meta.env.VITE_FF_ANON_AUTH === 'true',

  /**
   * Enable offline-first profile caching.
   * When enabled, user profiles are cached in IndexedDB for offline access.
   * Provides faster initial load and offline resilience.
   */
  OFFLINE_FIRST: import.meta.env.VITE_FF_OFFLINE === 'true',

  /**
   * Enable tournament limit for anonymous users.
   * When enabled, anonymous users are limited to 3 active tournaments.
   * Encourages registration for heavy users.
   */
  TOURNAMENT_LIMIT: import.meta.env.VITE_FF_LIMIT === 'true',

  /**
   * Enable account merge functionality.
   * When enabled, anonymous users can merge their data into existing accounts
   * when they try to register with an email that already exists.
   */
  MERGE_ACCOUNTS: import.meta.env.VITE_FF_MERGE === 'true',
} as const;

/**
 * Type for feature flag keys
 */
export type FeatureFlagKey = keyof typeof FEATURE_FLAGS;

/**
 * Check if a specific feature is enabled.
 *
 * @param flag - The feature flag to check
 * @returns true if the feature is enabled
 *
 * @example
 * ```typescript
 * if (isFeatureEnabled('ANONYMOUS_AUTH')) {
 *   await signInAnonymously();
 * } else {
 *   createLocalGuestUser();
 * }
 * ```
 */
export function isFeatureEnabled(flag: FeatureFlagKey): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Get all enabled feature flags (useful for debugging/logging).
 *
 * @returns Array of enabled feature flag names
 */
export function getEnabledFeatures(): FeatureFlagKey[] {
  return (Object.keys(FEATURE_FLAGS) as FeatureFlagKey[]).filter(
    (key) => FEATURE_FLAGS[key]
  );
}

/**
 * Log current feature flag status (for debugging).
 * Only logs in development mode.
 */
export function logFeatureFlags(): void {
  if (import.meta.env.DEV) {
    const status = Object.entries(FEATURE_FLAGS)
      .map(([key, value]) => `  ${key}: ${value ? 'Enabled' : 'Disabled'}`)
      .join('\n');
    console.warn(`[FeatureFlags] Current Status:\n${status}`);
  }
}
