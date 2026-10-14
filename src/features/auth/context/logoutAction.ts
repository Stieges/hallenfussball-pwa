/**
 * Abmelden (A-07a) – meldet nur dieses Gerät ab und löscht keine Turnierdaten.
 *
 * - `scope: 'local'`: nur die Sitzung dieses Geräts. Andere Geräte bleiben angemeldet.
 * - Der Ausgang für Turnierdaten (`mutation_queue_v1`, `…failed_v1`) bleibt unberührt
 *   (@FU-006: nach erneuter Anmeldung desselben Kontos wird er gesendet).
 * - Schlägt `signOut` fehl (offline, Zugang abgelaufen), entfernt die App die
 *   `sb-*-auth-token`-Schlüssel selbst, damit das Gerät nach einem Neuladen nicht
 *   wieder angemeldet ist (@AN-023).
 *
 * @see authActions.ts (Delegation)
 */

import { supabase, isSupabaseConfigured } from '../../../lib/supabase';
import { safeLocalStorage } from '../../../core/utils/safeStorage';
import { clearProfileCache } from '../services/profileCacheService';
import { captureFeatureError, setUserContext as setSentryUserContext } from '../../../lib/sentry';
import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js';
import { clearSignedOutElsewhere, markOwnSignOut } from './remoteSignOut';

export interface LogoutOptions {
  /** `local`: nur dieses Gerät. `others`: alle anderen Geräte, dieses bleibt angemeldet (A-07d1). */
  scope?: 'local' | 'others';
}

/** Ergebnis des Abmeldens. Nur `others` meldet Fehler zurück; `local` räumt in jedem Fall auf. */
export type LogoutResult =
  | { ok: true }
  | { ok: false; reason: 'unavailable' | 'session' | 'network' | 'server' };

/** Nur die Zustandssetter, die das Abmelden braucht (strukturell kompatibel zu AuthActionDeps). */
export interface LogoutDeps {
  setUser: (user: null) => void;
  setSession: (session: null) => void;
  setIsGuest: (isGuest: boolean) => void;
}

/** Entfernt die Supabase-Sitzungsschlüssel direkt aus dem Speicher. */
function removeSupabaseTokens(): void {
  for (let i = safeLocalStorage.length - 1; i >= 0; i--) {
    const key = safeLocalStorage.key(i);
    if (key?.startsWith('sb-') && key?.endsWith('-auth-token')) {
      safeLocalStorage.removeItem(key);
    }
  }
}

/** Lokaler Aufräumschritt, läuft in jedem Fall. Ausgang (Warteschlangen) bleibt bewusst erhalten. */
function cleanupLocal(deps: LogoutDeps): void {
  safeLocalStorage.removeItem('auth:guestUser');
  safeLocalStorage.removeItem('auth:cachedUser');
  for (const key of ['auth:session', 'auth:currentUser', 'users']) {
    safeLocalStorage.removeItem(key);
  }
  void clearProfileCache();
  deps.setUser(null);
  setSentryUserContext(null);
  deps.setSession(null);
  deps.setIsGuest(false);
}

/**
 * Grund für einen Fehler beim Abmelden der anderen Geräte.
 * 401/403/404 = diese Sitzung ist serverseitig nicht mehr gültig; `network` nur ohne HTTP-Antwort
 * (status 0); alles andere (5xx, 429, unbekannt) = `server`.
 */
function reasonForOthersFailure(error: unknown): 'session' | 'network' | 'server' {
  if (isAuthApiError(error) && [401, 403, 404].includes(error.status)) {
    return 'session';
  }
  if (isAuthRetryableFetchError(error) && error.status === 0) {
    return 'network';
  }
  return 'server';
}

/**
 * Abmelden auf allen anderen Geräten (@AN-024). Nur der Server-Aufruf mit dem Zugang dieses Geräts
 * (`admin.signOut(jwt, 'others')`, öffentlicher `/logout`-Endpunkt, keine Service-Rolle): kein
 * lokales Aufräumen, kein `setUser(null)`, dieses Gerät bleibt angemeldet. Fehler kommen als
 * Rückgabe, nie still. `supabase.auth.signOut({scope:'others'})` wird bewusst nicht genutzt: auth-js
 * meldet dort keine Fehler, wenn keine Sitzung da ist (`_signOut`, GoTrueClient.ts:4080ff).
 */
async function logoutOthers(): Promise<LogoutResult> {
  if (!isSupabaseConfigured || !supabase) {
    return { ok: false, reason: 'unavailable' };
  }
  try {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      // Ohne Netzfehler gilt die Sitzung hier als abgelaufen (R-1); 5xx bleibt `server`.
      if (isAuthRetryableFetchError(sessionError)) {
        return { ok: false, reason: sessionError.status === 0 ? 'network' : 'server' };
      }
      return { ok: false, reason: 'session' };
    }
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      return { ok: false, reason: 'session' };
    }
    const { error } = await supabase.auth.admin.signOut(accessToken, 'others');
    if (!error) {
      return { ok: true };
    }
    return { ok: false, reason: reasonForOthersFailure(error) };
  } catch (err) {
    if (err instanceof Error) {
      captureFeatureError(err, 'auth', 'logout');
    }
    return { ok: false, reason: reasonForOthersFailure(err) };
  }
}

export async function logout(deps: LogoutDeps, options: LogoutOptions = { scope: 'local' }): Promise<LogoutResult> {
  if (options.scope === 'others') {
    return logoutOthers();
  }
  // Eigenes Abmelden: kein „von einem anderen Gerät abgemeldet“-Hinweis (A-07d2).
  markOwnSignOut();
  clearSignedOutElsewhere();
  if (!isSupabaseConfigured || !supabase) {
    cleanupLocal(deps);
    return { ok: true };
  }

  try {
    // auth-js gibt Fehler zurück, statt zu werfen (z. B. offline mit abgelaufenem Zugang).
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) {
      removeSupabaseTokens();
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.error('Logout signOut error:', err);
    }
    if (err instanceof Error) {
      captureFeatureError(err, 'auth', 'logout');
    }
    removeSupabaseTokens();
  } finally {
    cleanupLocal(deps);
  }
  return { ok: true };
}
