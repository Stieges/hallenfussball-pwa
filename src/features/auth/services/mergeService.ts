/**
 * Merge Service - Account merge functionality
 *
 * Handles merging anonymous user data into an existing authenticated account.
 * Used when an anonymous user tries to register with an email that already exists.
 *
 * Flow:
 * 1. Anonymous user attempts to register with existing email
 * 2. System detects conflict and offers merge option
 * 3. User logs into existing account
 * 4. This service calls the merge Edge Function
 * 5. All data from anonymous account is transferred to existing account
 *
 * @see docs/concepts/AUTH-KONZEPT-ERWEITERT.md - Section on Merge & Claim
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { isFeatureEnabled } from '../../../config';

/**
 * Result of a merge operation
 */
export interface MergeResult {
  success: boolean;
  /** Number of tournaments transferred */
  tournamentsMerged?: number;
  error?: string;
}

/**
 * Checks if an email is already registered in the system.
 *
 * Note: This uses the profiles table, not auth.users directly,
 * as we don't have direct access to auth.users from the client.
 *
 * @param email - The email to check
 * @returns true if email exists, false otherwise
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  // Only check if MERGE_ACCOUNTS feature flag is enabled
  if (!isFeatureEnabled('MERGE_ACCOUNTS')) {
    return false;
  }

  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle();

    if (error) {
      if (import.meta.env.DEV) { console.error('[MergeService] Error checking email:', error); }
      return false;
    }

    return data !== null;
  } catch (error) {
    if (import.meta.env.DEV) { console.error('[MergeService] Error checking email:', error); }
    return false;
  }
}

/**
 * Merges an anonymous user's data into the currently authenticated user's account.
 *
 * Prerequisites:
 * - User must be authenticated with the TARGET account (non-anonymous)
 * - anonymousUserId must be a valid anonymous user ID
 *
 * @param anonymousUserId - The ID of the anonymous user whose data should be transferred
 * @returns MergeResult with success status and number of tournaments merged
 *
 * @example
 * ```typescript
 * // After user logs into existing account
 * const result = await mergeAccounts(previousAnonymousUserId);
 * if (result.success) {
 *   showSuccess(`${result.tournamentsMerged} Turniere übertragen!`);
 * } else {
 *   showError(result.error);
 * }
 * ```
 */
export async function mergeAccounts(anonymousUserId: string): Promise<MergeResult> {
  // Only merge if MERGE_ACCOUNTS feature flag is enabled
  if (!isFeatureEnabled('MERGE_ACCOUNTS')) {
    return {
      success: false,
      error: 'Kontenzusammenführung ist nicht aktiviert',
    };
  }

  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: 'Cloud-Funktionen sind nicht verfügbar',
    };
  }

  if (!anonymousUserId) {
    return {
      success: false,
      error: 'Keine anonyme Benutzer-ID angegeben',
    };
  }

  try {
    // Get current session for auth header
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return {
        success: false,
        error: 'Nicht angemeldet',
      };
    }

    // Call the Edge Function
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { data, error } = await supabase.functions.invoke<MergeResult>('merge-accounts', {
      body: { anonymousUserId },
    });

    if (error) {
      if (import.meta.env.DEV) { console.error('[MergeService] Edge function error:', error); }
      // Extract error message from FunctionsError
      // FunctionsError has a message property, but we use safe access pattern
      const errorMsg = (error as { message?: string }).message ?? 'Fehler beim Zusammenführen der Konten';
      return {
        success: false,
        error: errorMsg,
      };
    }

    // Check if we got a valid response
    if (!data) {
      return {
        success: false,
        error: 'Keine Antwort vom Server erhalten',
      };
    }

    // Parse response - data is typed as MergeResult from invoke generic
    const response = data;

    if (!response.success) {
      return {
        success: false,
        error: response.error ?? 'Unbekannter Fehler beim Zusammenführen',
      };
    }

    return {
      success: true,
      tournamentsMerged: response.tournamentsMerged ?? 0,
    };
  } catch (error) {
    if (import.meta.env.DEV) { console.error('[MergeService] Error merging accounts:', error); }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unbekannter Fehler',
    };
  }
}

/**
 * Stores the anonymous user ID temporarily for later merge.
 * Used when user needs to log into existing account before merge.
 *
 * @param userId - The anonymous user ID to store
 */
export function storeAnonymousUserIdForMerge(userId: string): void {
  try {
    sessionStorage.setItem('auth:pendingMergeUserId', userId);
  } catch {
    // sessionStorage not available
  }
}

/**
 * Retrieves and clears the stored anonymous user ID.
 *
 * @returns The stored anonymous user ID, or null if not set
 */
export function getPendingMergeUserId(): string | null {
  try {
    const userId = sessionStorage.getItem('auth:pendingMergeUserId');
    if (userId) {
      sessionStorage.removeItem('auth:pendingMergeUserId');
    }
    return userId;
  } catch {
    return null;
  }
}

/**
 * Clears any pending merge data.
 */
export function clearPendingMerge(): void {
  try {
    sessionStorage.removeItem('auth:pendingMergeUserId');
  } catch {
    // sessionStorage not available
  }
}
