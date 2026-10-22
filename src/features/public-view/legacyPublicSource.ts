/**
 * Adapter (a) der Zuschauer-Seite: der heutige Weg (B-15).
 *
 * `getByShareCode` liefert immer das ganze Turnier und kennt kein `since_version`. Die Version einer Antwort ist deshalb
 * der Fingerabdruck ihres Inhalts (`contentVersionOf`): ist er gleich dem, den die Seite schon hält, meldet der Adapter
 * „nichts geändert“, und die Seite rechnet und zeichnet nicht neu. Egress und Anfragen bleiben die des Voll-Abrufs.
 *
 * Grenze des Weges: `getByShareCode` unterscheidet „gibt es nicht“ nicht von einem Fehler (beides `null`). Hält die Seite
 * schon einen Stand, gilt `null` darum als „nicht erreichbar“ (der Stand bleibt, @ZM-109); erst der Server-Weg (b) kann ein
 * Zurücknehmen der Freigabe sicher melden.
 */
import type { Tournament } from '../../types/tournament';
import { SupabaseRepository } from '../../core/repositories/SupabaseRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { isSupabaseConfigured } from '../../lib/supabase';
import { PUBLIC_POLL_INTERVAL_MS, type PublicFetchResult, type PublicTournamentSource } from './publicSource';
import { contentVersionOf } from './publicVersion';
import { MeasuredServerClock, type ServerClock } from './serverClock';

export interface ShareCodeLookup {
  getByShareCode(code: string): Promise<Tournament | null>;
}

/**
 * Standard-Abfrage: Supabase (nur wenn konfiguriert), danach lokaler Speicher. Scheitert Supabase und der lokale Speicher
 * hat nichts, wird der Fehler weitergereicht: „Fehler beim Laden“, nicht „Turnier nicht gefunden“ (C-ZUSCHAUER-LADEFEHLER-ALS-NICHT-GEFUNDEN).
 */
export const defaultShareCodeLookup: ShareCodeLookup = {
  async getByShareCode(code: string): Promise<Tournament | null> {
    let found: Tournament | null = null;
    let cloudError: unknown = null;

    if (isSupabaseConfigured) {
      try {
        found = await new SupabaseRepository().getByShareCode(code);
      } catch (error) {
        cloudError = error;
        console.warn('Supabase lookup failed, trying localStorage:', error);
      }
    }

    if (!found) {
      try {
        found = await new LocalStorageRepository().getByShareCode(code);
      } catch (error) {
        console.warn('LocalStorage lookup failed:', error);
      }
    }

    if (!found && cloudError !== null) {
      throw cloudError instanceof Error ? cloudError : new Error(String(cloudError));
    }
    return found;
  },
};

export interface LegacyPublicSourceOptions {
  /** Serverzeit-Abgleich; Vorgabe: `server_time` des Servers (nur mit Supabase), sonst die Geräteuhr */
  clock?: ServerClock & { ensureMeasured?: () => Promise<void> };
  pollIntervalMs?: number;
}

export function createLegacyPublicSource(
  lookup: ShareCodeLookup = defaultShareCodeLookup,
  options: LegacyPublicSourceOptions = {},
): PublicTournamentSource {
  let measured: (ServerClock & { ensureMeasured?: () => Promise<void> }) | undefined = options.clock;
  const clock = (): ServerClock & { ensureMeasured?: () => Promise<void> } => {
    measured ??= isSupabaseConfigured ? new MeasuredServerClock() : { nowMs: () => Date.now() };
    return measured;
  };

  return {
    kind: 'legacy',
    pollIntervalMs: options.pollIntervalMs ?? PUBLIC_POLL_INTERVAL_MS,
    nowMs: () => clock().nowMs(),
    async fetch(shareCode: string, sinceVersion: string | null): Promise<PublicFetchResult> {
      let found: Tournament | null;
      try {
        // Abgleich und Abruf laufen zugleich: die Zeit der Antwort und die Zeit der Anzeige haben dieselbe Grundlage
        const [tournament] = await Promise.all([lookup.getByShareCode(shareCode), clock().ensureMeasured?.()]);
        found = tournament;
      } catch {
        return { kind: 'unreachable' };
      }
      if (found === null) {
        return sinceVersion === null ? { kind: 'not-found' } : { kind: 'unreachable' };
      }
      const version = contentVersionOf(found);
      return version === sinceVersion ? { kind: 'unchanged', version } : { kind: 'full', version, tournament: found };
    },
  };
}
