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
import { subscribeDisplaySignal } from '../../core/realtime/displaySignal';
import { subscribeLocalDisplaySignal, withLocalEngineState } from './localDisplay';

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
  /**
   * Änderungssignal (R5 PR 1): ruft `onChange` ohne Inhalt, sobald sich das Turnier geändert haben kann (Server-Signal
   * `display:<id>`, im selben Browser auch die Engine). Gibt die Abmeldung zurück. Fehlt es, bleibt nur der Rückfall-Takt.
   */
  subscribe?(onChange: () => void): () => void;
}

// L2: Der Server-Aufruf hat kein eingebautes Timeout. Ohne Begrenzung würde ein hängender Request den Abruf dauerhaft
// belegen – beim Erstladen bliebe der Spinner stehen statt auf lokal zurückzufallen. Seit R5 PR 1 merkt sich der Hook
// Anstöße während eines Abrufs (Signal, Rückfall-Takt 2 s) und holt danach genau einmal nach; die Grenze bleibt 4 s,
// damit ein Hänger nach spätestens zwei Takten endet. Der Request läuft nach dem Timeout im Hintergrund aus.
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
 * `subscribe` meldet Änderungen sofort (R5 PR 1): Server-Signal `display:<id>` und, im selben Browser, die Engine.
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
    subscribe(onChange: () => void): () => void {
      const offServer = subscribeDisplaySignal(tournamentId, onChange);
      const offLocal = subscribeLocalDisplaySignal(onChange);
      return () => { offServer(); offLocal(); };
    },
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
      // @ZM-179: Einträge eines Turniers nur auf diesem Gerät stehen in den Engine-Kopien dieses Browsers.
      found = await withLocalEngineState(found);

      const monitor = found.monitors?.find((m: TournamentMonitor) => m.id === monitorId) ?? null;
      return { kind: 'snapshot', version: null, tournament: found, monitor, origin: 'local', lookupFailed };
    },
  };
}
