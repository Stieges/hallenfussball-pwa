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

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { Session as SupabaseSession, AuthChangeEvent } from '@supabase/supabase-js';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import type { User, Session, ConnectionState } from '../types/auth.types';
import type { AuthContextValue } from './authContextValue';
import { AuthContext } from './authContextInstance';
import { mapSupabaseUser, mapSupabaseSession } from './authMapper';
import * as authActions from './authActions';
import type { AuthActionDeps } from './authActions';
import { isInvalidRefreshTokenError, clearStaleAuthState } from './authActions';
import {
  cacheUserProfile,
  restoreUserFromCache,
} from '../services/profileCacheService';
import { isFeatureEnabled } from '../../../config';
import { captureFeatureError } from '../../../lib/sentry';
import { executeWithTimeout } from '../../../core/utils/SingleFlight';
import { setSignedOutElsewhere, useRemoteSessionCheck } from './remoteSignOut';
import { applyAuthEventEffects, reportAuthCallbackError } from './authEventEffects';
import { SignedOutElsewhereNotice } from '../components/SignedOutElsewhereNotice';
import { ServerSlowNotice } from '../components/ServerSlowNotice';
import { hasStoredAuthToken, readSessionOrThrow } from './readSession';

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
 * Per-call timeout for `supabase.auth.getSession()`. Set slightly lower than
 * the umbrella safetyTimeout (AUTH_INIT_TIMEOUT_MS) so the executeWithTimeout
 * wrapper rejects first and the structured catch-block fallback (cached user
 * → offline mode) runs before the broad safety net fires (Sub-Spec 1.5 F1).
 */
const AUTH_GETSESSION_TIMEOUT_MS = 12_000;

/**
 * Per-call timeout for cross-tab + reconnect `getSession()` calls.
 * Shorter than init because these paths happen after the first successful
 * connection — if they hang, we don't want to block the UI for 12 s.
 */
const AUTH_GETSESSION_REFRESH_TIMEOUT_MS = 8_000;

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

/**
 * Ab dieser Wartezeit auf die Antwort des Servers zeigt die App „Server antwortet langsam“
 * (Anmelden Ü1.3, @AN-032: länger als 5 Sekunden). Kein „offline“, keine Sperre.
 */
const SERVER_SLOW_AFTER_MS = 5_000;

/** Meldet das Gerät selbst „kein Netz“, ist eine ausbleibende Antwort keine langsame Antwort. */
const isBrowserOffline = (): boolean => typeof navigator !== 'undefined' && !navigator.onLine;

/**
 * Verbindungszustand nach einem gescheiterten Versuch. Blieb die Antwort nur aus (Zeitüberschreitung)
 * und das Gerät meldet Netz, ist der Server langsam, nicht „offline“ (@AN-032): der Zustand bleibt
 * „connecting“, die Wiederverbindung läuft weiter (Hinweis „Server antwortet langsam“).
 * Eine gescheiterte Prüfung (Netzfehler) oder ein Gerät ohne Netz bleibt „offline“.
 */
const stateAfterFailure = (error: unknown): ConnectionState =>
  error instanceof Error && error.message.includes('timed out') && !isBrowserOffline()
    ? 'connecting'
    : 'offline';

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
  // Antwort des Servers steht seit mehr als 5 s aus (@AN-019, @AN-032); endet mit der Antwort.
  const [isServerSlow, setIsServerSlow] = useState(false);
  // Jüngster updateAuthState-Aufruf: ein älteres Ergebnis darf einen neueren Zustand nicht überschreiben (A-07d2).
  const authSeqRef = useRef(0);
  // Solange die App startet (bis initAuth fertig ist): ein SIGNED_OUT dann heißt „Anmeldung ging beim Erneuern verloren“.
  const startingRef = useRef(true);

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
      if (err instanceof Error) {
        captureFeatureError(err, 'auth', 'fetchProfile');
      }
      return null;
    }
  }, []);

  /**
   * Updates auth state from Supabase session
   */
  const updateAuthState = useCallback(async (supabaseSession: SupabaseSession | null) => {
    const seq = ++authSeqRef.current;
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
    if (seq !== authSeqRef.current) { return; }

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
      // „Server antwortet langsam“: nur, wenn das Gerät Netz meldet; sonst wäre es keine langsame Antwort.
      const slowTimer = setTimeout(() => {
        if (mounted && !isBrowserOffline()) {
          setIsServerSlow(true);
          // @AN-019: Wer angemeldet war, bleibt es mit dem Stand auf dem Gerät – schon jetzt, nicht erst
          // nach der Zeitgrenze des Starts. Kommt die Antwort, ersetzt sie die Kopie (authSeqRef).
          void restoreUserFromCache().then((cachedUser) => {
            if (mounted && cachedUser && startingRef.current) {
              setUser(cachedUser);
            }
          });
        }
      }, SERVER_SLOW_AFTER_MS);

      // Safety timeout: If auth takes too long, force loading=false to let user interact
      // Set to 15s to allow for cold starts, slow networks, and serverless function warmup
      const safetyTimeout = setTimeout(async () => {
        if (mounted && isLoading) {
          console.warn('Auth init timed out after 15s - releasing UI');

          // Telemetry: capture every timeout to Sentry so we can measure how
          // often this fires in production and on which clients (HP-5 hotfix).
          captureFeatureError(
            new Error('AuthInitTimeout: getSession() did not resolve within 15s'),
            'auth',
            'initTimeout',
            {
              online: typeof navigator !== 'undefined' ? navigator.onLine : null,
              supabaseConfigured: isSupabaseConfigured,
            },
          );

          // Sub-Spec 1.5 F2 / @AN-019: Eine Zeitüberschreitung ist keine Antwort des Servers und
          // meldet niemanden ab. Gespeicherte Anmeldung und Nutzerkopie bleiben; die Wiederverbindung
          // übernimmt die Anmeldung, sobald der Server antwortet.
          const cachedUser = await restoreUserFromCache();
          if (cachedUser) {
            setUser(cachedUser);
          }
          // Kein „offline“, solange das Gerät Netz meldet und nur die Antwort fehlt (@AN-032).
          if (isBrowserOffline()) {
            setConnectionState('offline');
          }
          setIsLoading(false);
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

        // Get current session. Wrapped in executeWithTimeout so a hung
        // getSession() rejects with a timeout error instead of leaving the
        // safetyTimeout as the only escape hatch (Sub-Spec 1.5 F1).
        // Capture client reference to satisfy the closure's type narrowing.
        const supabaseClient = supabase;
        // getSession wirft nicht (Fehler im Ergebnis); readSessionOrThrow trennt die Fälle für alle Aufrufer gleich.
        const currentSession = await readSessionOrThrow(supabaseClient, AUTH_GETSESSION_TIMEOUT_MS);

        if (mounted) {
          setConnectionState('connected');
          await updateAuthState(currentSession);
          // Der Server hat geantwortet: der Hinweis „antwortet langsam“ endet von selbst.
          setIsServerSlow(false);
        }
      } catch (error) {
        // Invalid Refresh Token: another tab may have just consumed the single-use
        // refresh token. Wait briefly and retry before clearing state.
        if (isInvalidRefreshTokenError(error)) {
          if (import.meta.env.DEV) {
            console.warn('[Auth] Invalid refresh token during init - retrying after brief wait');
          }

          // Wait for the other tab to finish writing the new token to localStorage
          await new Promise(resolve => setTimeout(resolve, 300));

          try {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const { data: { session: retrySession } } = await supabase!.auth.getSession();
            if (retrySession && mounted) {
              // Other tab refreshed the token in time
              if (import.meta.env.DEV) {
                console.warn('[Auth] Recovered session after invalid refresh token retry');
              }
              setConnectionState('connected');
              await updateAuthState(retrySession);
              return;
            }
          } catch {
            // Retry also failed — fall through to clear state
          }

          // Genuinely invalid (der Server hat es gesagt) — klar melden, dann neu anmelden lassen.
          // Der Merker steht vor dem lokalen Abmelden: dessen SIGNED_OUT ist kein „anderes Gerät“.
          // Ablauf und Widerruf sind nicht unterscheidbar: @AN-024 (nicht der Text von @AN-021).
          setSignedOutElsewhere();
          await clearStaleAuthState();
          if (mounted) {
            setUser(null);
            setSession(null);
            setIsGuest(false);
            setConnectionState('connected'); // Supabase is reachable, just need re-auth
            setIsLoading(false);
          }
          return;
        }

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
            const cachedUser = await restoreUserFromCache();
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
        if (error instanceof Error) {
          captureFeatureError(error, 'auth', 'initAuth');
        }
        if (mounted) {
          const cachedUser = await restoreUserFromCache();
          if (cachedUser) {
            // eslint-disable-next-line no-console -- intentional debug logging
            console.debug('Restored cached user after auth error:', cachedUser.email);
            setUser(cachedUser);
            setConnectionState(stateAfterFailure(error));
            setIsLoading(false);
            return;
          }
          // No cached user - check for guest user via updateAuthState
          setConnectionState(stateAfterFailure(error));
          await updateAuthState(null);
        }
      } finally {
        clearTimeout(safetyTimeout);
        clearTimeout(slowTimer);
        startingRef.current = false;
      }
    };

    void initAuth();

    // Subscribe to auth changes (only if Supabase is configured)
    if (isSupabaseConfigured && supabase) {
      const authClient = supabase;
      try {
        const { data } = authClient.auth.onAuthStateChange(
          (event: AuthChangeEvent, newSession: SupabaseSession | null) => {
            // Synchron bleiben (A-07d2, C-AUTH-CALLBACK-ASYNC): die Arbeit läuft danach.
            setTimeout(() => {
              if (import.meta.env.DEV) {
                // eslint-disable-next-line no-console -- Useful for auth debugging
                console.log('Auth state change:', event);
              }

              if (mounted) {
                // Fehlerfang (N2): sonst wäre die Ablehnung ein unbehandeltes Promise.
                void (async () => {
                  // Scheitert das Erneuern am Netz, meldet auth-js nach den Wiederholungen INITIAL_SESSION ohne
                  // Sitzung, behält aber den Schlüssel: das ist keine Abmeldung (@AN-019/@AN-020, Probe P2).
                  if (event === 'INITIAL_SESSION' && !newSession && hasStoredAuthToken(authClient)) {
                    return;
                  }
                  applyAuthEventEffects(event, newSession, setIsGuest);
                  // Eine Antwort des Servers beendet „antwortet langsam“ (@AN-019), auch eine abgekoppelte Erneuerung.
                  // Nur TOKEN_REFRESHED: SIGNED_IN kommt auch ohne Serverkontakt aus dem Speicher (Start, Tab wieder
                  // sichtbar – auth-js `_recoverAndRefresh`) und ist kein „verbunden“ (N2). Eine echte Anmeldung setzt
                  // „verbunden“ über die Anmelde-Aktion (actionDeps.setConnectionState).
                  if (event === 'TOKEN_REFRESHED') {
                    setIsServerSlow(false);
                    setConnectionState('connected');
                  }
                  await updateAuthState(newSession);
                })().catch(reportAuthCallbackError);
              }
            }, 0);
          }
        );
        subscription = data.subscription;
      } catch (error) {
        // AbortError can happen in StrictMode during subscription setup
        const isAbort = error instanceof Error && error.name === 'AbortError';
        if (!isAbort && import.meta.env.DEV) {
          console.error('Auth subscription error:', error);
        }
        if (!isAbort && error instanceof Error) {
          captureFeatureError(error, 'auth', 'subscription');
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
    // „offline“ oder Antwort bleibt aus (langsam): die Wiederverbindung läuft in beiden Fällen weiter.
    if ((connectionState !== 'offline' && !isServerSlow) || !isSupabaseConfigured || !supabase) {
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
      const slowTimer = setTimeout(() => {
        if (!isBrowserOffline()) {
          setIsServerSlow(true);
        }
      }, SERVER_SLOW_AFTER_MS);

      try {
        const currentSession = await readSessionOrThrow(supabaseClient, AUTH_GETSESSION_REFRESH_TIMEOUT_MS);
        setConnectionState('connected');
        await updateAuthState(currentSession);
        setIsServerSlow(false);
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
        // Der Server sagt selbst, dass der Erneuerungsschlüssel nicht mehr gilt: klar melden (@AN-024).
        if (isInvalidRefreshTokenError(error)) {
          setSignedOutElsewhere();
          await clearStaleAuthState();
          setUser(null);
          setSession(null);
          setIsGuest(false);
          setConnectionState('connected'); // Server erreichbar, nur neue Anmeldung nötig
          setIsServerSlow(false);
          return;
        }
        setConnectionState(stateAfterFailure(error));
        // Schedule next retry
        retryTimeout = setTimeout(() => { void attemptReconnect(); }, AUTH_RECONNECT_INTERVAL_MS);
      } finally {
        clearTimeout(slowTimer);
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
  }, [connectionState, isServerSlow, updateAuthState]);

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

        // Re-fetch session from Supabase (which reads from localStorage).
        // Timeout-wrapped so a cross-tab event with a hung Supabase can't
        // leak a never-resolving promise into the UI (Sub-Spec 1.5 F5).
        void executeWithTimeout(
          () => supabaseClient.auth.getSession(),
          AUTH_GETSESSION_REFRESH_TIMEOUT_MS,
        )
          .then(({ data: { session: newSession } }) => {
            void updateAuthState(newSession);
          })
          .catch((err: unknown) => {
            if (import.meta.env.DEV) {
              console.warn('Cross-tab getSession timed out:', err);
            }
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
          void executeWithTimeout(
            () => supabaseClient.auth.getSession(),
            AUTH_GETSESSION_REFRESH_TIMEOUT_MS,
          )
            .then(({ data: { session: newSession } }) => {
              void updateAuthState(newSession);
            })
            .catch((err: unknown) => {
              if (import.meta.env.DEV) {
                console.warn('Cross-tab getSession (guest-removed) timed out:', err);
              }
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
   * Ref to hold current state, avoiding stale closures in action callbacks.
   * Without this, actionDeps would depend on user/isGuest, causing ALL
   * action callbacks to be recreated on every state change.
   */
  const stateRef = useRef({ user, isGuest });
  useEffect(() => { stateRef.current = { user, isGuest }; }, [user, isGuest]);

  /**
   * Memoized dependencies for auth actions
   */
  const actionDeps: AuthActionDeps = useMemo(() => ({
    fetchProfile,
    setUser,
    setSession,
    setIsGuest,
    // Aktionen setzen „verbunden“ nur nach einer Antwort des Servers (Anmelden, Wiederverbinden): der Hinweis endet.
    setConnectionState: (state: ConnectionState) => {
      setConnectionState(state);
      if (state === 'connected') {
        setIsServerSlow(false);
      }
    },
    setIsLoading,
    updateAuthState,
    getCurrentState: () => stateRef.current,
  }), [fetchProfile, updateAuthState]);

  // Anderes Gerät hat abgemeldet: Sitzung beim Start, bei online und bei Sichtbarkeit prüfen (A-07d2).
  useRemoteSessionCheck(supabase, isAuthenticated, () => authActions.logout(actionDeps, { scope: 'local' }));

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
    (options?: { scope?: 'local' | 'others' }) => authActions.logout(actionDeps, options),
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

  // Globale Hinweise (B2): „anderes Gerät“, „Anmeldung abgelaufen“ (auf /login zeigt sie die Anmeldeseite selbst) und „Server antwortet langsam“.
  return <AuthContext.Provider value={value}>{children}<SignedOutElsewhereNotice /><ServerSlowNotice visible={isServerSlow} /></AuthContext.Provider>;
}
