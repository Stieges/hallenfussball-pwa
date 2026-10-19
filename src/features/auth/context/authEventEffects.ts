/**
 * Seiteneffekte einzelner Auth-Ereignisse aus onAuthStateChange (vor dem Zustandsupdate).
 *
 * Läuft synchron-nah im Callback; die Arbeit selbst wird vom Aufrufer per setTimeout gestartet.
 * SIGNED_IN/SIGNED_OUT werten zusätzlich den Merker „eigenes Abmelden“ aus (A-07d2, @AN-024).
 */

import type { AuthChangeEvent, Session as SupabaseSession } from '@supabase/supabase-js';
import { safeLocalStorage, safeSessionStorage } from '../../../core/utils/safeStorage';
import { captureFeatureError } from '../../../lib/sentry';
import { clearProfileCache } from '../services/profileCacheService';
import { clearSessionExpired, hasSessionExpired, setSessionExpired } from './sessionExpired';
import { clearOwnSignOut, clearSignedOutElsewhere, isOwnSignOut, setSignedOutElsewhere } from './remoteSignOut';

export function applyAuthEventEffects(
  event: AuthChangeEvent,
  newSession: SupabaseSession | null,
  setIsGuest: (isGuest: boolean) => void,
  /** true, solange die App startet: die gespeicherte Anmeldung ging beim Erneuern verloren. */
  duringStart = false,
): void {
  // Handle password recovery - set flag with TTL for AuthCallback to redirect
  if (event === 'PASSWORD_RECOVERY' && newSession) {
    const recoveryData = JSON.stringify({
      pending: true,
      expiresAt: Date.now() + 10 * 60 * 1000  // 10 minutes TTL
    });
    safeSessionStorage.setItem('auth:passwordRecovery', recoveryData);
  }

  // Clear guest state on real login
  if (event === 'SIGNED_IN' && newSession) {
    safeLocalStorage.removeItem('auth:guestUser');
    setIsGuest(false);
    clearSignedOutElsewhere();
    clearSessionExpired();
    // Neue Sitzung: ein eigenes Abmelden davor zählt nicht mehr (M2, kein Zeitfenster).
    clearOwnSignOut();
  }

  // On sign out (including server-side token revocation),
  // always clear local caches to prevent stale data restoration
  if (event === 'SIGNED_OUT') {
    safeLocalStorage.removeItem('auth:cachedUser');
    safeLocalStorage.removeItem('auth:guestUser');
    void clearProfileCache();
    // Ohne eigenes Abmelden kam das Ende der Sitzung vom Server: Hinweis auf der Anmeldeseite.
    if (!isOwnSignOut()) {
      if (duringStart) {
        // Die gespeicherte Anmeldung ging beim Start verloren: der Server lehnte die Erneuerung ab
        // (Ablauf oder Widerruf, beides `refresh_token_not_found`). Klare Meldung statt Stille (Ü1.2).
        setSessionExpired();
      } else if (!hasSessionExpired()) {
        setSignedOutElsewhere();
      }
    }
  }
}

/** Fehler im onAuthStateChange-Zweig (N2) melden, ohne sie zu verschlucken. */
export function reportAuthCallbackError(err: unknown): void {
  captureFeatureError(err instanceof Error ? err : new Error(String(err)), 'auth', 'onAuthStateChange');
}
