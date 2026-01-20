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
import type { Session as SupabaseSession, AuthChangeEvent } from '@supabase/supabase-js';
import { safeLocalStorage, safeSessionStorage } from '../../../core/utils/safeStorage';
import type { User, Session, ConnectionState } from '../types/auth.types';
import type { AuthContextValue } from './authContextValue';
import { AuthContext } from './authContextInstance';
import { mapSupabaseUser, mapSupabaseSession } from './authMapper';
import * as authActions from './authActions';
import type { AuthActionDeps } from './authActions';

// Re-export the context for consumers
export { AuthContext } from './authContextInstance';

interface AuthProviderProps {
  children: React.ReactNode;
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
  const fetchProfile = useCallback(async (userId: string) => {
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
        // PGRST116 is "No Data Found" - expected if trigger hasn't finished yet
        // AbortError is expected in React StrictMode or during navigation
        const isExpectedError =
          error.code === 'PGRST116' ||
          error.message?.includes('AbortError') ||
          error.message?.includes('aborted');
        if (!isExpectedError) {
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
      if (import.meta.env.DEV) {
        console.error('Profile fetch failed:', err);
      }
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

    // Constants for retry logic
    const MAX_RETRIES = 5;
    const getRetryDelay = (attempt: number) => Math.min(1000 * Math.pow(2, attempt), 8000);

    const initAuth = async (retryCount = 0) => {
      // Safety timeout: If auth takes too long, force loading=false to let user interact
      // Set to 15s to allow for cold starts, slow networks, and serverless function warmup
      const safetyTimeout = setTimeout(() => {
        if (mounted && isLoading) {
          console.warn('Auth init timed out after 15s - releasing UI');
          // Set to 'offline' to trigger reconnect logic, NOT 'connected' which would mask issues
          setConnectionState('offline');
          setIsLoading(false);
        }
      }, 15000);

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
        // or during serverless cold starts. Treat as transient.
        if (
          (error instanceof Error && error.name === 'AbortError') ||
          (error instanceof Error && error.message.includes('aborted'))
        ) {
          if (retryCount < MAX_RETRIES) {
            const delay = getRetryDelay(retryCount);
            // eslint-disable-next-line no-console -- intentional debug logging for retry
            console.debug(`Auth init aborted, retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
            setTimeout(() => void initAuth(retryCount + 1), delay);
            return;
          }
          // Max retries reached - set offline to trigger reconnect logic
          // eslint-disable-next-line no-console -- intentional debug logging for transient errors
          console.debug('Auth init aborted after max retries - releasing UI:', error);
          if (mounted) {
            setConnectionState('offline');
            setIsLoading(false);
          }
          return;
        }
        if (import.meta.env.DEV) {
          console.error('Auth init error:', error);
        }
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
            if (import.meta.env.DEV) {
              // eslint-disable-next-line no-console -- Useful for auth debugging
              console.log('Auth state change:', event);
            }

            if (mounted) {
              // Handle password recovery - set flag with TTL for AuthCallback to redirect
              if (event === 'PASSWORD_RECOVERY' && newSession) {
                const recoveryData = JSON.stringify({
                  pending: true,
                  expiresAt: Date.now() + 10 * 60 * 1000  // 10 minutes TTL
                });
                safeSessionStorage.setItem('auth:passwordRecovery', recoveryData);
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
        if (!(error instanceof Error && error.name === 'AbortError') && import.meta.env.DEV) {
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
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('Attempting to reconnect to Supabase...');
      }
      setConnectionState('connecting');

      try {
        const { data: { session: currentSession } } = await supabaseClient.auth.getSession();
        setConnectionState('connected');
        await updateAuthState(currentSession);
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.log('Reconnected successfully');
        }
      } catch (error) {
        // Handle AbortError specifically - usually transient
        if (
          (error instanceof Error && error.name === 'AbortError') ||
          (error instanceof Error && error.message.includes('aborted'))
        ) {
          // Debug level only - this is expected behavior on Vercel/Serverless
          // eslint-disable-next-line no-console -- intentional debug logging for transient errors
          console.debug('Reconnect attempt aborted (transient):', error);

          // Don't set offline, just schedule a quick retry
          if (retryTimeout) { clearTimeout(retryTimeout); }
          retryTimeout = setTimeout(() => { void attemptReconnect(); }, 2000);
          return;
        }

        if (import.meta.env.DEV) {
          console.warn('Reconnect failed:', error);
        }
        setConnectionState('offline');
        // Schedule next retry
        retryTimeout = setTimeout(() => { void attemptReconnect(); }, 30000);
      }
    };

    // Listen for browser online event
    const handleOnline = () => {
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.log('Browser online event detected');
      }
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

  // Cross-tab auth sync: Listen for localStorage changes from other tabs
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    // Capture supabase reference for TypeScript narrowing
    const supabaseClient = supabase;

    const handleStorageChange = (event: StorageEvent) => {
      // Supabase stores auth token with key format: sb-{project-ref}-auth-token
      // We check for any Supabase auth token change
      if (event.key?.startsWith('sb-') && event.key?.endsWith('-auth-token')) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console -- Useful for auth debugging
          console.log('Auth token changed in another tab, syncing...');
        }

        // Re-fetch session from Supabase (which reads from localStorage)
        void supabaseClient.auth.getSession().then(({ data: { session: newSession } }) => {
          void updateAuthState(newSession);
        });
      }

      // Also sync guest user changes across tabs
      if (event.key === 'auth:guestUser') {
        if (event.newValue) {
          // Guest user was set in another tab
          try {
            const guestUser = JSON.parse(event.newValue) as User;
            if (guestUser.globalRole === 'guest') {
              setUser(guestUser);
              setIsGuest(true);
              setSession(null);
            }
          } catch {
            // Invalid JSON, ignore
          }
        } else {
          // Guest user was removed (logged out or upgraded to real account)
          // Re-fetch to check if there's a real session now
          void supabaseClient.auth.getSession().then(({ data: { session: newSession } }) => {
            void updateAuthState(newSession);
          });
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updateAuthState]);

  // Derived state
  const isAuthenticated = useMemo(() => {
    return user !== null && user.globalRole !== 'guest';
  }, [user]);

  // ============================================
  // AUTH ACTION DEPENDENCIES
  // ============================================

  /**
   * Memoized dependencies for auth actions
   */
  const actionDeps: AuthActionDeps = useMemo(() => ({
    fetchProfile,
    setUser,
    setSession,
    setIsGuest,
    setConnectionState,
    setIsLoading,
    updateAuthState,
    getCurrentState: () => ({ user, isGuest }),
  }), [fetchProfile, updateAuthState, user, isGuest]);

  // ============================================
  // AUTH ACTIONS (delegating to authActions module)
  // ============================================

  const register = useCallback(
    (name: string, email: string, password: string) =>
      authActions.register(actionDeps, name, email, password),
    [actionDeps]
  );

  const login = useCallback(
    (email: string, password: string) =>
      authActions.login(actionDeps, email, password),
    [actionDeps]
  );

  const sendMagicLink = useCallback(
    (email: string) => authActions.sendMagicLink(email),
    []
  );

  const loginWithGoogle = useCallback(
    () => authActions.loginWithGoogle(),
    []
  );

  const logout = useCallback(
    () => authActions.logout(actionDeps),
    [actionDeps]
  );

  const continueAsGuest = useCallback(
    () => authActions.continueAsGuest(actionDeps),
    [actionDeps]
  );

  const refreshAuth = useCallback(
    () => authActions.refreshAuth(actionDeps),
    [actionDeps]
  );

  const reconnect = useCallback(
    () => authActions.reconnect(actionDeps),
    [actionDeps]
  );

  const resetPassword = useCallback(
    (email: string) => authActions.resetPassword(email),
    []
  );

  const updateProfile = useCallback(
    (updates: { name?: string; avatarUrl?: string }) =>
      authActions.updateProfile(actionDeps, updates),
    [actionDeps]
  );

  const updatePassword = useCallback(
    (newPassword: string) => authActions.updatePassword(newPassword),
    []
  );

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
