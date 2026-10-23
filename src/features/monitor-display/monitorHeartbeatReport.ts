/**
 * Was der Monitor als Wachhalten-Zustand an die Verwaltung meldet (B-48b, @ME-064, @ME-026). React-frei.
 *
 * Die Werte sind die der Spalte `monitor_heartbeats.wake_lock` (Prüfregel `monitor_heartbeats_wake_lock_check`,
 * `supabase/migrations/20261113_101_monitor_heartbeat_wake_lock.sql`). Die Meldung sagt nur, was das Gerät zugesagt
 * hat, nicht ob der Fernseher an ist (@ME-064).
 */
import type { WakeLockStatus } from '../../hooks/useWakeLock';

/** Gemeldeter Zustand; `null` heißt „noch keine Antwort“ (Anfrage läuft oder wurde nicht gestellt). */
export type WakeLockReport = 'granted' | 'denied' | 'no_answer' | 'released' | 'not_applicable';

export interface WakeLockReportContext {
  /** Die Seite läuft als Browser-Quelle der Übertragungs-Software: Wachhalten entfällt dort (@ME-064, D-B48-3). */
  browserQuelle: boolean;
  /**
   * Das Gerät hat auf dieser Seite schon einmal zugesagt. Nimmt es die Zusage zurück, liefert `useWakeLock` bei der
   * neuen Anfrage oft nur noch `denied`. Gemeldet wird dann „zwischenzeitlich freigegeben“ (Nachtrag 17.10.).
   */
  warZugesagt: boolean;
}

/**
 * Abbildung Zustand → Meldung (brief-B-48.md Schritt 3): granted→granted, denied|unsupported→denied, noAnswer→no_answer,
 * released→released, Browser-Quelle→not_applicable, idle|pending→null. Nach einer Zusage wird jeder andere Zustand
 * als `released` gemeldet, bis das Gerät wieder zusagt.
 */
export function wakeLockReport(status: WakeLockStatus, context: WakeLockReportContext): WakeLockReport | null {
  if (context.browserQuelle) { return 'not_applicable'; }
  if (status === 'granted') { return 'granted'; }
  if (context.warZugesagt) { return 'released'; }
  switch (status) {
    case 'denied':
    case 'unsupported':
      return 'denied';
    case 'noAnswer':
      return 'no_answer';
    case 'released':
      return 'released';
    case 'idle':
    case 'pending':
      return null;
  }
}
