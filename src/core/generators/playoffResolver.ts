/**
 * Playoff Resolver
 *
 * Besetzt offene Seiten der Finalrunde (Slots mit Herkunft) aus den Ergebnissen:
 * - Gruppenrang (`groupRank`): sobald alle Gruppenspiele abgeschlossen sind, aus der Tabelle der Gruppe.
 * - Ergebnis eines Spiels (`matchResult`): über die ECHTE Spiel-ID (`source.matchId`), sobald das
 *   Vorgängerspiel ein Ergebnis und zwei besetzte Seiten hat.
 *
 * A-03 (MVP-Bauplan Spur A, Vorlage V-TEAM-Plan A5 d): arbeitet auf Slots, nicht auf Platzhalter-Texten.
 * Die Herkunft bleibt nach der Auflösung in `resolvedFrom` erhalten; bereits besetzte Seiten werden nie
 * angefasst. Die Herkunft des Platzes (`originA/originB`, A-36a) bleibt über das Spread unverändert.
 */

import { Match, Tournament } from '../../types/tournament';
import { calculateStandings, getMatchWinner } from '../../utils/calculations';
import sportGlossary from '../../i18n/glossary.json';
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

type GroupStandings = Record<string, { teamId: string; position: number }[]>;

/**
 * Check if all group phase matches are completed
 */
export const areAllGroupMatchesCompleted = (tournament: Tournament): boolean => {
  const groupMatches = tournament.matches.filter(
    (m) => !m.isFinal && m.group !== undefined
  );

  if (groupMatches.length === 0) {
    return false; // No group matches exist
  }

  return groupMatches.every(
    (match) => match.scoreA !== undefined && match.scoreB !== undefined
  );
};

const hasPendingSide = (match: Match): boolean =>
  isPendingSlot(match.slotA) || isPendingSlot(match.slotB);

/**
 * Check if playoff matches need resolution (have an open side)
 */
export const needsPlayoffResolution = (tournament: Tournament): boolean =>
  tournament.matches.some((match) => match.isFinal && hasPendingSide(match));

/**
 * Calculate standings for all groups
 */
const calculateAllGroupStandings = (tournament: Tournament): GroupStandings => {
  const groups = Array.from(
    new Set(tournament.teams.map((t) => t.group).filter(Boolean))
  ) as string[]; // Type assertion: filter(Boolean) ensures no undefined values

  const standings: GroupStandings = {};

  for (const group of groups) {
    const teamsInGroup = tournament.teams.filter((t) => t.group === group);
    const groupStandings = calculateStandings(
      teamsInGroup,
      tournament.matches,
      tournament,
      group
    );

    standings[group] = groupStandings.map((standing, index) => ({
      teamId: standing.team.id,
      position: index + 1, // 1-indexed
    }));
  }

  return standings;
};

/**
 * Team-ID, die zu einer Herkunft gehört – oder `null`, solange sie sich nicht bestimmen lässt.
 * Das Vorgängerspiel wird über seine Spiel-ID gefunden (nie über eine Bezeichnung wie „semi1“).
 */
const resolveSource = (
  source: SlotSource,
  groupStandings: GroupStandings,
  tournament: Tournament,
): string | null => {
  if (source.kind === 'groupRank') {
    return groupStandings[source.group]?.[source.rank - 1]?.teamId ?? null;
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

interface ResolveOptions {
  /** `groupRank` nur auflösen, wenn alle Gruppenspiele abgeschlossen sind. */
  includeGroupRank: boolean;
}

/**
 * Löst jede offene Seite der Finalrunde auf, die sich bestimmen lässt. Schreibt `tournament.matches`
 * neu (bisheriger Vertrag) und liefert die geänderten Spiel-IDs.
 */
const resolveOpenSides = (tournament: Tournament, options: ResolveOptions): string[] => {
  const groupStandings = calculateAllGroupStandings(tournament);
  const updatedMatchIds: string[] = [];

  const resolveSide = (slot: MatchSlot | undefined): MatchSlot | null => {
    if (slot === undefined || !isPendingSlot(slot)) {
      return null; // besetzte Seiten werden nie automatisch geändert
    }
    if (slot.source.kind === 'groupRank' && !options.includeGroupRank) {
      return null;
    }
    const teamId = resolveSource(slot.source, groupStandings, tournament);
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
 * Automatically resolve playoff match pairings based on group standings
 *
 * This function:
 * 1. Checks if all group matches are completed
 * 2. Calculates final standings for each group
 * 3. Gives playoff matches their teams (Slot `pending` → `team`, Herkunft bleibt in `resolvedFrom`)
 *
 * @param tournament Current tournament state
 * @returns Resolution result with updated matches
 */
export const resolvePlayoffPairings = (
  tournament: Tournament
): PlayoffResolutionResult => {
  // Check if group phase is complete
  if (!areAllGroupMatchesCompleted(tournament)) {
    return {
      wasResolved: false,
      updatedMatches: 0,
      message: `${sportGlossary.terms.groupStage.de} ist noch nicht abgeschlossen`,
      updatedMatchIds: [],
    };
  }

  // Check if playoff resolution is needed
  if (!needsPlayoffResolution(tournament)) {
    return {
      wasResolved: false,
      updatedMatches: 0,
      message: 'Playoff-Paarungen sind bereits aufgelöst',
      updatedMatchIds: [],
    };
  }

  const updatedMatchIds = resolveOpenSides(tournament, { includeGroupRank: true });
  const updatedCount = updatedMatchIds.length;

  return {
    wasResolved: updatedCount > 0,
    updatedMatches: updatedCount,
    message: updatedCount > 0
      ? `${updatedCount} Playoff-Spiele wurden erfolgreich aufgelöst`
      : 'Keine Playoff-Spiele konnten aufgelöst werden',
    updatedMatchIds,
  };
};

/**
 * Hook to automatically check and resolve playoffs after match completion
 * Call this function after saving any match result (group or playoff)
 *
 * IMPORTANT: Playoffs are resolved ONCE when all group matches are completed.
 * After that, they are NEVER automatically changed again (besetzte Seiten bleiben).
 *
 * @param tournament Current tournament state
 * @returns Resolution result if triggered, null if not needed
 */
export const autoResolvePlayoffsIfReady = (
  tournament: Tournament
): PlayoffResolutionResult | null => {
  // Only try to resolve if all group matches are done
  if (!areAllGroupMatchesCompleted(tournament)) {
    return null;
  }

  // Only resolve if there are still open sides (first-time resolution)
  if (!needsPlayoffResolution(tournament)) {
    return null;
  }

  return resolvePlayoffPairings(tournament);
};

/**
 * Resolves bracket sides after a playoff match is completed.
 * This should be called after entering a result for a knockout match.
 * It will resolve any dependent matches (e.g., after semifinal → resolve final).
 * Nur `matchResult`-Herkünfte: ein Gruppenrang wird hier nie aus einer unfertigen Tabelle besetzt.
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

  const updatedMatchIds = resolveOpenSides(tournament, { includeGroupRank: false });
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
