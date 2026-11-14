/**
 * Das „nächste Spiel“ eines Felds im Client, wie am Server (`match_kit_set`, 20261124_002_leibchen_schritt2.sql, Abschnitt d): das erste noch nicht
 * beendete und nicht ausgefallene Spiel mit zwei feststehenden Teams, sortiert nach Uhrzeit (`scheduled_start`, ohne Uhrzeit zuletzt), Runde, Slot (ohne
 * zuletzt), Spielnummer (ohne zuletzt), Kennung. Solange ein Spiel des Felds läuft, ist es das laufende; das nächste folgt erst nach dem Abpfiff.
 * Die Karte erscheint nur für dieses Spiel (@SL-215, @SL-216); für spätere Spiele gilt die Vorab-Festlegung (@SL-233, MVP+).
 */
import type { Match } from '../../types/tournament';
import { slotTeamId } from './matchSlot';

export type NextCandidate = Pick<Match, 'id' | 'field' | 'round' | 'slot' | 'matchNumber' | 'scheduledTime' | 'matchStatus' | 'slotA' | 'slotB'>;

/** Was die Kandidaten brauchen: ein Spiel des Turniers (`Match`) oder ein Spiel des Spielplans mit denselben Feldern. */
export type NextSource = Pick<Match, 'id' | 'field' | 'matchNumber' | 'slotA' | 'slotB'> & Partial<Pick<Match, 'round' | 'slot' | 'scheduledTime' | 'matchStatus' | 'scoreA' | 'scoreB'>>;

/**
 * Der EINE Weg von einem Spiel zum Kandidaten für „nächstes Spiel“ – für Tafel, „Weiter“ und Karte der Leibchen (@SL-117, @SL-215): ausgefallen und beendet gelten
 * wie gesagt, ein Ergebnis zählt als beendet, auch wenn der Status noch „angesetzt“ sagt; ohne Status gilt „angesetzt“.
 */
export function nextCandidateOf(m: NextSource): NextCandidate {
  const hatErgebnis = m.scoreA !== undefined && m.scoreB !== undefined;
  const status = m.matchStatus === 'skipped' || m.matchStatus === 'finished' ? m.matchStatus : hatErgebnis ? 'finished' : (m.matchStatus ?? 'scheduled');
  return { id: m.id, field: m.field, round: m.round ?? Number.POSITIVE_INFINITY, slot: m.slot, matchNumber: m.matchNumber, scheduledTime: m.scheduledTime, matchStatus: status, slotA: m.slotA, slotB: m.slotB };
}

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

/** Noch zu spielen: nicht beendet und nicht ausgefallen (@SL-117). */
const istOffen = (match: NextCandidate): boolean => match.matchStatus !== 'finished' && match.matchStatus !== 'skipped';

/**
 * Die offenen Spiele in der Reihenfolge, in der sie gespielt werden: die EINE Sortierung für „Weiter“, „Nächstes:“ in der Tafel und die Karte der Leibchen
 * (@SL-117, @SL-215). Ohne Blick auf die Teams: ein Spiel mit noch offener Paarung ist das nächste Spiel, nur steht für es keine Karte (@SL-215 letzte Zeile).
 * `field` fehlt = alle Felder.
 */
export function openMatchesInPlayOrder<T extends NextCandidate>(matches: readonly T[], field?: number): T[] {
  return matches.filter((match) => (field === undefined || match.field === field) && istOffen(match)).sort(compare);
}

/** Das nächste offene Spiel des Felds, auch mit noch offener Paarung (`ausser`: das gerade gezeigte Spiel, dessen Stand noch nachzieht). */
export function nextOpenMatchOnField<T extends NextCandidate>(matches: readonly T[], field: number, ausser?: string): T | undefined {
  return openMatchesInPlayOrder(matches.filter((match) => match.id !== ausser), field)[0];
}

/** Das nächste (bzw. gerade laufende) Spiel des Felds MIT zwei feststehenden Teams – wie am Server (`match_kit_set`); `undefined`, wenn keines mehr folgt. */
export function nextMatchOnField<T extends NextCandidate>(matches: readonly T[], field: number): T | undefined {
  return openMatchesInPlayOrder(matches, field).find((match) => slotTeamId(match.slotA) !== undefined && slotTeamId(match.slotB) !== undefined);
}
