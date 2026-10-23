/**
 * Adapter (a) der Zuschauer-Seite: der heutige Weg (B-15). Ohne festen Takt (siehe `pollIntervalMs`).
 *
 * `getByShareCode` liefert immer das ganze Turnier und kennt kein `since_version`. Die Version einer Antwort ist deshalb
 * der Fingerabdruck ihres Inhalts (`contentVersionOf`): ist er gleich dem, den die Seite schon hält, meldet der Adapter
 * „nichts geändert“, und die Seite rechnet und zeichnet nicht neu. Egress und Anfragen bleiben die des Voll-Abrufs.
 *
 * `getByShareCode` unterscheidet „gibt es nicht“ nicht von einem Fehler (beides `null`); die Standard-Abfrage fragt deshalb bei
 * `null` mit `assertShareCodeUnknown` nach: Fehler oder vorhandene Zeile werfen (Störung, der Stand bleibt, @ZM-109), 0 Zeilen
 * heißt „nicht gefunden“ (der Stand wird gelöscht, @ZM-036).
 */
import type { Tournament } from '../../types/tournament';
import { SupabaseRepository } from '../../core/repositories/SupabaseRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { type PublicFetchResult, type PublicTournamentSource } from './publicSource';
import { contentVersionOf } from './publicVersion';
import { MeasuredServerClock, type ServerClock } from './serverClock';

export interface ShareCodeLookup {
  getByShareCode(code: string): Promise<Tournament | null>;
}

interface ProbeResult { error?: { message: string } | null; data?: readonly unknown[] | null }

/**
 * `getByShareCode` liefert bei jedem Fehler `null`, auch bei Netzfehler oder 5xx (Befund C-ZUSCHAUER-LADEFEHLER-ALS-NICHT-GEFUNDEN,
 * Besitz Spur A). Antwortet es mit `null`, fragt diese kleine Prüfung noch einmal nach (nur die Kennung, eine Zeile): kommt
 * dabei ein Fehler zurück, war es eine Störung und wird geworfen; „0 Zeilen“ heißt wirklich „gibt es nicht“.
 */
export async function assertShareCodeUnknown(code: string): Promise<void> {
  if (supabase === null) {
    return;
  }
  const result = (await supabase
    .from('tournaments')
    .select('id')
    .eq('share_code', code.toUpperCase().trim())
    .eq('is_public', true)
    .limit(1)) as ProbeResult | undefined;
  if (result?.error) {
    throw new Error(result.error.message);
  }
  // Findet die Prüfung das Turnier doch, war `getByShareCode` nur gestört: ebenfalls eine Störung, kein „nicht gefunden“
  if ((result?.data?.length ?? 0) > 0) {
    throw new Error('tournament exists but was not readable (disruption)');
  }
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
        if (found === null) {
          await assertShareCodeUnknown(code);
        }
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
  /** Vorgabe `null`: der heutige Weg lädt jedes Mal das ganze Turnier, ein fester Takt sprengt das Egress-Budget (BP-2). */
  pollIntervalMs?: number | null;
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
    pollIntervalMs: options.pollIntervalMs ?? null,
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
        // Die Standard-Abfrage hat bei `null` nachgefragt (`assertShareCodeUnknown`): eine Störung wirft, `null` heißt wirklich
        // „gibt es nicht“ – auch mit gehaltenem Stand (Teilen zurückgenommen, @ZM-036)
        return { kind: 'not-found' };
      }
      const version = contentVersionOf(found);
      return version === sinceVersion ? { kind: 'unchanged', version } : { kind: 'full', version, tournament: found };
    },
  };
}
