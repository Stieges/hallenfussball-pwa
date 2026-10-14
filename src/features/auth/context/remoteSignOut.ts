/**
 * Abmeldung durch ein anderes Gerät (A-07d2, @AN-024 „Das verlorene Handy merkt die Abmeldung“).
 *
 * - Merker: Ein Abmelden auf diesem Gerät setzt `markOwnSignOut()`. Ein SIGNED_OUT ohne
 *   diesen Merker kommt vom Server (anderes Gerät hat „alle anderen“ abgemeldet) und löst den
 *   Hinweis auf der Anmeldeseite aus. Der Merker liegt in localStorage, damit auch andere Tabs
 *   (auth-js-BroadcastChannel) ein eigenes Abmelden erkennen.
 * - Prüfung: beim Start, bei `online` und bei `visibilitychange` (sichtbar) fragt `getUser()` den
 *   Server. Antwortet der Server mit einem Fehler über die Sitzung (z. B. 403 `session_not_found`,
 *   beim Client `AuthSessionMissingError`), wird lokal abgemeldet – ohne Löschen der Ausgangs-
 *   Einträge (A-07b). Netzfehler und 5xx sind keine Antwort über die Sitzung → nichts passiert.
 */

import { useEffect, useRef } from 'react';
import { isAuthError, isAuthRetryableFetchError, type SupabaseClient } from '@supabase/supabase-js';
import { safeLocalStorage, safeSessionStorage } from '../../../core/utils/safeStorage';
import { captureFeatureError } from '../../../lib/sentry';

export const SIGNED_OUT_ELSEWHERE_KEY = 'auth:signedOutElsewhere';
const OWN_SIGN_OUT_KEY = 'auth:ownSignOutAt';
/** Wie lange ein eigenes Abmelden als Ursache eines SIGNED_OUT gilt (auth-js meldet synchron genug). */
export const OWN_SIGN_OUT_WINDOW_MS = 10_000;

/** Merker setzen: dieses Gerät meldet sich selbst ab (aufgerufen von logoutAction). */
export function markOwnSignOut(now: number = Date.now()): void {
  safeLocalStorage.setItem(OWN_SIGN_OUT_KEY, String(now));
}

/** Ist ein eigenes Abmelden (auf diesem Gerät oder in einem anderen Tab) gerade eben passiert? */
export function isOwnSignOutRecent(now: number = Date.now()): boolean {
  const at = Number(safeLocalStorage.getItem(OWN_SIGN_OUT_KEY));
  return Number.isFinite(at) && at <= now && now - at < OWN_SIGN_OUT_WINDOW_MS;
}

export function hasSignedOutElsewhere(): boolean {
  return safeSessionStorage.getItem(SIGNED_OUT_ELSEWHERE_KEY) === '1';
}

export function setSignedOutElsewhere(): void {
  safeSessionStorage.setItem(SIGNED_OUT_ELSEWHERE_KEY, '1');
}

export function clearSignedOutElsewhere(): void {
  safeSessionStorage.removeItem(SIGNED_OUT_ELSEWHERE_KEY);
}

/**
 * Antwort des Servers, dass diese Sitzung nicht mehr gilt. Alles ohne Auth-Fehlerklasse
 * (Abbruch, Netz) und Netz-/5xx-Fehler (`AuthRetryableFetchError`) zählt nicht.
 */
export function isSessionRejectedByServer(error: unknown): boolean {
  return isAuthError(error) && !isAuthRetryableFetchError(error);
}

export type SessionCheckOutcome = 'valid' | 'rejected' | 'unknown';

/** Fragt den Server nach dem Konto dieser Sitzung. Wirft nicht. */
export async function verifySessionOnServer(client: SupabaseClient): Promise<SessionCheckOutcome> {
  try {
    const { error } = await client.auth.getUser();
    if (!error) {
      return 'valid';
    }
    return isSessionRejectedByServer(error) ? 'rejected' : 'unknown';
  } catch (err) {
    if (err instanceof Error) {
      captureFeatureError(err, 'auth', 'remoteSessionCheck');
    }
    return 'unknown';
  }
}

/**
 * Prüft die Sitzung beim Start, bei `online` und bei `visibilitychange` (sichtbar), solange
 * `enabled` gilt. Bei `rejected` meldet `signOutLocal` lokal ab, danach erscheint der Hinweis.
 */
export function useRemoteSessionCheck(
  client: SupabaseClient | null,
  enabled: boolean,
  signOutLocal: () => Promise<unknown>,
): void {
  const signOutRef = useRef(signOutLocal);
  useEffect(() => {
    signOutRef.current = signOutLocal;
  });

  useEffect(() => {
    if (!enabled || !client) {
      return;
    }
    let inFlight = false;
    const run = (): void => {
      if (inFlight) {
        return;
      }
      inFlight = true;
      void verifySessionOnServer(client)
        .then(async (outcome) => {
          if (outcome === 'rejected') {
            await signOutRef.current();
            setSignedOutElsewhere();
          }
        })
        .catch((err: unknown) => {
          if (err instanceof Error) {
            captureFeatureError(err, 'auth', 'remoteSignOut');
          }
        })
        .finally(() => {
          inFlight = false;
        });
    };
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') {
        run();
      }
    };
    run();
    window.addEventListener('online', run);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('online', run);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [client, enabled]);
}
