/**
 * Auth Helpers - Utility functions for authentication
 *
 * Provides helper functions for checking auth provider, detecting OAuth-only
 * users, and other auth-related utilities.
 *
 * @see docs/concepts/SUPABASE-BEST-PRACTICES.md
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { User } from '../types/auth.types';
import { AUTH_STORAGE_KEYS } from '../types/auth.types';

/**
 * Auth provider types
 */
export type AuthProvider = 'email' | 'google' | 'github' | 'apple' | 'unknown';

/**
 * Result of OAuth check
 */
export interface OAuthCheckResult {
  isOAuthOnly: boolean;
  provider: AuthProvider;
  error?: string;
}

/**
 * Checks if a user was registered via OAuth (no password set)
 *
 * This is used to prevent "ghost passwords" - when an OAuth user
 * tries to use "forgot password" and accidentally creates a password.
 *
 * @param email - The email address to check
 * @returns OAuthCheckResult indicating if user is OAuth-only
 */
export async function checkOAuthOnlyUser(email: string): Promise<OAuthCheckResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { isOAuthOnly: false, provider: 'unknown', error: 'Supabase not configured' };
  }

  try {
    // Query the profiles table for auth_provider
    // This column is set by the handle_new_user trigger
    const { data, error } = await supabase
      .from('profiles')
      .select('auth_provider')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error) {
      // PGRST116 = no rows found - user doesn't exist
      if (error.code === 'PGRST116') {
        return { isOAuthOnly: false, provider: 'unknown', error: 'User not found' };
      }

      console.error('[authHelpers] checkOAuthOnlyUser error:', error);

      // Handle network errors specifically
      if (error.message && (error.message.includes('fetch') || error.message.includes('network'))) {
        return { isOAuthOnly: false, provider: 'unknown', error: 'Network error during check' };
      }

      return { isOAuthOnly: false, provider: 'unknown', error: error.message };
    }

    const provider = (data.auth_provider ?? 'email') as AuthProvider;

    // OAuth-only if provider is NOT 'email'
    const isOAuthOnly = provider !== 'email' && provider !== 'unknown';

    return { isOAuthOnly, provider };
  } catch (err) {
    console.error('[authHelpers] checkOAuthOnlyUser exception:', err);
    // Determine if it's a fetch error
    const message = err instanceof Error ? err.message : 'Unexpected error';
    if (message.includes('fetch') || message.includes('Load failed')) {
      return { isOAuthOnly: false, provider: 'unknown', error: 'Network error during check' };
    }
    return { isOAuthOnly: false, provider: 'unknown', error: message };
  }
}

/**
 * Gets user-friendly name for auth provider
 *
 * @param provider - The auth provider
 * @returns Localized provider name
 */
export function getProviderDisplayName(provider: AuthProvider): string {
  switch (provider) {
    case 'google':
      return 'Google';
    case 'github':
      return 'GitHub';
    case 'apple':
      return 'Apple';
    case 'email':
      return 'E-Mail';
    default:
      return 'Unbekannt';
  }
}

/**
 * Builds a user-friendly message for OAuth-only users attempting password reset
 *
 * @param provider - The OAuth provider the user registered with
 * @returns Localized message
 */
export function getOAuthPasswordResetMessage(provider: AuthProvider): string {
  const providerName = getProviderDisplayName(provider);
  return `Dieses Konto verwendet ${providerName}-Anmeldung. Bitte melde dich mit ${providerName} an statt ein Passwort zu setzen.`;
}

/**
 * Checks if a user has a password set (can use email/password login)
 *
 * Note: This is a best-effort check based on auth_provider.
 * Users who registered via OAuth and later added a password
 * may still show as OAuth-only until we track this separately.
 *
 * @param email - The email address to check
 * @returns true if user can log in with password
 */
export async function userHasPassword(email: string): Promise<boolean> {
  const result = await checkOAuthOnlyUser(email);
  return !result.isOAuthOnly;
}

// ============================================
// LEGACY USER LOOKUP (localStorage-based)
// ============================================

/**
 * Gets all users from localStorage (legacy storage)
 *
 * @deprecated This is for backwards compatibility with localStorage-based users.
 * New code should use Supabase for user data.
 */
const getLegacyUsers = (): User[] => {
  try {
    const usersJson = localStorage.getItem(AUTH_STORAGE_KEYS.USERS);
    return usersJson ? (JSON.parse(usersJson) as User[]) : [];
  } catch {
    return [];
  }
};

/**
 * Finds a user by ID from localStorage (legacy storage)
 *
 * @deprecated This is for backwards compatibility with localStorage-based users.
 * New code should use Supabase profiles table.
 *
 * @param userId - The user ID to look up
 * @returns User or null if not found
 */
export const getUserById = (userId: string): User | null => {
  const users = getLegacyUsers();
  return users.find((u) => u.id === userId) ?? null;
};
