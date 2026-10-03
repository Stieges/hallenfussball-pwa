/**
 * „Turnier kopieren“ (A-04a, V-TEAM V14): neue Team- und Spiel-IDs, Spielseiten über `copySlot`.
 *
 * Ein Slot darf nie auf alte Team- oder Spiel-IDs zeigen: direkt besetzte Seiten bekommen die neue Team-ID,
 * aufgelöste Seiten werden wieder offen (die Kopie hat keine Ergebnisse), Verweise auf Vorgängerspiele
 * zeigen auf die neuen Spiel-IDs. Framework-frei.
 */
import type { Match, Team, Tournament } from '../../types/tournament';
import { copySlot, transitionalTeamRef } from './matchSlot';

export interface CopiedContent {
  teams: Team[];
  matches: Match[];
}

/**
 * Kopie von Teams und Spielen mit frischen IDs aus `makeId` (muss UUIDs liefern).
 * Ein Spiel ohne `slotA/slotB` (Altdaten) wird nicht geraten, sondern lehnt die Kopie ab.
 */
export function copyTeamsAndMatches(
  source: { teams: readonly Team[]; matches: readonly Match[] },
  makeId: () => string,
): CopiedContent {
  const teamIdMap = new Map<string, string>(source.teams.map((team) => [team.id, makeId()]));
  const matchIdMap = new Map<string, string>(source.matches.map((match) => [match.id, makeId()]));

  const teams = source.teams.map((team) => ({ ...team, id: teamIdMap.get(team.id) ?? team.id }));
  const matches = source.matches.map((match): Match => {
    if (match.slotA === undefined || match.slotB === undefined) {
      throw new Error(`Kopie: Spiel ${match.id} hat keine Spielseiten (Slots)`);
    }
    const slotA = copySlot(match.slotA, teamIdMap, matchIdMap);
    const slotB = copySlot(match.slotB, teamIdMap, matchIdMap);
    return {
      ...match,
      id: matchIdMap.get(match.id) ?? match.id,
      slotA,
      slotB,
      teamA: transitionalTeamRef(slotA),
      teamB: transitionalTeamRef(slotB),
      matchStatus: 'scheduled',
      scoreA: 0,
      scoreB: 0,
      events: [],
    };
  });
  return { teams, matches };
}

/**
 * Das kopierte Turnier für „Turnier kopieren“ (App.tsx): Entwurf mit neuer ID, neuen Team-/Spiel-IDs und
 * Spielseiten über `copySlot`. `makeId` muss UUIDs liefern.
 */
export function buildCopiedTournament(
  tournament: Tournament,
  options: { newId: string; title: string; now: string; makeId: () => string },
): Tournament {
  const { teams, matches } = copyTeamsAndMatches(tournament, options.makeId);
  return {
    ...tournament,
    id: options.newId,
    title: options.title,
    status: 'draft',
    createdAt: options.now,
    updatedAt: options.now,
    lastVisitedStep: 1, // Start at Step 1 so user can review
    teams,
    matches,
    // Reset soft-delete state
    deletedAt: undefined,
  };
}
