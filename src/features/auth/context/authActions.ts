/**
 * Auth Actions
 *
 * Pure async functions for authentication operations.
 * Extracted from AuthContext.tsx for better testability and separation of concerns.
 *
 * @see AuthContext.tsx (original location)
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import { AUTH_ERRORS } from '../constants';
import type { User, Session, LoginResult, RegisterResult, ConnectionState } from '../types/auth.types';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { mapSupabaseUser, mapSupabaseSession, createLocalGuestUser, type ProfileData } from './authMapper';
import { migrateGuestTournaments } from '../services/guestMigrationService';
import { createAuthRetryService, isAbortError } from '../../../core/services';
import { clearProfileCache } from '../services/profileCacheService';
import { isFeatureEnabled } from '../../../config';
import { executeWithTimeout } from '../../../core/utils/SingleFlight';

/**
 * Timeout for auth operations (login, register, etc.)
 * Prevents indefinite hangs when Supabase is slow/unreachable (e.g., paused Free Tier project)
 */
const AUTH_OPERATION_TIMEOUT_MS = 15_000;

/**
 * Checks if an error is an Invalid Refresh Token error from Supabase.
 * These errors indicate the session is permanently invalid and cannot be recovered.
 */
export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('invalid refresh token') ||
      message.includes('refresh token not found') ||
      message.includes('refresh_token_not_found')
    );
  }
  return false;
}

/**
 * Clears all stale auth state from localStorage.
 * Call this when detecting an invalid refresh token to allow fresh login.
 */
export function clearStaleAuthState(): void {
  try {
    // Clear cached user profile
    safeLocalStorage.removeItem('auth:cachedUser');
    safeLocalStorage.removeItem('auth:guestUser');

    // Clear all Supabase auth tokens (pattern: sb-{project-ref}-auth-token)
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    }

    if (import.meta.env.DEV) {
      console.warn('[Auth] Cleared stale auth state due to invalid refresh token');
    }
  } catch {
    // localStorage not available
  }
}

/**
 * Dependencies required by auth actions
 */
export interface AuthActionDeps {
  fetchProfile: (userId: string) => Promise<ProfileData | null>;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setIsLoading: (loading: boolean) => void;
  updateAuthState: (session: SupabaseSession | null) => Promise<void>;
  getCurrentState: () => { user: User | null; isGuest: boolean };
}

// ============================================
// AUTH ACTIONS
// ============================================

/**
 * Register with email and password
 */
export async function register(
  deps: AuthActionDeps,
  name: string,
  email: string,
  password: string
): Promise<RegisterResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE_GUEST,
    };
  }

  // Capture reference for TypeScript narrowing inside callbacks
  const supabaseClient = supabase;

  try {
    // Check if current user is a guest (for migration)
    const { user, isGuest } = deps.getCurrentState();
    const wasGuest = isGuest && user?.globalRole === 'guest';

    // Wrap Supabase call with timeout to prevent indefinite hangs
    const { data, error } = await executeWithTimeout(
      () => supabaseClient.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          // Redirect to /#/auth/confirm for scanner protection (requires button click)
          // Note: HashRouter requires /#/ prefix for proper routing
          emailRedirectTo: `${window.location.origin}/#/auth/confirm?type=signup`,
        },
      }),
      AUTH_OPERATION_TIMEOUT_MS
    );

    if (error) {
      return {
        success: false,
        error: error.message === 'User already registered'
          ? AUTH_ERRORS.EMAIL_ALREADY_REGISTERED
          : error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: AUTH_ERRORS.REGISTRATION_FAILED,
      };
    }

    // NO MANUAL PROFILE UPDATE HERE!
    // Rely on DB Trigger (auth_hardening.sql) to create profile from metadata

    // Clear guest data
    if (wasGuest) {
      safeLocalStorage.removeItem('auth:guestUser');
    }

    // Get profile data (might need a small delay or retry if trigger is slow,
    // but usually fast enough for next render)
    const profileData = await deps.fetchProfile(data.user.id);
    const mappedUser = mapSupabaseUser(data.user, profileData);

    // Migrate any local guest tournaments to the new account
    let migrationResult = { migratedCount: 0 };
    try {
      migrationResult = await migrateGuestTournaments();
      if (import.meta.env.DEV && migrationResult.migratedCount > 0) {
        // eslint-disable-next-line no-console
        console.log(`Migrated ${migrationResult.migratedCount} tournament(s) after registration`);
      }
    } catch (migrationError) {
      if (import.meta.env.DEV) {
        console.error('Migration after registration failed:', migrationError);
      }
      // Don't fail the registration if migration fails
    }

    deps.setConnectionState('connected');

    return {
      success: true,
      user: mappedUser ?? undefined,
      session: data.session ? mapSupabaseSession(data.session) ?? undefined : undefined,
      wasMigrated: migrationResult.migratedCount > 0,
      migratedCount: migrationResult.migratedCount,
    };
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.message.includes('timed out')) {
      return {
        success: false,
        error: AUTH_ERRORS.CONNECTION_TIMEOUT,
      };
    }
    if (import.meta.env.DEV) {
      console.error('Register error:', err);
    }
    return {
      success: false,
      error: AUTH_ERRORS.UNEXPECTED,
    };
  }
}

/**
 * Login with email and password
 */
export async function login(
  deps: AuthActionDeps,
  email: string,
  password: string
): Promise<LoginResult> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE_GUEST,
    };
  }

  // Capture reference for TypeScript narrowing inside callbacks
  const supabaseClient = supabase;

  try {
    // Wrap Supabase call with timeout to prevent indefinite hangs
    // (e.g., paused Free Tier project cold start can take 30+ seconds)
    const { data, error } = await executeWithTimeout(
      () => supabaseClient.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      }),
      AUTH_OPERATION_TIMEOUT_MS
    );

    if (error) {
      // Use generic message for credential errors to prevent account enumeration
      // Attacker should not be able to tell if email exists or password is wrong
      const isCredentialError =
        error.message.includes('Invalid login credentials') ||
        error.message.includes('User not found') ||
        error.message.includes('invalid_credentials') ||
        error.message.includes('Email not confirmed');

      return {
        success: false,
        error: isCredentialError
          ? AUTH_ERRORS.INVALID_CREDENTIALS
          : error.message,
      };
    }

    // Clear guest data
    safeLocalStorage.removeItem('auth:guestUser');

    const profileData = await deps.fetchProfile(data.user.id);
    const mappedUser = mapSupabaseUser(data.user, profileData);

    // Migrate any local guest tournaments to the logged-in account
    let migrationResult = { migratedCount: 0 };
    try {
      migrationResult = await migrateGuestTournaments();
      if (import.meta.env.DEV && migrationResult.migratedCount > 0) {
        // eslint-disable-next-line no-console
        console.log(`Migrated ${migrationResult.migratedCount} tournament(s) after login`);
      }
    } catch (migrationError) {
      if (import.meta.env.DEV) {
        console.error('Migration after login failed:', migrationError);
      }
      // Don't fail the login if migration fails
    }

    deps.setConnectionState('connected');

    return {
      success: true,
      user: mappedUser ?? undefined,
      session: mapSupabaseSession(data.session) ?? undefined,
      wasMigrated: migrationResult.migratedCount > 0,
      migratedCount: migrationResult.migratedCount,
    };
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.message.includes('timed out')) {
      return {
        success: false,
        error: AUTH_ERRORS.CONNECTION_TIMEOUT,
      };
    }
    if (import.meta.env.DEV) {
      console.error('Login error:', err);
    }
    return {
      success: false,
      error: AUTH_ERRORS.UNEXPECTED,
    };
  }
}

/**
 * Send magic link email
 */
export async function sendMagicLink(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE_GUEST,
    };
  }

  // Capture reference for TypeScript narrowing inside callbacks
  const supabaseClient = supabase;

  try {
    // Wrap Supabase call with timeout to prevent indefinite hangs
    const { error } = await executeWithTimeout(
      () => supabaseClient.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          // Redirect to /#/auth/confirm for scanner protection (requires button click)
          // Note: HashRouter requires /#/ prefix for proper routing
          emailRedirectTo: `${window.location.origin}/#/auth/confirm?type=magiclink`,
        },
      }),
      AUTH_OPERATION_TIMEOUT_MS
    );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.message.includes('timed out')) {
      return {
        success: false,
        error: AUTH_ERRORS.CONNECTION_TIMEOUT,
      };
    }
    if (import.meta.env.DEV) {
      console.error('Magic link error:', err);
    }
    return {
      success: false,
      error: AUTH_ERRORS.UNEXPECTED,
    };
  }
}

/**
 * Login with Google OAuth
 */
export async function loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE_GUEST,
    };
  }

  // Capture reference for TypeScript narrowing inside callbacks
  const supabaseClient = supabase;

  try {
    // Wrap Supabase call with timeout to prevent indefinite hangs
    const { error } = await executeWithTimeout(
      () => supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/#/auth/callback`,
        },
      }),
      AUTH_OPERATION_TIMEOUT_MS
    );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // OAuth redirects, so success means redirect initiated
    return { success: true };
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.message.includes('timed out')) {
      return {
        success: false,
        error: AUTH_ERRORS.CONNECTION_TIMEOUT,
      };
    }
    if (import.meta.env.DEV) {
      console.error('Google login error:', err);
    }
    return {
      success: false,
      error: AUTH_ERRORS.UNEXPECTED,
    };
  }
}

/**
 * Logout
 */
export async function logout(deps: AuthActionDeps): Promise<void> {
  // Clear local state even if Supabase is not configured
  if (!isSupabaseConfigured || !supabase) {
    safeLocalStorage.removeItem('auth:guestUser');
    safeLocalStorage.removeItem('auth:cachedUser'); // BUG-004: Also clear cached user
    void clearProfileCache(); // Also clear IndexedDB cache
    deps.setUser(null);
    deps.setSession(null);
    deps.setIsGuest(false);
    return;
  }

  try {
    await supabase.auth.signOut();
    safeLocalStorage.removeItem('auth:guestUser');
    safeLocalStorage.removeItem('auth:cachedUser'); // BUG-004: Also clear cached user
    void clearProfileCache(); // Also clear IndexedDB cache
    deps.setUser(null);
    deps.setSession(null);
    deps.setIsGuest(false);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Logout error:', err);
    }
  }
}

/**
 * Continue as guest
 *
 * Strategy:
 * 1. If Supabase is configured, try signInAnonymously() for cloud sync
 * 2. If Supabase not available or signInAnonymously fails, fall back to local guest
 *
 * Anonymous users vs Local guests:
 * - Anonymous: Real Supabase auth.users entry, can sync to cloud, can later claim account
 * - Local guest: localStorage only, no cloud sync, cannot claim account
 */
export async function continueAsGuest(deps: AuthActionDeps): Promise<User> {
  // Only use anonymous Supabase auth if ANONYMOUS_AUTH feature flag is enabled
  // AND Supabase is configured
  if (isFeatureEnabled('ANONYMOUS_AUTH') && isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();

      if (!error && data.user) {
        // Successfully created anonymous Supabase user
        const profileData = await deps.fetchProfile(data.user.id);
        const mappedUser = mapSupabaseUser(data.user, profileData);

        if (mappedUser) {
          // Clear any existing guest user data
          safeLocalStorage.removeItem('auth:guestUser');

          deps.setUser(mappedUser);
          deps.setSession(data.session ? mapSupabaseSession(data.session) : null);
          deps.setIsGuest(false); // Not a local guest, but an anonymous Supabase user
          deps.setConnectionState('connected');

          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log('Created anonymous Supabase user:', mappedUser.id);
          }

          return mappedUser;
        }
      }

      // signInAnonymously failed, fall through to local guest
      if (import.meta.env.DEV) {
        console.warn('signInAnonymously failed, falling back to local guest:', error?.message);
      }
    } catch (err) {
      // Unexpected error, fall through to local guest
      if (import.meta.env.DEV) {
        console.warn('Anonymous auth error, falling back to local guest:', err);
      }
    }
  }

  // Fall back to local guest (no cloud sync)
  const guestUser = createLocalGuestUser();
  safeLocalStorage.setItem('auth:guestUser', JSON.stringify(guestUser));
  deps.setUser(guestUser);
  deps.setSession(null);
  deps.setIsGuest(true);
  return guestUser;
}

/**
 * Refresh auth state
 */
export async function refreshAuth(deps: AuthActionDeps): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    // Just re-check guest state
    await deps.updateAuthState(null);
    return;
  }

  deps.setIsLoading(true);
  try {
    const { data: { session: currentSession } } = await supabase.auth.getSession();
    deps.setConnectionState('connected');
    await deps.updateAuthState(currentSession);
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Refresh auth error:', err);
    }
    deps.setConnectionState('offline');
    deps.setIsLoading(false);
  }
}

/**
 * Shared RetryService instance for auth reconnection
 */
const authRetryService = createAuthRetryService();

/**
 * Manually trigger reconnection attempt with retry logic
 *
 * Uses exponential backoff for transient failures.
 * AbortErrors are not retried (handled by browser event system).
 *
 * @returns true if reconnection succeeded, false otherwise
 */
export async function reconnect(deps: AuthActionDeps): Promise<boolean> {
  if (!isSupabaseConfigured || !supabase) {
    return false;
  }

  // Capture supabase reference for TypeScript narrowing inside callback
  const supabaseClient = supabase;

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('Manual reconnect triggered');
  }
  deps.setConnectionState('connecting');

  try {
    const session = await authRetryService.execute(
      async () => {
        const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
        return currentSession;
      },
      {
        shouldRetry: (error) => {
          // Don't retry AbortErrors - these are transient and will be
          // retried via the browser online event or periodic retry
          if (isAbortError(error)) {
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console
              console.debug('Reconnect aborted (transient), skipping retry');
            }
            return false;
          }
          // Don't retry Invalid Refresh Token errors - session is permanently invalid
          if (isInvalidRefreshTokenError(error)) {
            if (import.meta.env.DEV) {
              console.warn('[Auth] Invalid refresh token detected, clearing stale state');
            }
            clearStaleAuthState();
            return false;
          }
          return true;
        },
        onRetry: (attempt, _error, delayMs) => {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log(`Reconnect attempt ${attempt}, next retry in ${delayMs}ms`);
          }
        },
        onSuccess: (_result, attempts) => {
          if (import.meta.env.DEV) {
            // eslint-disable-next-line no-console
            console.log(`Reconnect successful after ${attempts} attempt(s)`);
          }
        },
      }
    );

    deps.setConnectionState('connected');
    await deps.updateAuthState(session);
    return true;
  } catch (err) {
    // Handle invalid refresh token - clear state and allow fresh login
    if (isInvalidRefreshTokenError(err)) {
      if (import.meta.env.DEV) {
        console.warn('[Auth] Session expired, clearing auth state for fresh login');
      }
      clearStaleAuthState();
      deps.setUser(null);
      deps.setSession(null);
      deps.setIsGuest(false);
      deps.setConnectionState('connected'); // Not 'offline' - Supabase is reachable, just need re-auth
      return false;
    }

    // Only log non-abort errors as actual errors
    if (err instanceof Error && isAbortError(err)) {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.debug('Reconnect aborted (transient):', err.message);
      }
    } else {
      if (import.meta.env.DEV) {
        console.error('Manual reconnect failed:', err);
      }
    }
    deps.setConnectionState('offline');
    return false;
  }
}

/**
 * Get the current state of the auth retry service
 * Useful for displaying retry status in UI
 */
export function getReconnectState() {
  return authRetryService.getState();
}

/**
 * Reset the reconnect retry state
 * Call this when manually canceling a reconnect attempt
 */
export function resetReconnectState(): void {
  authRetryService.reset();
}

/**
 * Send password reset email
 */
export async function resetPassword(
  email: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE,
    };
  }

  // Capture reference for TypeScript narrowing inside callbacks
  const supabaseClient = supabase;

  try {
    // Wrap Supabase call with timeout to prevent indefinite hangs
    const { error } = await executeWithTimeout(
      () => supabaseClient.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        {
          // Redirect to /#/auth/confirm for scanner protection (requires button click)
          // Note: HashRouter requires /#/ prefix for proper routing
          redirectTo: `${window.location.origin}/#/auth/confirm?type=recovery`,
        }
      ),
      AUTH_OPERATION_TIMEOUT_MS
    );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    // Handle timeout specifically
    if (err instanceof Error && err.message.includes('timed out')) {
      return {
        success: false,
        error: AUTH_ERRORS.CONNECTION_TIMEOUT,
      };
    }
    if (import.meta.env.DEV) {
      console.error('Reset password error:', err);
    }
    return {
      success: false,
      error: AUTH_ERRORS.UNEXPECTED,
    };
  }
}

/**
 * Update user profile
 */
export async function updateProfile(
  deps: AuthActionDeps,
  updates: { name?: string; avatarUrl?: string }
): Promise<{ success: boolean; error?: string }> {
  const { user, isGuest } = deps.getCurrentState();

  if (!user || isGuest) {
    return { success: false, error: AUTH_ERRORS.NOT_LOGGED_IN };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE };
  }

  try {
    const profileUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return { success: false, error: AUTH_ERRORS.NAME_LENGTH_INVALID };
      }
      profileUpdates.display_name = trimmedName;
    }

    if (updates.avatarUrl !== undefined) {
      profileUpdates.avatar_url = updates.avatarUrl;
    }

    const { error } = await supabase
      .from('profiles')
      .update(profileUpdates as { display_name?: string; avatar_url?: string })
      .eq('id', user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    // Update local state
    deps.setUser({
      ...user,
      name: updates.name?.trim() ?? user.name,
      avatarUrl: updates.avatarUrl ?? user.avatarUrl,
      updatedAt: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Update profile error:', err);
    }
    return { success: false, error: AUTH_ERRORS.UNEXPECTED };
  }
}

/**
 * Update password (after password recovery)
 */
export async function updatePassword(
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  if (!isSupabaseConfigured || !supabase) {
    return {
      success: false,
      error: AUTH_ERRORS.CLOUD_NOT_AVAILABLE,
    };
  }

  // Validate password
  if (newPassword.length < 6) {
    return {
      success: false,
      error: AUTH_ERRORS.PASSWORD_TOO_SHORT,
    };
  }

  try {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      return {
        success: false,
        error: error.message === 'New password should be different from the old password.'
          ? AUTH_ERRORS.PASSWORD_SAME_AS_OLD
          : error.message,
      };
    }

    return { success: true };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Update password error:', err);
    }
    return {
      success: false,
      error: AUTH_ERRORS.UNEXPECTED,
    };
  }
}
