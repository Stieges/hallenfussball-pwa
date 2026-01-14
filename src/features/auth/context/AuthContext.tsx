/**
 * AuthContext - React Context für Auth-State
 *
 * Phase 2: Supabase Auth Integration
 *
 * Features:
 * - Email/Password Login
 * - Magic Link (passwordless)
 * - Google OAuth
 * - Guest Mode (local only)
 * - Profile Management via profiles table
 *
 * @see docs/concepts/ANMELDUNG-KONZEPT.md
 * @see docs/concepts/SUPABASE-SCHEMA-KONZEPT.md
 */

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { User as SupabaseUser, Session as SupabaseSession, AuthChangeEvent } from '@supabase/supabase-js';
import { safeLocalStorage, safeSessionStorage } from '../../../core/utils/safeStorage';
import type { User, Session, LoginResult, RegisterResult, ConnectionState } from '../types/auth.types';
import type { AuthContextValue } from './authContextValue';
import { AuthContext } from './authContextInstance';
import { generateUUID } from '../utils/tokenGenerator';
import { migrateGuestTournaments } from '../services/guestMigrationService';

// Re-export the context for consumers
export { AuthContext } from './authContextInstance';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * Maps Supabase User to our User type
 */
function mapSupabaseUser(
  supabaseUser: SupabaseUser | null,
  profileData?: { name: string; avatar_url: string | null; role: string } | null
): User | null {
  if (!supabaseUser) { return null; }

  // Extract user_metadata with proper typing
  const metadata = supabaseUser.user_metadata as { full_name?: string; avatar_url?: string } | undefined;

  // Use profile name if non-empty, otherwise fall back through the chain
  const profileName = profileData?.name && profileData.name.trim() !== '' ? profileData.name : undefined;
  const metadataName = metadata?.full_name && metadata.full_name.trim() !== '' ? metadata.full_name : undefined;
  const emailName = supabaseUser.email?.split('@')[0];

  return {
    id: supabaseUser.id,
    email: supabaseUser.email ?? '',
    name: profileName ?? metadataName ?? emailName ?? 'User',
    avatarUrl: profileData?.avatar_url ?? metadata?.avatar_url,
    globalRole: profileData?.role as 'user' | 'admin' | undefined ?? 'user',
    createdAt: supabaseUser.created_at,
    updatedAt: supabaseUser.updated_at ?? supabaseUser.created_at,
    lastLoginAt: supabaseUser.last_sign_in_at,
  };
}

/**
 * Maps Supabase Session to our Session type
 */
function mapSupabaseSession(supabaseSession: SupabaseSession | null): Session | null {
  if (!supabaseSession) { return null; }

  return {
    id: supabaseSession.access_token.substring(0, 36), // Use first part as ID
    userId: supabaseSession.user.id,
    token: supabaseSession.access_token,
    createdAt: new Date().toISOString(),
    expiresAt: new Date((supabaseSession.expires_at ?? Date.now() / 1000) * 1000).toISOString(),
    lastActivityAt: new Date().toISOString(),
  };
}

/**
 * Creates a local guest user (not stored in Supabase)
 */
function createLocalGuestUser(): User {
  const now = new Date().toISOString();
  return {
    id: generateUUID(),
    email: '',
    name: 'Gast',
    globalRole: 'guest',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * AuthProvider - Wrapper für Auth-State mit Supabase
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  /**
   * Fetches profile data from profiles table
   */
  const fetchProfile = useCallback(async (userId: string, userMetadata?: { full_name?: string }) => {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, role')
        .eq('id', userId)
        .single();

      if (error) {
        // If profile doesn't exist (PGRST116), try to create it (Self-Healing)
        if (error.code === 'PGRST116') {
          // eslint-disable-next-line no-console
          console.log('Profile missing, attempting self-healing creation...');
          try {
            const displayName = userMetadata?.full_name?.trim() || 'User';
            const { data: newData, error: createError } = await supabase
              .from('profiles')
              .insert({
                id: userId,
                display_name: displayName,
                role: 'user', // Default
              })
              .select('display_name, avatar_url, role')
              .single();

            if (createError) {
              console.error('Self-healing profile creation failed:', createError.message);
              return null;
            }

            return {
              name: newData.display_name ?? '',
              avatar_url: newData.avatar_url,
              role: (newData.role as 'user' | 'admin' | null) ?? 'user',
            };
          } catch (createErr) {
            console.error('Self-healing failed unexpectedly:', createErr);
          }
        } else {
          console.warn('Profile fetch error:', error.message);
        }
        return null;
      }

      // Map to expected format
      return {
        name: data.display_name ?? '',
        avatar_url: data.avatar_url,
        role: (data.role as 'user' | 'admin' | null) ?? 'user',
      };
    } catch (err) {
      console.error('Profile fetch failed:', err);
      return null;
    }
  }, []);

  /**
   * Updates auth state from Supabase session
   */
  const updateAuthState = useCallback(async (supabaseSession: SupabaseSession | null) => {
    if (!supabaseSession?.user) {
      // Check if we have a guest user stored
      const storedGuest = safeLocalStorage.getItem('auth:guestUser');
      if (storedGuest) {
        try {
          const guestUser = JSON.parse(storedGuest) as User;
          if (guestUser.globalRole === 'guest') {
            setUser(guestUser);
            setIsGuest(true);
            setSession(null);
            setIsLoading(false);
            return;
          }
        } catch {
          safeLocalStorage.removeItem('auth:guestUser');
        }
      }

      setUser(null);
      setSession(null);
      setIsGuest(false);
      setIsLoading(false);
      return;
    }

    // Fetch profile data (pass metadata for self-healing)
    const userMetadata = supabaseSession.user.user_metadata as { full_name?: string } | undefined;
    const profileData = await fetchProfile(supabaseSession.user.id, userMetadata);

    // Map to our types
    const mappedUser = mapSupabaseUser(supabaseSession.user, profileData);
    const mappedSession = mapSupabaseSession(supabaseSession);

    setUser(mappedUser);
    setSession(mappedSession);
    setIsGuest(false);
    setIsLoading(false);
  }, [fetchProfile]);

  // Initial auth check and subscription
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    const initAuth = async (retryCount = 0) => {
      // Safety timeout: If auth takes too long, force loading=false to let user interact
      // Increased to 8s to allow for cold starts and slow networks
      const safetyTimeout = setTimeout(() => {
        if (mounted && isLoading) {
          console.warn('Auth init timed out - forcing offline mode');
          setConnectionState('offline');
          setIsLoading(false);
        }
      }, 8000);

      try {
        // If Supabase isn't configured, just check for guest user and finish
        if (!isSupabaseConfigured || !supabase) {
          if (mounted) {
            setConnectionState('offline');
            await updateAuthState(null);
          }
          return;
        }

        // Get current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (mounted) {
          setConnectionState('connected');
          await updateAuthState(currentSession);
        }
      } catch (error) {
        // AbortError is expected in React StrictMode (double mount/unmount)
        // The Supabase lock gets aborted on first unmount
        // Retry once after a short delay to let StrictMode settle
        if (error instanceof Error && error.name === 'AbortError') {
          if (retryCount < 2) {
            // Wait for StrictMode to finish its double-mount cycle
            await new Promise(resolve => setTimeout(resolve, 100));
            clearTimeout(safetyTimeout);
            return initAuth(retryCount + 1);
          }
          // After retries, silently ignore - user can refresh or app will recover
          if (mounted) {
            setConnectionState('offline');
          }
          return;
        }
        console.error('Auth init error:', error);
        if (mounted) {
          setConnectionState('offline');
          setUser(null);
          setSession(null);
          setIsLoading(false);
        }
      } finally {
        clearTimeout(safetyTimeout);
      }
    };

    void initAuth();

    // Subscribe to auth changes (only if Supabase is configured)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, newSession: SupabaseSession | null) => {
            // eslint-disable-next-line no-console -- Useful for auth debugging
            console.log('Auth state change:', event);

            if (mounted) {
              // Handle password recovery - set flag for AuthCallback to redirect
              if (event === 'PASSWORD_RECOVERY' && newSession) {
                safeSessionStorage.setItem('auth:passwordRecovery', 'true');
              }

              // Clear guest state on real login
              if (event === 'SIGNED_IN' && newSession) {
                safeLocalStorage.removeItem('auth:guestUser');
                setIsGuest(false);
              }

              await updateAuthState(newSession);
            }
          }
        );
        subscription = data.subscription;
      } catch (error) {
        // AbortError can happen in StrictMode during subscription setup
        if (!(error instanceof Error && error.name === 'AbortError')) {
          console.error('Auth subscription error:', error);
        }
      }
    }

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateAuthState]);

  // Auto-reconnect when offline
  useEffect(() => {
    if (connectionState !== 'offline' || !isSupabaseConfigured || !supabase) {
      return;
    }

    // Capture supabase reference for TypeScript narrowing
    const supabaseClient = supabase;
    let retryTimeout: ReturnType<typeof setTimeout> | null = null;

    const attemptReconnect = async () => {
      // eslint-disable-next-line no-console
      console.log('Attempting to reconnect to Supabase...');
      setConnectionState('connecting');

      try {
        const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
        setConnectionState('connected');
        await updateAuthState(currentSession);
        // eslint-disable-next-line no-console
        console.log('Reconnected successfully');
      } catch (error) {
        console.warn('Reconnect failed:', error);
        setConnectionState('offline');
        // Schedule next retry
        retryTimeout = setTimeout(() => { void attemptReconnect(); }, 30000);
      }
    };

    // Listen for browser online event
    const handleOnline = () => {
      // eslint-disable-next-line no-console
      console.log('Browser online event detected');
      void attemptReconnect();
    };

    window.addEventListener('online', handleOnline);

    // Start periodic retry after initial delay
    retryTimeout = setTimeout(() => { void attemptReconnect(); }, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [connectionState, updateAuthState]);

  // Derived state
  const isAuthenticated = useMemo(() => {
    return user !== null && user.globalRole !== 'guest';
  }, [user]);

  // ============================================
  // AUTH ACTIONS
  // ============================================

  /**
   * Register with email and password
   */
  const register = useCallback(async (
    name: string,
    email: string,
    password: string
  ): Promise<RegisterResult> => {
    if (!isSupabaseConfigured || !supabase) {
      return {
        success: false,
        error: 'Cloud-Funktionen sind nicht verfügbar. Bitte als Gast fortfahren.',
      };
    }

    try {
      // Check if current user is a guest (for migration)
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
      const userMetadata = data.user.user_metadata as { full_name?: string } | undefined;
      const profileData = await fetchProfile(data.user.id, userMetadata);
      const mappedUser = mapSupabaseUser(data.user, profileData);

      // Migrate any local guest tournaments to the new account
      let migrationResult = { migratedCount: 0 };
      try {
        migrationResult = await migrateGuestTournaments();
        if (migrationResult.migratedCount > 0) {
          // eslint-disable-next-line no-console
          console.log(`Migrated ${migrationResult.migratedCount} tournament(s) after registration`);
        }
      } catch (migrationError) {
        console.error('Migration after registration failed:', migrationError);
        // Don't fail the registration if migration fails
      }

      return {
        success: true,
        user: mappedUser ?? undefined,
        session: data.session ? mapSupabaseSession(data.session) ?? undefined : undefined,
        wasMigrated: migrationResult.migratedCount > 0,
        migratedCount: migrationResult.migratedCount,
      };
    } catch (err) {
      console.error('Register error:', err);
      return {
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten.',
      };
    }
  }, [isGuest, user, fetchProfile]);

  /**
   * Login with email and password
   */
  const login = useCallback(async (
    email: string,
    password: string
  ): Promise<LoginResult> => {
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
        return {
          success: false,
          error: error.message === 'Invalid login credentials'
            ? 'E-Mail oder Passwort ist falsch.'
            : error.message,
        };
      }

      // Clear guest data
      safeLocalStorage.removeItem('auth:guestUser');

      const userMetadata = data.user.user_metadata as { full_name?: string } | undefined;
      const profileData = await fetchProfile(data.user.id, userMetadata);
      const mappedUser = mapSupabaseUser(data.user, profileData);

      // Migrate any local guest tournaments to the logged-in account
      let migrationResult = { migratedCount: 0 };
      try {
        migrationResult = await migrateGuestTournaments();
        if (migrationResult.migratedCount > 0) {
          // eslint-disable-next-line no-console
          console.log(`Migrated ${migrationResult.migratedCount} tournament(s) after login`);
        }
      } catch (migrationError) {
        console.error('Migration after login failed:', migrationError);
        // Don't fail the login if migration fails
      }

      return {
        success: true,
        user: mappedUser ?? undefined,
        session: mapSupabaseSession(data.session) ?? undefined,
        wasMigrated: migrationResult.migratedCount > 0,
        migratedCount: migrationResult.migratedCount,
      };
    } catch (err) {
      console.error('Login error:', err);
      return {
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten.',
      };
    }
  }, [fetchProfile]);

  /**
   * Send magic link email
   */
  const sendMagicLink = useCallback(async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
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
      console.error('Magic link error:', err);
      return {
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten.',
      };
    }
  }, []);

  /**
   * Login with Google OAuth
   */
  const loginWithGoogle = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
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
      console.error('Google login error:', err);
      return {
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten.',
      };
    }
  }, []);

  /**
   * Logout
   */
  const logout = useCallback(async (): Promise<void> => {
    // Clear local state even if Supabase is not configured
    if (!isSupabaseConfigured || !supabase) {
      safeLocalStorage.removeItem('auth:guestUser');
      setUser(null);
      setSession(null);
      setIsGuest(false);
      return;
    }

    try {
      await supabase.auth.signOut();
      safeLocalStorage.removeItem('auth:guestUser');
      setUser(null);
      setSession(null);
      setIsGuest(false);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  /**
   * Continue as guest (local only, no Supabase)
   */
  const continueAsGuest = useCallback((): User => {
    const guestUser = createLocalGuestUser();
    safeLocalStorage.setItem('auth:guestUser', JSON.stringify(guestUser));
    setUser(guestUser);
    setSession(null);
    setIsGuest(true);
    return guestUser;
  }, []);

  /**
   * Refresh auth state
   */
  const refreshAuth = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) {
      // Just re-check guest state
      await updateAuthState(null);
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setConnectionState('connected');
      await updateAuthState(currentSession);
    } catch (err) {
      console.error('Refresh auth error:', err);
      setConnectionState('offline');
      setIsLoading(false);
    }
  }, [updateAuthState]);

  /**
   * Manually trigger reconnection attempt
   */
  const reconnect = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // eslint-disable-next-line no-console
    console.log('Manual reconnect triggered');
    setConnectionState('connecting');

    try {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setConnectionState('connected');
      await updateAuthState(currentSession);
      // eslint-disable-next-line no-console
      console.log('Manual reconnect successful');
    } catch (err) {
      console.error('Manual reconnect failed:', err);
      setConnectionState('offline');
    }
  }, [updateAuthState]);

  /**
   * Send password reset email
   */
  const resetPassword = useCallback(async (
    email: string
  ): Promise<{ success: boolean; error?: string }> => {
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
      console.error('Reset password error:', err);
      return {
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten.',
      };
    }
  }, []);

  /**
   * Update user profile
   */
  const updateProfile = useCallback(async (
    updates: { name?: string; avatarUrl?: string }
  ): Promise<{ success: boolean; error?: string }> => {
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
      setUser(prev => prev ? {
        ...prev,
        name: updates.name?.trim() ?? prev.name,
        avatarUrl: updates.avatarUrl ?? prev.avatarUrl,
        updatedAt: new Date().toISOString(),
      } : null);

      return { success: true };
    } catch (err) {
      console.error('Update profile error:', err);
      return { success: false, error: 'Ein unerwarteter Fehler ist aufgetreten.' };
    }
  }, [user, isGuest]);

  /**
   * Update password (after password recovery)
   */
  const updatePassword = useCallback(async (
    newPassword: string
  ): Promise<{ success: boolean; error?: string }> => {
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
      console.error('Update password error:', err);
      return {
        success: false,
        error: 'Ein unerwarteter Fehler ist aufgetreten.',
      };
    }
  }, []);

  // Context value
  const value: AuthContextValue = {
    user,
    session,
    isAuthenticated,
    isGuest,
    isLoading,
    connectionState,
    register,
    login,
    sendMagicLink,
    loginWithGoogle,
    logout,
    continueAsGuest,
    refreshAuth,
    reconnect,
    updateProfile,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
