/**
 * Sitzung vom Client lesen, ohne dass Fehler still als „abgemeldet“ enden (Anmelden Ü1.2, @AN-019, @AN-020).
 *
 * `getSession()` wirft nicht: bei einem Netzfehler während der Erneuerung liefert es `session: null` mit
 * `error`, bei einer vom Server abgelehnten Erneuerung auch (oder `null` ohne Fehler, wenn der Client sie
 * schon beim Laden abgelehnt hat). Diese Funktion trennt die Fälle für alle Aufrufer gleich:
 * - Fehler → wird geworfen (Aufrufer: abgelehnt = Meldung, sonst Nutzerkopie behalten und erneut versuchen).
 * - gespeicherte Anmeldung war da, jetzt keine Sitzung, kein eigenes Abmelden → der Server hat die Erneuerung
 *   abgelehnt, auch wenn das Ereignis SIGNED_OUT vor dem Abonnieren verteilt wurde (Wettlauf in auth-js
 *   `initialize`): Hinweis „von einem anderen Gerät aus abgemeldet“ (@AN-024), solange Ablauf und Widerruf
 *   nicht unterscheidbar sind.
 */

import type { Session as SupabaseSession, SupabaseClient } from '@supabase/supabase-js';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import { executeWithTimeout } from '../../../core/utils/SingleFlight';
import { isOwnSignOut, setSignedOutElsewhere } from './remoteSignOut';

/** Liegt ein Zugangsschlüssel des Clients (`sb-…-auth-token`) auf dem Gerät? */
export function hasStoredAuthToken(): boolean {
  for (let i = 0; i < safeLocalStorage.length; i++) {
    const key = safeLocalStorage.key(i);
    if (key?.startsWith('sb-') && key.endsWith('-auth-token')) {
      return true;
    }
  }
  return false;
}

export async function readSessionOrThrow(
  client: SupabaseClient,
  timeoutMs?: number,
): Promise<SupabaseSession | null> {
  const hadStoredToken = hasStoredAuthToken();
  const read = () => client.auth.getSession();
  const { data: { session }, error } = await (timeoutMs === undefined ? read() : executeWithTimeout(read, timeoutMs));
  if (error) {
    throw error;
  }
  if (!session && hadStoredToken && !isOwnSignOut()) {
    setSignedOutElsewhere();
  }
  return session;
}
