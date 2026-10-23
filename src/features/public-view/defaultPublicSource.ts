/**
 * Die Quelle der Zuschauer-Seite (B-15).
 *
 * Mit Supabase (Produktion, Cloud-Projekte): die Server-Funktion `public_tournament` (Adapter (b)). Seit dem Einspielen
 * von B-14 (`20261117_104`, live 23.10.) liest anon die Tabellen nicht mehr (@ZM-021, @ZM-068, @ZM-109).
 *
 * Ohne Supabase (Offline-Betrieb, Playwright-Offline-Projekte mit Saat im lokalen Speicher): der lokale Weg über
 * `getByShareCode` (Adapter (a)). Die Server-Funktion wird dann nie aufgerufen – sie könnte nur mit einer Störung
 * antworten, und die Seite zeigte „Fehler beim Laden“ statt des lokal vorhandenen Turniers.
 */
import { isSupabaseConfigured } from '../../lib/supabase';
import { createLegacyPublicSource, type ShareCodeLookup } from './legacyPublicSource';
import { createRpcPublicSource, type PublicRpcCall } from './rpcPublicSource';
import type { PublicTournamentSource } from './publicSource';

export interface PublicSourceChoice {
  /** Ist Supabase konfiguriert? */
  supabaseConfigured: boolean;
  /** Aufruf der Server-Funktion (nur für Tests) */
  rpcCall?: PublicRpcCall;
  /** Lokale Abfrage per Code (nur für Tests) */
  localLookup?: ShareCodeLookup;
}

export function choosePublicTournamentSource(choice: PublicSourceChoice): PublicTournamentSource {
  if (choice.supabaseConfigured) {
    return createRpcPublicSource(choice.rpcCall ? { call: choice.rpcCall } : {});
  }
  return createLegacyPublicSource(choice.localLookup);
}

export const defaultPublicTournamentSource: PublicTournamentSource = choosePublicTournamentSource({
  supabaseConfigured: isSupabaseConfigured,
});
