/**
 * Datenquelle des Monitors (B-16b1, B-14) – React-frei.
 *
 * Herausgelöst aus MonitorDisplayPage.loadData (Abruf-Teil). Seit B-14 liest der Monitor die Cloud nur noch über die
 * Server-Funktion mit Positivliste (anon liest die Tabellen nicht mehr direkt).
 */
import { anzeigeT } from '../../i18n/anzeigeSprache';
import { SupabaseRepository } from '../../core/repositories/SupabaseRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { applyPublicMatches } from '../../core/repositories/publicPayload';
import { isSupabaseConfigured } from '../../lib/supabase';
import { UnreadableResponseError } from '../../core/errors';
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
  | { kind: 'missing'; lookupFailed: boolean }
  /** Antwort, die der Monitor nicht lesen kann (B-19b, @ME-032): Bild bleibt, sofort neu laden. */
  | { kind: 'unreadable' };

export interface MonitorDataSource {
  fetch(sinceVersion: string | null): Promise<DisplayDelta>;
}

// L2: Der Server-Aufruf hat kein eingebautes Timeout. Ohne Begrenzung würde ein
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
    const timer = setTimeout(() => reject(new Error(anzeigeT('monitor:error.cloudTimeout', { ms }))), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err: unknown) => { clearTimeout(timer); reject(err instanceof Error ? err : new Error(String(err))); }
    );
  });
}

/** `since_version` aus dem gemerkten Stand: nur eine ganze Zahl zählt, sonst „noch nichts“ (volle Antwort). */
function sinceOf(sinceVersion: string | null): number | null {
  if (sinceVersion === null) {
    return null;
  }
  const parsed = Number(sinceVersion);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Quelle des Monitors (B-14, E-A2): Cloud über die Server-Funktion `display_tournament(tournament_id, monitor_id,
 * since_version)` -- Positivliste mit Schiedsrichtern, nur der eigene Monitor, auch ohne Online-Teilen (@ZM-101) --,
 * begrenzt durch CLOUD_TIMEOUT_MS; danach LocalStorage. Mit gemerktem Stand fragt sie nur nach Änderungen
 * (`unchanged` bzw. geänderte Spiele, E-A3). Übergang bis zur Bildschirm-Kopplung (B-20/B-21).
 */
export function createMonitorSource(tournamentId: string, monitorId: string): MonitorDataSource {
  let held: Tournament | null = null;

  async function fromCloud(sinceVersion: string | null): Promise<DisplayDelta | 'not-found'> {
    const since = held === null ? null : sinceOf(sinceVersion);
    const reply = await withTimeout(new SupabaseRepository().getForDisplay(tournamentId, monitorId, since), CLOUD_TIMEOUT_MS);
    switch (reply.kind) {
      case 'not-found':
        held = null;
        return 'not-found';
      case 'unchanged':
        return { kind: 'unchanged' };
      case 'full':
        held = reply.tournament;
        break;
      case 'delta':
        if (held === null) {
          return fromCloud(null);
        }
        held = applyPublicMatches(held, reply.matches, reply.removedMatchIds);
        break;
    }
    const monitor = held.monitors?.find((m: TournamentMonitor) => m.id === monitorId) ?? null;
    return { kind: 'snapshot', version: String(reply.version), tournament: held, monitor, origin: 'cloud', lookupFailed: false };
  }

  return {
    async fetch(sinceVersion: string | null): Promise<DisplayDelta> {
      let lookupFailed = false;

      // L2: Cloud zuerst — ein Hallen-Monitor läuft auf einem fremden Gerät ohne localStorage.
      if (isSupabaseConfigured) {
        try {
          const cloud = await fromCloud(sinceVersion);
          if (cloud !== 'not-found') {
            return cloud;
          }
        } catch (err) {
          // B-19b (@ME-032): nur eine nicht abbildbare Antwort ist „unlesbar“. Netz- und Abfragefehler
          // bleiben der Rückfall auf die lokale Kopie; eine Störung ist nie „nicht gefunden“ (@ZM-109).
          if (err instanceof UnreadableResponseError) {
            return { kind: 'unreadable' };
          }
          lookupFailed = true;
          held = null;
          console.warn('[MonitorDisplay] Server-Abfrage fehlgeschlagen, versuche lokal:', err);
        }
      }

      let found: Tournament | null = null;
      try {
        found = await new LocalStorageRepository().get(tournamentId);
      } catch (err) {
        lookupFailed = true;
        console.warn('[MonitorDisplay] LocalStorage-Lookup fehlgeschlagen:', err);
      }

      if (!found) {
        return { kind: 'missing', lookupFailed };
      }

      const monitor = found.monitors?.find((m: TournamentMonitor) => m.id === monitorId) ?? null;
      return { kind: 'snapshot', version: null, tournament: found, monitor, origin: 'local', lookupFailed };
    },
  };
}
