/**
 * Import der Finalrunde (A-12b, @TM-013, @TM-002): Herkunft der Plätze aus der Datei lesen und den Plan prüfen.
 *
 * Dateiformat je Seite eines Spiels: entweder ein Team (`teamA`/`teamB` = Team-ID der Datei, A-03) oder eine Herkunft
 * (`sourceA`/`sourceB`):
 *   { "kind": "groupRank", "group": "A", "rank": 1 }              Erster Gruppe A
 *   { "kind": "matchResult", "match": "hf1", "role": "winner" }   Sieger des Spiels mit der Datei-ID „hf1“
 * Beides zugleich ist mehrdeutig und wird abgelehnt. Fehler werden laut gemeldet, nie still übernommen.
 */
import type { ImportValidationError, Match, Team } from '../types/tournament';
import { SlotSourceSchema, type SlotSource } from '../core/models/schemas/MatchSlotSchema';
import { slotSource } from '../core/models/matchSlot';
import { formatFinalsPlanError, validateFinalsPlan } from '../core/generators/validateFinalsPlan';

/** Feldnamen der Herkunft je Seite im Dateiformat. */
export const FILE_SOURCE_KEY = { A: 'sourceA', B: 'sourceB' } as const;

export type FileSide = keyof typeof FILE_SOURCE_KEY;

const FINALS_PHASES = ['roundOf16', 'quarterfinal', 'semifinal', 'final'] as const;

/** Phase aus der Datei, nur wenn sie ein bekannter Wert ist. */
export function parseFinalsPhase(raw: unknown): Match['phase'] {
  return FINALS_PHASES.find((phase) => phase === raw);
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Herkunft einer Seite aus der Datei. `matchIds` bildet die Spiel-IDs der Datei auf die neuen IDs ab.
 * Gibt die Herkunft zurück oder legt einen Fehler in `errors` ab und gibt `undefined` zurück.
 */
export function parseFileSource(
  raw: unknown,
  matchIds: ReadonlyMap<string, string>,
  at: { index: number; side: FileSide },
  errors: ImportValidationError[],
): SlotSource | undefined {
  const field = `matches[${at.index}].${FILE_SOURCE_KEY[at.side]}`;
  const spiel = `Spiel ${at.index + 1}`;
  const invalid = (): undefined => {
    errors.push({
      code: 'INVALID_SOURCE', field,
      message: `Herkunft der Seite ${at.side} in ${spiel} ist ungültig (erlaubt: groupRank mit group und rank, matchResult mit match und role)`,
    });
    return undefined;
  };
  if (!isRecord(raw)) { return invalid(); }
  if (raw.kind === 'matchResult') {
    const target = typeof raw.match === 'string' ? matchIds.get(raw.match) : undefined;
    if (target === undefined) {
      errors.push({
        code: 'UNKNOWN_MATCH', field,
        message: `Spiel „${String(raw.match)}“ als Herkunft der Seite ${at.side} in ${spiel} nicht gefunden`,
      });
      return undefined;
    }
    const parsed = SlotSourceSchema.safeParse({ kind: 'matchResult', matchId: target, role: raw.role });
    return parsed.success ? parsed.data : invalid();
  }
  const parsed = SlotSourceSchema.safeParse(raw.kind === 'groupRank' ? { kind: 'groupRank', group: raw.group, rank: raw.rank } : raw);
  return parsed.success && parsed.data.kind === 'groupRank' ? parsed.data : invalid();
}

/**
 * Prüft die Finalrunde der Datei (@TM-013, @TM-002). Die Gruppen und ihre Teamzahlen kommen aus der Teamliste.
 * Liefert je Fehler Code, Stelle (`matches[i]` bzw. `matches[i].sourceA|B`) und die Meldung mit Stelle und Grund.
 */
export function checkImportedFinalsPlan(matches: readonly Match[], teams: readonly Team[]): ImportValidationError[] {
  const finals = matches.filter((match) => match.isFinal === true && (slotSource(match.slotA) ?? slotSource(match.slotB)) !== undefined);
  if (finals.length === 0) { return []; }
  const teamCounts = new Map<string, number>();
  for (const team of teams) {
    if (team.group !== undefined) { teamCounts.set(team.group, (teamCounts.get(team.group) ?? 0) + 1); }
  }
  const result = validateFinalsPlan(finals, [...teamCounts].map(([id, teamCount]) => ({ id, teamCount })));
  if (result.ok) { return []; }
  return result.errors.map((error) => {
    const index = matches.findIndex((match) => match.id === error.matchId);
    return {
      code: error.code,
      field: error.side === undefined ? `matches[${index}]` : `matches[${index}].${FILE_SOURCE_KEY[error.side]}`,
      message: formatFinalsPlanError(error),
    };
  });
}
