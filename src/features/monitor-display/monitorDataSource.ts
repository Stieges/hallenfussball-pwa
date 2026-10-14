/**
 * Datenquelle des Monitors (B-16b1) – React-frei.
 *
 * Herausgelöst aus MonitorDisplayPage.loadData (Abruf-Teil). Die Seite selbst bleibt in b1
 * unverändert; die Verdrahtung folgt in B-16b2.
 */
import i18n from 'i18next';
import { SupabaseRepository } from '../../core/repositories/SupabaseRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { isSupabaseConfigured } from '../../lib/supabase';
import type { Tournament } from '../../types/tournament';
import type { TournamentMonitor } from '../../types/monitor';

export type DisplayOrigin = 'cloud' | 'local';

export type DisplayDelta =
  | { kind: 'unchanged' }
  | {
      kind: 'snapshot';
      version: string | null;
      tournament: Tournament;
      monitor: TournamentMonitor | null;
      origin: DisplayOrigin;
      lookupFailed: boolean;
    }
  | { kind: 'missing'; lookupFailed: boolean };

export interface MonitorDataSource {
  fetch(sinceVersion: string | null): Promise<DisplayDelta>;
}

// L2: SupabaseRepository.get() hat kein eingebautes Timeout. Ohne Begrenzung würde ein
// hängender Request isFetchingRef dauerhaft auf true halten und damit jeden weiteren
// Poll-Tick blockieren — beim Erstladen bliebe der Spinner stehen statt auf lokal
// zurückzufallen. Bewusst deutlich UNTER der schnellsten konfigurierten pollingInterval
// (PERFORMANCE_PROFILES.high = 5000ms, siehe types/monitor.ts) gewählt, damit ein Hänger
// nicht auch noch den nächsten Poll-Tick verschluckt (der sonst wegen isFetchingRef
// überspringen würde). Der zugrunde liegende Request läuft nach dem Timeout einfach weiter
// im Hintergrund aus — wir warten nur nicht mehr darauf.
const CLOUD_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(i18n.t('monitor:error.cloudTimeout', { ms }))), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err instanceof Error ? err : new Error(String(err))); }
    );
  });
}

/**
 * Legacy-Quelle: Cloud zuerst (nur bei konfiguriertem Supabase, begrenzt durch CLOUD_TIMEOUT_MS),
 * danach LocalStorage. Ignoriert sinceVersion und liefert nie `unchanged`.
 */
export function createLegacyMonitorSource(tournamentId: string, monitorId: string): MonitorDataSource {
  return {
    async fetch(): Promise<DisplayDelta> {
      let found: Tournament | null = null;
      let origin: DisplayOrigin = 'local';
      let lookupFailed = false;

      // L2: Cloud zuerst — ein Hallen-Monitor läuft auf einem fremden Gerät ohne localStorage.
      if (isSupabaseConfigured) {
        try {
          // Kein Timeout im Repository -> hier begrenzen. Ohne das blockiert ein hängender
          // Request über isFetchingRef jeden weiteren Poll-Tick auf unbestimmte Zeit.
          found = await withTimeout(new SupabaseRepository().get(tournamentId), CLOUD_TIMEOUT_MS);
          if (found) { origin = 'cloud'; }
        } catch (err) {
          lookupFailed = true;
          console.warn('[MonitorDisplay] Supabase-Lookup fehlgeschlagen, versuche lokal:', err);
        }
      }
      if (!found) {
        try {
          found = await new LocalStorageRepository().get(tournamentId);
        } catch (err) {
          lookupFailed = true;
          console.warn('[MonitorDisplay] LocalStorage-Lookup fehlgeschlagen:', err);
        }
      }

      if (!found) {
        return { kind: 'missing', lookupFailed };
      }

      const monitor = found.monitors?.find((m: TournamentMonitor) => m.id === monitorId) ?? null;
      return { kind: 'snapshot', version: null, tournament: found, monitor, origin, lookupFailed };
    },
  };
}
