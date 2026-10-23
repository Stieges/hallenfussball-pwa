/**
 * Playoff Resolver
 *
 * Besetzt offene Seiten der Finalrunde (Slots mit Herkunft) aus dem Ergebnis eines Spiels (`matchResult`): über die ECHTE
 * Spiel-ID (`source.matchId`), sobald das Vorgängerspiel ein Ergebnis und zwei besetzte Seiten hat.
 *
 * GA4 A-13c: Gruppenplätze (`groupRank`) besetzt dieser Resolver NIE mehr – das tut allein „Gruppe abschließen“ (Server
 * `complete_group`, lokal `placeFollowUps`; @TM-016, @TM-044, @TM-049). Der frühere Weg „letztes Gruppenspiel beendet →
 * automatisch aus der Tabelle besetzen“ samt Zwischenschutz bei Gleichstand (TB-5) ist entfernt.
 *
 * A-03 (MVP-Bauplan Spur A, Vorlage V-TEAM-Plan A5 d): arbeitet auf Slots, nicht auf Platzhalter-Texten.
 * Die Herkunft bleibt nach der Auflösung in `resolvedFrom` erhalten; bereits besetzte Seiten werden nie
 * angefasst. Die Herkunft des Platzes (`originA/originB`, A-36a) bleibt über das Spread unverändert.
 */

import { Match, Tournament } from '../../types/tournament';
import { getMatchWinner } from '../../utils/calculations';
import { isPendingSlot, resolveSlot } from '../models/matchSlot';
import type { MatchSlot, SlotSource } from '../models/schemas/MatchSlotSchema';

/**
 * Result of playoff resolution attempt
 */
export interface PlayoffResolutionResult {
  wasResolved: boolean;
  updatedMatches: number;
  message: string;
  updatedMatchIds: string[];
}

const hasPendingSide = (match: Match): boolean =>
  isPendingSlot(match.slotA) || isPendingSlot(match.slotB);

/**
 * Check if playoff matches need resolution (have an open side)
 */
export const needsPlayoffResolution = (tournament: Tournament): boolean =>
  tournament.matches.some((match) => match.isFinal && hasPendingSide(match));

/**
 * Team-ID, die zu einer Herkunft gehört – oder `null`, solange sie sich nicht bestimmen lässt.
 * Das Vorgängerspiel wird über seine Spiel-ID gefunden (nie über eine Bezeichnung wie „semi1“).
 */
const resolveSource = (source: SlotSource, tournament: Tournament): string | null => {
  if (source.kind === 'groupRank') {
    return null; // Gruppenplätze besetzt nur „Gruppe abschließen“ (GA4 A-13c)
  }

  const previous = tournament.matches.find((m) => m.id === source.matchId);
  if (previous === undefined) {
    return null; // unknown match
  }
  // Eine Siegerregel für alles: Spielzeit, Verlängerung, Golden Goal, Strafstoßschießen; offene Seite oder
  // Unentschieden ohne Entscheidung → noch kein Ergebnis.
  const result = getMatchWinner(previous);
  if (result === null) {
    return null;
  }
  return source.role === 'winner' ? result.winner : result.loser;
};

const resolveOpenSides = (tournament: Tournament): string[] => {
  const updatedMatchIds: string[] = [];

  const resolveSide = (slot: MatchSlot | undefined): MatchSlot | null => {
    if (slot === undefined || !isPendingSlot(slot)) {
      return null; // besetzte Seiten werden nie automatisch geändert
    }
    const teamId = resolveSource(slot.source, tournament);
    return teamId === null ? null : resolveSlot(slot.source, teamId);
  };

  tournament.matches = tournament.matches.map((match) => {
    if (!match.isFinal) {
      return match; // Skip group matches
    }
    const newSlotA = resolveSide(match.slotA);
    const newSlotB = resolveSide(match.slotB);
    if (newSlotA === null && newSlotB === null) {
      return match;
    }
    updatedMatchIds.push(match.id);
    const slotA = newSlotA ?? match.slotA;
    const slotB = newSlotB ?? match.slotB;
    return {
      ...match,
      slotA,
      slotB,
    };
  });

  return updatedMatchIds;
};

/**
 * Resolves bracket sides after a playoff match is completed.
 * This should be called after entering a result for a knockout match.
 * It will resolve any dependent matches (e.g., after semifinal → resolve final).
 * Nur `matchResult`-Herkünfte: ein Gruppenrang wird hier nie besetzt (A-13c).
 *
 * @param tournament Current tournament state
 * @returns Resolution result
 */
export const resolveBracketAfterPlayoffMatch = (
  tournament: Tournament
): PlayoffResolutionResult | null => {
  // Check if any playoff matches have open sides
  if (!needsPlayoffResolution(tournament)) {
    return null;
  }

  const updatedMatchIds = resolveOpenSides(tournament);
  const updatedCount = updatedMatchIds.length;

  return {
    wasResolved: updatedCount > 0,
    updatedMatches: updatedCount,
    message: updatedCount > 0
      ? `${updatedCount} Bracket-Spiele wurden aufgelöst`
      : 'Keine Bracket-Spiele konnten aufgelöst werden',
    updatedMatchIds,
  };
};
