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

export interface LogoutOptions {
  scope?: 'local';
}

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

export async function logout(deps: LogoutDeps, options: LogoutOptions = { scope: 'local' }): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    cleanupLocal(deps);
    return;
  }

  try {
    // auth-js gibt Fehler zurück, statt zu werfen (z. B. offline mit abgelaufenem Zugang).
    const { error } = await supabase.auth.signOut({ scope: options.scope ?? 'local' });
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
}
