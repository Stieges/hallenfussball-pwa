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
import type { User, Session, LoginResult, RegisterResult, ConnectionState } from '../types/auth.types';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { mapSupabaseUser, mapSupabaseSession, createLocalGuestUser, type ProfileData } from './authMapper';
import { migrateGuestTournaments } from '../services/guestMigrationService';
import { createAuthRetryService, isAbortError } from '../../../core/services';

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
      error: 'Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.',
    };
  }

  try {
    // Check if current user is a guest (for migration)
    const { user, isGuest } = deps.getCurrentState();
    const wasGuest = isGuest && user?.globalRole === 'guest';

    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: name.trim(),
        },
        // Redirect to /auth/confirm for scanner protection (requires button click)
        emailRedirectTo: `${window.location.origin}/auth/confirm?type=signup`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message === 'User already registered'
          ? 'Diese E-Mail ist bereits registriert.'
          : error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Registrierung fehlgeschlagen.',
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
    if (import.meta.env.DEV) {
      console.error('Register error:', err);
    }
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
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
      error: 'Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

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
          ? 'E-Mail oder Passwort ist falsch.'
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
    if (import.meta.env.DEV) {
      console.error('Login error:', err);
    }
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
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
      error: 'Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        // Redirect to /auth/confirm for scanner protection (requires button click)
        emailRedirectTo: `${window.location.origin}/auth/confirm?type=magiclink`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Magic link error:', err);
    }
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
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
      error: 'Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.',
    };
  }

  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/#/auth/callback`,
      },
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // OAuth redirects, so success means redirect initiated
    return { success: true };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Google login error:', err);
    }
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
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
    deps.setUser(null);
    deps.setSession(null);
    deps.setIsGuest(false);
    return;
  }

  try {
    await supabase.auth.signOut();
    safeLocalStorage.removeItem('auth:guestUser');
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
 * Continue as guest (local only, no Supabase)
 */
export function continueAsGuest(deps: AuthActionDeps): User {
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
      error: 'Cloud-Funktionen sind nicht verfügbar.',
    };
  }

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        // Redirect to /auth/confirm for scanner protection (requires button click)
        redirectTo: `${window.location.origin}/auth/confirm?type=recovery`,
      }
    );

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return { success: true };
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Reset password error:', err);
    }
    return {
      success: false,
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
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
    return { success: false, error: 'Nicht angemeldet.' };
  }

  if (!isSupabaseConfigured || !supabase) {
    return { success: false, error: 'Cloud-Funktionen sind nicht verfügbar.' };
  }

  try {
    const profileUpdates: Record<string, unknown> = {};

    if (updates.name !== undefined) {
      const trimmedName = updates.name.trim();
      if (trimmedName.length < 2 || trimmedName.length > 100) {
        return { success: false, error: 'Name muss 2-100 Zeichen haben.' };
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
    return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
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
      error: 'Cloud-Funktionen sind nicht verfügbar.',
    };
  }

  // Validate password
  if (newPassword.length < 6) {
    return {
      success: false,
      error: 'Passwort muss mindestens 6 Zeichen haben.',
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
          ? 'Das neue Passwort muss sich vom alten unterscheiden.'
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
      error: 'Ein unerwarteter Fehler ist aufgetreten.',
    };
  }
}
