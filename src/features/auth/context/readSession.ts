/**
 * Sitzung vom Client lesen, ohne dass Fehler still als „abgemeldet“ enden (Anmelden Ü1.2, @AN-019, @AN-020).
 *
 * `getSession()` wirft nicht: bei einem Netzfehler während der Erneuerung liefert es `session: null` mit
 * `error`, bei einer vom Server abgelehnten Erneuerung auch (oder `null` ohne Fehler, wenn der Client sie
 * schon beim Laden abgelehnt hat). Diese Funktion trennt die Fälle für alle Aufrufer gleich:
 * - Fehler → wird geworfen (Aufrufer: abgelehnt = Meldung, sonst Nutzerkopie behalten und erneut versuchen).
 * - Nutzerkopie war da, jetzt keine Sitzung, kein eigenes Abmelden → der Server hat die Erneuerung
 *   abgelehnt (@AN-024, B5).
 *
 * B5 (Wettlauf in auth-js `initialize`): Der Client erneuert schon beim Import. Lehnt der Server ab, bevor die
 * App `onAuthStateChange` abonniert hat, löscht `_removeSession` den Zugangsschlüssel und verteilt SIGNED_OUT an
 * niemanden. Die Erkennung hängt deshalb NICHT am Schlüssel von auth-js, sondern an der Nutzerkopie
 * (`auth:cachedUser`): Die App schreibt sie bei jeder Sitzung und löscht sie nur beim Ende der Sitzung
 * (SIGNED_OUT, eigenes Abmelden, hier).
 */

import type { Session as SupabaseSession, SupabaseClient } from '@supabase/supabase-js';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import { executeWithTimeout } from '../../../core/utils/SingleFlight';
import { applySessionEnded } from './authEventEffects';

/** Nutzerkopie der App: steht, solange auf diesem Gerät eine Sitzung bestand und nicht beendet wurde. */
const CACHED_USER_KEY = 'auth:cachedUser';

/** Schlüssel, unter dem dieser Client seine Sitzung speichert (`sb-<projekt>-auth-token`), falls lesbar. */
function ownStorageKey(client: SupabaseClient): string | null {
  const key = (client.auth as unknown as { storageKey?: unknown }).storageKey;
  return typeof key === 'string' ? key : null;
}

/**
 * Liegt ein Zugangsschlüssel DIESES Clients auf dem Gerät? Schlüssel anderer Projekte (etwa ein alter
 * `sb-…-auth-token` auf localhost) zählen nicht. Nur falls auth-js den Schlüssel nicht preisgibt, gilt das Muster.
 */
export function hasStoredAuthToken(client: SupabaseClient): boolean {
  const own = ownStorageKey(client);
  if (own) {
    return safeLocalStorage.getItem(own) !== null;
  }
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
  // Vor dem Lesen merken: ein zugestelltes SIGNED_OUT löscht die Kopie während des Wartens.
  const hadSession = safeLocalStorage.getItem(CACHED_USER_KEY) !== null;
  const read = () => client.auth.getSession();
  const { data: { session }, error } = await (timeoutMs === undefined ? read() : executeWithTimeout(read, timeoutMs));
  if (error) {
    throw error;
  }
  if (!session && hadSession) {
    // Wie SIGNED_OUT: Kopie weg (keine Daten mehr, kein erneuter Hinweis beim nächsten Lesen), Hinweis ohne eigenes Abmelden.
    applySessionEnded();
  }
  return session;
}
