/**
 * Wiederverbindung im Takt (30 s) und bei `online`, solange „offline“ oder „Server antwortet langsam“ gilt
 * (aus AuthContext ausgelagert, Verhalten unverändert). Anmelden @AN-019, @AN-020, @AN-024, @AN-032.
 */

import { useEffect } from 'react';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import type { User, ConnectionState } from '../types/auth.types';
import { isInvalidRefreshTokenError, clearStaleAuthState } from './authActions';
import { setSignedOutElsewhere } from './remoteSignOut';
import { readSessionOrThrow } from './readSession';
import {
  AUTH_ABORT_RETRY_DELAY_MS,
  AUTH_GETSESSION_REFRESH_TIMEOUT_MS,
  AUTH_RECONNECT_INTERVAL_MS,
  SERVER_SLOW_AFTER_MS,
  isBrowserOffline,
  stateAfterFailure,
} from './authTiming';

export interface AutoReconnectDeps {
  connectionState: ConnectionState;
  isServerSlow: boolean;
  setUser: (user: User | null) => void;
  setSession: (session: null) => void;
  setIsGuest: (isGuest: boolean) => void;
  setConnectionState: (state: ConnectionState) => void;
  setIsServerSlow: (slow: boolean) => void;
  updateAuthState: (session: SupabaseSession | null) => Promise<void>;
}

export function useAutoReconnect({
  connectionState,
  isServerSlow,
  setUser,
  setSession,
  setIsGuest,
  setConnectionState,
  setIsServerSlow,
  updateAuthState,
}: AutoReconnectDeps): void {
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
  }, [connectionState, isServerSlow, updateAuthState, setUser, setSession, setIsGuest, setConnectionState, setIsServerSlow]);
}
