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
import {
  cacheUserProfile,
  getCachedProfile,
} from '../services/profileCacheService';
import { isFeatureEnabled } from '../../../config';

// Re-export the context for consumers
export { AuthContext } from './authContextInstance';

// ============================================================================
// AUTH CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Maximum time to wait for Supabase auth initialization.
 * After this timeout, the app falls back to offline/guest mode.
 * 15s accounts for cold starts, slow networks, and serverless function warmup.
 */
const AUTH_INIT_TIMEOUT_MS = 15_000;

/**
 * Maximum number of retry attempts for transient auth errors (e.g., AbortError).
 * Uses exponential backoff: 1s, 2s, 4s, 8s, 8s
 */
const AUTH_MAX_RETRIES = 5;

/**
 * Base delay for exponential backoff (in milliseconds).
 */
const AUTH_RETRY_BASE_DELAY_MS = 1_000;

/**
 * Maximum delay between retries (cap for exponential backoff).
 */
const AUTH_RETRY_MAX_DELAY_MS = 8_000;

/**
 * Interval for periodic reconnect attempts when offline.
 */
const AUTH_RECONNECT_INTERVAL_MS = 30_000;

/**
 * Quick retry delay after transient abort errors during reconnect.
 */
const AUTH_ABORT_RETRY_DELAY_MS = 2_000;

// ============================================================================

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

    // Cache authenticated user for offline fallback (BUG-004 fix)
    // This allows us to restore the user if auth init fails after max retries
    // Use both localStorage (sync, quick) and IndexedDB (async, more robust)
    try {
      safeLocalStorage.setItem('auth:cachedUser', JSON.stringify(mappedUser));
    } catch {
      // localStorage not available, skip caching
    }
    // Also cache to IndexedDB for better offline support (async, fire-and-forget)
    // Only if OFFLINE_FIRST feature flag is enabled
    if (mappedUser && isFeatureEnabled('OFFLINE_FIRST')) {
      void cacheUserProfile(mappedUser);
    }

    setUser(mappedUser);
    setSession(mappedSession);
    setIsGuest(false);
    setIsLoading(false);
  }, [fetchProfile]);

  // Initial auth check and subscription
  useEffect(() => {
    let mounted = true;
    let subscription: { unsubscribe: () => void } | null = null;

    // Retry delay calculation with exponential backoff
    const getRetryDelay = (attempt: number) =>
      Math.min(AUTH_RETRY_BASE_DELAY_MS * Math.pow(2, attempt), AUTH_RETRY_MAX_DELAY_MS);

    const initAuth = async (retryCount = 0) => {
      // Safety timeout: If auth takes too long, force loading=false to let user interact
      // Set to 15s to allow for cold starts, slow networks, and serverless function warmup
      const safetyTimeout = setTimeout(() => {
        if (mounted && isLoading) {
          console.warn('Auth init timed out after 15s - releasing UI');
          // Set to 'offline' to trigger reconnect logic, NOT 'connected' which would mask issues
          setConnectionState('offline');
          setIsLoading(false);

          // Clear stale cached user to prevent skeleton-stuck issue on next page load
          // The cache was likely created for a session that's now expired/invalid
          try {
            safeLocalStorage.removeItem('auth:cachedUser');
          } catch {
            // localStorage not available
          }

          // Set flag for toast notification (read by useAuthTimeoutToast hook)
          try {
            safeSessionStorage.setItem('auth:timeoutFlag', Date.now().toString());
          } catch {
            // sessionStorage nicht verfügbar
          }
        }
      }, AUTH_INIT_TIMEOUT_MS);

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
          if (retryCount < AUTH_MAX_RETRIES) {
            const delay = getRetryDelay(retryCount);
            // eslint-disable-next-line no-console -- intentional debug logging for retry
            console.debug(`Auth init aborted, retry ${retryCount + 1}/${AUTH_MAX_RETRIES} in ${delay}ms`);
            setTimeout(() => void initAuth(retryCount + 1), delay);
            return;
          }
          // Max retries reached - try to restore cached user (BUG-004 fix)
          // eslint-disable-next-line no-console -- intentional debug logging for transient errors
          console.debug('Auth init aborted after max retries - attempting cached user fallback:', error);
          if (mounted) {
            // Try to restore cached authenticated user (localStorage first, then IndexedDB)
            let cachedUser: User | null = null;
            const cachedUserJson = safeLocalStorage.getItem('auth:cachedUser');
            if (cachedUserJson) {
              try {
                cachedUser = JSON.parse(cachedUserJson) as User;
              } catch {
                // Invalid cached user in localStorage
              }
            }
            // If localStorage didn't have it, try IndexedDB (only if OFFLINE_FIRST enabled)
            if (!cachedUser && isFeatureEnabled('OFFLINE_FIRST')) {
              cachedUser = await getCachedProfile(true); // ignoreExpiry for offline
            }
            if (cachedUser) {
              // eslint-disable-next-line no-console -- intentional debug logging
              console.debug('Restored cached user for offline mode:', cachedUser.email);
              setUser(cachedUser);
              setConnectionState('offline');
              setIsLoading(false);
              return;
            }
            // No cached user - check for guest user via updateAuthState
            setConnectionState('offline');
            await updateAuthState(null);
          }
          return;
        }
        if (import.meta.env.DEV) {
          console.error('Auth init error:', error);
        }
        if (mounted) {
          // Try to restore cached user on any auth error (BUG-004 fix)
          // Check localStorage first (sync, quick), then IndexedDB (async, more robust)
          let cachedUser: User | null = null;
          const cachedUserJson = safeLocalStorage.getItem('auth:cachedUser');
          if (cachedUserJson) {
            try {
              cachedUser = JSON.parse(cachedUserJson) as User;
            } catch {
              // Invalid cached user in localStorage
            }
          }
          // If localStorage didn't have it, try IndexedDB (only if OFFLINE_FIRST enabled)
          if (!cachedUser && isFeatureEnabled('OFFLINE_FIRST')) {
            cachedUser = await getCachedProfile(true); // ignoreExpiry for offline
          }
          if (cachedUser) {
            // eslint-disable-next-line no-console -- intentional debug logging
            console.debug('Restored cached user after auth error:', cachedUser.email);
            setUser(cachedUser);
            setConnectionState('offline');
            setIsLoading(false);
            return;
          }
          // No cached user - check for guest user via updateAuthState
          setConnectionState('offline');
          await updateAuthState(null);
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
          retryTimeout = setTimeout(() => { void attemptReconnect(); }, AUTH_ABORT_RETRY_DELAY_MS);
          return;
        }

        if (import.meta.env.DEV) {
          console.warn('Reconnect failed:', error);
        }
        setConnectionState('offline');
        // Schedule next retry
        retryTimeout = setTimeout(() => { void attemptReconnect(); }, AUTH_RECONNECT_INTERVAL_MS);
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
    retryTimeout = setTimeout(() => { void attemptReconnect(); }, AUTH_RECONNECT_INTERVAL_MS);

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

  // Check if user is an anonymous Supabase user (has account but no credentials)
  const isAnonymous = useMemo(() => {
    return user?.isAnonymous === true;
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
    isAnonymous,
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
