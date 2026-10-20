/**
 * Anmeldung zwischen Fenstern abgleichen: Änderungen am Sitzungsschlüssel oder am Gast in einem anderen Tab
 * (aus AuthContext ausgelagert, Verhalten unverändert).
 */

import { useEffect } from 'react';
import type { Session as SupabaseSession } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { executeWithTimeout } from '../../../core/utils/SingleFlight';
import type { User } from '../types/auth.types';
import { AUTH_GETSESSION_REFRESH_TIMEOUT_MS } from './authTiming';

export interface CrossTabAuthSyncDeps {
  setUser: (user: User | null) => void;
  setSession: (session: null) => void;
  setIsGuest: (isGuest: boolean) => void;
  updateAuthState: (session: SupabaseSession | null) => Promise<void>;
}

export function useCrossTabAuthSync({ setUser, setSession, setIsGuest, updateAuthState }: CrossTabAuthSyncDeps): void {
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
  }, [updateAuthState, setUser, setSession, setIsGuest]);
}
