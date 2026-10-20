/**
 * Start der Anmeldung: Sitzung lesen, Hinweis „Server antwortet langsam“, Zeitgrenze, Abo der Auth-Ereignisse
 * (aus AuthContext ausgelagert, Verhalten unverändert). Anmelden @AN-019, @AN-020, @AN-024, @AN-032.
 */

import { useEffect, type RefObject } from 'react';
import type { Session as SupabaseSession, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { captureFeatureError } from '../../../lib/sentry';
import type { User, ConnectionState } from '../types/auth.types';
import { isInvalidRefreshTokenError, clearStaleAuthState } from './authActions';
import { restoreUserFromCache } from '../services/profileCacheService';
import { setSignedOutElsewhere } from './remoteSignOut';
import { applyAuthEventEffects, reportAuthCallbackError } from './authEventEffects';
import { hasStoredAuthToken, readSessionOrThrow } from './readSession';
import {
  AUTH_GETSESSION_TIMEOUT_MS,
  AUTH_INIT_TIMEOUT_MS,
  AUTH_MAX_RETRIES,
  AUTH_RETRY_BASE_DELAY_MS,
  AUTH_RETRY_MAX_DELAY_MS,
  SERVER_SLOW_AFTER_MS,
  isBrowserOffline,
  stateAfterFailure,
} from './authTiming';

export interface AuthInitDeps {
  /** Ladezustand beim Einhängen (die Zeitgrenze liest ihn wie bisher aus dem ersten Durchlauf). */
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setIsServerSlow: (slow: boolean) => void;
  /** true, bis der erste Start fertig ist. */
  startingRef: RefObject<boolean>;
  updateAuthState: (session: SupabaseSession | null) => Promise<void>;
}

export function useAuthInit({
  isLoading,
  setUser,
  setSession,
  setIsGuest,
  setIsLoading,
  setConnectionState,
  setIsServerSlow,
  startingRef,
  updateAuthState,
}: AuthInitDeps): void {
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
}
