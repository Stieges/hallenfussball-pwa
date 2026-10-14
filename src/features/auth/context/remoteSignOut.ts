/**
 * Abmeldung durch ein anderes Gerät (A-07d2, @AN-024 „Das verlorene Handy merkt die Abmeldung“).
 *
 * - Merker: Ein Abmelden auf diesem Gerät setzt `markOwnSignOut()` und gilt bis zum nächsten
 *   SIGNED_IN (kein Zeitfenster, M2). Ein SIGNED_OUT ohne diesen Merker kommt vom Server (anderes
 *   Gerät hat „alle anderen“ abgemeldet) und löst den Hinweis aus. Der Merker liegt in localStorage,
 *   damit auch andere Tabs (auth-js-BroadcastChannel) ein eigenes Abmelden erkennen.
 * - Prüfung: beim Start, bei `online` und bei `visibilitychange` (sichtbar) fragt `getUser()` den
 *   Server (mit Zeitgrenze, M3). Nur eine Positivliste zählt als Antwort „Sitzung weg“ (B1): Uhr,
 *   Rate-Limit, Proxy-Seiten, Refresh-Wettlauf und Netz bleiben angemeldet.
 */

import { useEffect, useRef } from 'react';
import {
  isAuthApiError,
  isAuthSessionMissingError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { safeLocalStorage, safeSessionStorage } from '../../../core/utils/safeStorage';
import { executeWithTimeout } from '../../../core/utils/SingleFlight';
import { captureFeatureError } from '../../../lib/sentry';

export const SIGNED_OUT_ELSEWHERE_KEY = 'auth:signedOutElsewhere';
/** window-Ereignis, sobald sich der Hinweis ändert (die Meldung im App-Baum liest ihn neu). */
export const SIGNED_OUT_ELSEWHERE_CHANGED = 'auth:signedOutElsewhereChanged';
const OWN_SIGN_OUT_KEY = 'auth:ownSignOut';
/** Obergrenze für die Prüfung über die Sitzung. Danach gilt sie als „unbekannt“ und blockiert nichts (M3). */
export const REMOTE_CHECK_TIMEOUT_MS = 8_000;

/**
 * Codes, mit denen GoTrue sagt: diese Sitzung oder dieses Konto gibt es serverseitig nicht mehr.
 * Alles andere (403 bad_jwt bei falscher Uhr, 429, unbekannte Fehler) ist keine Aussage über die Sitzung.
 */
const SESSION_GONE_CODES: readonly string[] = [
  'session_not_found',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_expired',
  'user_not_found',
];

/** Merker setzen: dieses Gerät meldet sich selbst ab (aufgerufen von logoutAction). */
export function markOwnSignOut(): void {
  safeLocalStorage.setItem(OWN_SIGN_OUT_KEY, '1');
}

/** Hat dieses Gerät (oder ein anderer Tab) sich seit dem letzten SIGNED_IN selbst abgemeldet? */
export function isOwnSignOut(): boolean {
  return safeLocalStorage.getItem(OWN_SIGN_OUT_KEY) !== null;
}

/** Merker löschen: ein neues SIGNED_IN beginnt eine neue Sitzung. */
export function clearOwnSignOut(): void {
  safeLocalStorage.removeItem(OWN_SIGN_OUT_KEY);
}

function notifySignedOutElsewhereChanged(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(SIGNED_OUT_ELSEWHERE_CHANGED));
  }
}

export function hasSignedOutElsewhere(): boolean {
  return safeSessionStorage.getItem(SIGNED_OUT_ELSEWHERE_KEY) === '1';
}

export function setSignedOutElsewhere(): void {
  safeSessionStorage.setItem(SIGNED_OUT_ELSEWHERE_KEY, '1');
  notifySignedOutElsewhereChanged();
}

export function clearSignedOutElsewhere(): void {
  safeSessionStorage.removeItem(SIGNED_OUT_ELSEWHERE_KEY);
  notifySignedOutElsewhereChanged();
}

/**
 * Antwort des Servers, dass diese Sitzung nicht mehr gilt: `AuthSessionMissingError` (der Client
 * übersetzt `session_not_found` so) oder ein `AuthApiError` mit einem der Codes oben.
 */
export function isSessionRejectedByServer(error: unknown): boolean {
  return isAuthSessionMissingError(error)
    || (isAuthApiError(error) && SESSION_GONE_CODES.includes(error.code ?? ''));
}

export type SessionCheckOutcome = 'valid' | 'rejected' | 'unknown';

/** Fragt den Server nach dem Konto dieser Sitzung. Wirft nicht, blockiert nicht länger als REMOTE_CHECK_TIMEOUT_MS. */
export async function verifySessionOnServer(client: SupabaseClient): Promise<SessionCheckOutcome> {
  try {
    const { error } = await executeWithTimeout(() => client.auth.getUser(), REMOTE_CHECK_TIMEOUT_MS);
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
