/**
 * Zeitgrenzen und Zustandsregeln der Anmeldung (aus AuthContext ausgelagert, Verhalten unverändert).
 * Anmelden Ü1.2/Ü1.3: @AN-019, @AN-020, @AN-032.
 */

import type { ConnectionState } from '../types/auth.types';

/**
 * Maximum time to wait for Supabase auth initialization.
 * After this timeout, the app falls back to offline/guest mode.
 * 15s accounts for cold starts, slow networks, and serverless function warmup.
 */
export const AUTH_INIT_TIMEOUT_MS = 15_000;

/**
 * Per-call timeout for `supabase.auth.getSession()`. Set slightly lower than
 * the umbrella safetyTimeout (AUTH_INIT_TIMEOUT_MS) so the executeWithTimeout
 * wrapper rejects first and the structured catch-block fallback (cached user
 * → offline mode) runs before the broad safety net fires (Sub-Spec 1.5 F1).
 */
export const AUTH_GETSESSION_TIMEOUT_MS = 12_000;

/**
 * Per-call timeout for cross-tab + reconnect `getSession()` calls.
 * Shorter than init because these paths happen after the first successful
 * connection — if they hang, we don't want to block the UI for 12 s.
 */
export const AUTH_GETSESSION_REFRESH_TIMEOUT_MS = 8_000;

/**
 * Maximum number of retry attempts for transient auth errors (e.g., AbortError).
 * Uses exponential backoff: 1s, 2s, 4s, 8s, 8s
 */
export const AUTH_MAX_RETRIES = 5;

/**
 * Base delay for exponential backoff (in milliseconds).
 */
export const AUTH_RETRY_BASE_DELAY_MS = 1_000;

/**
 * Maximum delay between retries (cap for exponential backoff).
 */
export const AUTH_RETRY_MAX_DELAY_MS = 8_000;

/**
 * Interval for periodic reconnect attempts when offline.
 */
export const AUTH_RECONNECT_INTERVAL_MS = 30_000;

/**
 * Quick retry delay after transient abort errors during reconnect.
 */
export const AUTH_ABORT_RETRY_DELAY_MS = 2_000;

/**
 * Ab dieser Wartezeit auf die Antwort des Servers zeigt die App „Server antwortet langsam“
 * (Anmelden Ü1.3, @AN-032: länger als 5 Sekunden). Kein „offline“, keine Sperre.
 */
export const SERVER_SLOW_AFTER_MS = 5_000;

/** Meldet das Gerät selbst „kein Netz“, ist eine ausbleibende Antwort keine langsame Antwort. */
export const isBrowserOffline = (): boolean => typeof navigator !== 'undefined' && !navigator.onLine;

/**
 * Verbindungszustand nach einem gescheiterten Versuch. Blieb die Antwort nur aus (Zeitüberschreitung)
 * und das Gerät meldet Netz, ist der Server langsam, nicht „offline“ (@AN-032): der Zustand bleibt
 * „connecting“, die Wiederverbindung läuft weiter (Hinweis „Server antwortet langsam“).
 * Eine gescheiterte Prüfung (Netzfehler) oder ein Gerät ohne Netz bleibt „offline“.
 */
export const stateAfterFailure = (error: unknown): ConnectionState =>
  error instanceof Error && error.message.includes('timed out') && !isBrowserOffline()
    ? 'connecting'
    : 'offline';
