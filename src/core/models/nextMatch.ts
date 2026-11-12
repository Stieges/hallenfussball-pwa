/**
 * Das „nächste Spiel“ eines Felds im Client, wie am Server (`match_kit_set`, 20261124_002_leibchen_schritt2.sql, Abschnitt d): das erste noch nicht
 * beendete und nicht ausgefallene Spiel mit zwei feststehenden Teams, sortiert nach Uhrzeit (`scheduled_start`, ohne Uhrzeit zuletzt), Runde, Slot (ohne
 * zuletzt), Spielnummer (ohne zuletzt), Kennung. Solange ein Spiel des Felds läuft, ist es das laufende; das nächste folgt erst nach dem Abpfiff.
 * Die Karte erscheint nur für dieses Spiel (@SL-215, @SL-216); für spätere Spiele gilt die Vorab-Festlegung (@SL-233, MVP+).
 */
import type { Match } from '../../types/tournament';
import { slotTeamId } from './matchSlot';

type NextCandidate = Pick<Match, 'id' | 'field' | 'round' | 'slot' | 'matchNumber' | 'scheduledTime' | 'matchStatus' | 'slotA' | 'slotB'>;

const nullsLast = (value: number | undefined): number => value ?? Number.POSITIVE_INFINITY;

function compare(a: NextCandidate, b: NextCandidate): number {
  return (
    nullsLast(a.scheduledTime?.getTime()) - nullsLast(b.scheduledTime?.getTime())
    || nullsLast(a.round) - nullsLast(b.round)
    || nullsLast(a.slot) - nullsLast(b.slot)
    || nullsLast(a.matchNumber) - nullsLast(b.matchNumber)
    || a.id.localeCompare(b.id)
  );
}

/** Das nächste (bzw. gerade laufende) Spiel des Felds; `undefined`, wenn keines mehr folgt. */
export function nextMatchOnField<T extends NextCandidate>(matches: readonly T[], field: number): T | undefined {
  const open = matches.filter((match) => (
    match.field === field
    && match.matchStatus !== 'finished'
    && match.matchStatus !== 'skipped'
    && slotTeamId(match.slotA) !== undefined
    && slotTeamId(match.slotB) !== undefined
  ));
  return [...open].sort(compare)[0];
}
