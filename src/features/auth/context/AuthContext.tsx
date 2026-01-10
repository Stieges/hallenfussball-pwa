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
import type { User, Session, LoginResult, RegisterResult } from '../types/auth.types';
import type { AuthContextValue } from './authContextValue';
import { AuthContext } from './authContextInstance';
import { generateUUID } from '../utils/tokenGenerator';

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

  /**
   * Fetches profile data from profiles table
   */
  const fetchProfile = useCallback(async (userId: string) => {
    if (!isSupabaseConfigured || !supabase) {
      return null;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch error (may not exist yet):', error.message);
        return null;
      }

      // Map to expected format
      return {
        name: data.display_name ?? '',
        avatar_url: data.avatar_url,
        role: 'user' as const, // Default role since it's not stored in profiles
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
      const storedGuest = localStorage.getItem('auth:guestUser');
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
          localStorage.removeItem('auth:guestUser');
        }
      }

      setUser(null);
      setSession(null);
      setIsGuest(false);
      setIsLoading(false);
      return;
    }

    // Fetch profile data
    const profileData = await fetchProfile(supabaseSession.user.id);

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

    const initAuth = async () => {
      // If Supabase isn't configured, just check for guest user and finish
      if (!isSupabaseConfigured || !supabase) {
        if (mounted) {
          await updateAuthState(null);
        }
        return;
      }

      try {
        // Get current session
        const { data: { session: currentSession } } = await supabase.auth.getSession();

        if (mounted) {
          await updateAuthState(currentSession);
        }
      } catch (error) {
        console.error('Auth init error:', error);
        if (mounted) {
          setUser(null);
          setSession(null);
          setIsLoading(false);
        }
      }
    };

    void initAuth();

    // Subscribe to auth changes (only if Supabase is configured)
    if (isSupabaseConfigured && supabase) {
      const { data } = supabase.auth.onAuthStateChange(
        async (event: AuthChangeEvent, newSession: SupabaseSession | null) => {
          // eslint-disable-next-line no-console -- Useful for auth debugging
          console.log('Auth state change:', event);

          if (mounted) {
            // Handle password recovery - set flag for AuthCallback to redirect
            if (event === 'PASSWORD_RECOVERY' && newSession) {
              sessionStorage.setItem('auth:passwordRecovery', 'true');
            }

            // Clear guest state on real login
            if (event === 'SIGNED_IN' && newSession) {
              localStorage.removeItem('auth:guestUser');
              setIsGuest(false);
            }

            await updateAuthState(newSession);
          }
        }
      );
      subscription = data.subscription;
    }

    return () => {
      mounted = false;
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [updateAuthState]);

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
      // Note: guestId could be used later for migrating local data to the new user account
      // const guestId = wasGuest ? user.id : undefined;

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            full_name: name.trim(),
          },
          emailRedirectTo: `${window.location.origin}/#/auth/callback`,
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

      // Update profile with display_name
      await supabase
        .from('profiles')
        .update({ display_name: name.trim() })
        .eq('id', data.user.id);

      // Clear guest data
      if (wasGuest) {
        localStorage.removeItem('auth:guestUser');
      }

      // Get profile data
      const profileData = await fetchProfile(data.user.id);
      const mappedUser = mapSupabaseUser(data.user, profileData);

      return {
        success: true,
        user: mappedUser ?? undefined,
        session: data.session ? mapSupabaseSession(data.session) ?? undefined : undefined,
        wasMigrated: wasGuest,
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
      localStorage.removeItem('auth:guestUser');

      const profileData = await fetchProfile(data.user.id);
      const mappedUser = mapSupabaseUser(data.user, profileData);

      return {
        success: true,
        user: mappedUser ?? undefined,
        session: mapSupabaseSession(data.session) ?? undefined,
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
          emailRedirectTo: `${window.location.origin}/#/auth/callback`,
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
      localStorage.removeItem('auth:guestUser');
      setUser(null);
      setSession(null);
      setIsGuest(false);
      return;
    }

    try {
      await supabase.auth.signOut();
      localStorage.removeItem('auth:guestUser');
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
    localStorage.setItem('auth:guestUser', JSON.stringify(guestUser));
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
      await updateAuthState(currentSession);
    } catch (err) {
      console.error('Refresh auth error:', err);
      setIsLoading(false);
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
          redirectTo: `${window.location.origin}/#/auth/callback`,
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
    register,
    login,
    sendMagicLink,
    loginWithGoogle,
    logout,
    continueAsGuest,
    refreshAuth,
    updateProfile,
    resetPassword,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
