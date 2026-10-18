/**
 * A-30a Schritt 2 (Ruling R-A30-1, R-A30-2): Payload-Bau des Anpfiffs für `MatchCommands.start`.
 * Die getragenen Farben fahren im Anpfiff-Ereignis mit (`MATCH_START.payload.kit`) – derselbe Ausgang wie der
 * Anpfiff, kein zweiter Schreibweg. Der Server-Trigger überträgt sie in die Spalten am Spiel.
 *
 * Prüfung NUR hier im Client vor dem Senden: ungültiges `kit` → Ablehnung INVALID_PAYLOAD `{reason: 'INVALID_KIT'}`,
 * nichts gespeichert. Die Rechenfunktion (`payloadValidation.ts`) prüft `kit` bewusst nicht – sonst wichen TS und
 * SQL-Zwilling ab (Engine-Regel, Ruling K4: unbekannte Payload-Schlüssel werden angenommen).
 */
import { ERROR_CODES, type MatchRules } from '../types';
import { parseKitInput, type MatchKit } from '../../models/kit';
import type { CommandSpec } from './matchCommandTypes';

export type { MatchKit } from '../../models/kit';

export type MatchStartCommand =
  | { ok: true; spec: CommandSpec }
  | { ok: false; code: typeof ERROR_CODES.INVALID_PAYLOAD; detail: { reason: 'INVALID_KIT' } };

/** Ohne `kit` bleibt die Payload wie bisher `{ rules }`; mit `kit` normalisiert (`#RRGGBB`) dazu. */
export function matchStartCommand(rules: MatchRules, kit?: MatchKit): MatchStartCommand {
  if (kit === undefined) {
    return { ok: true, spec: { type: 'MATCH_START', teamId: null, payload: { rules } } };
  }
  const parsed = parseKitInput(kit);
  if (parsed === null) {
    return { ok: false, code: ERROR_CODES.INVALID_PAYLOAD, detail: { reason: 'INVALID_KIT' } };
  }
  return { ok: true, spec: { type: 'MATCH_START', teamId: null, payload: { rules, kit: parsed } } };
}
