/**
 * Tabellenwerte eines Gruppenplatzes für den Endstand (R3-5b, @ET-001, @ET-022): Spiele, Tore, Gegentore, Tordifferenz und
 * Punkte stammen unverändert aus der Gruppentabelle (`rankTournamentGroup`), es gibt keine zweite Rechnung. Rein, ohne React.
 */
import type { Standing } from '../../../types/tournament';
import { rankTournamentGroup } from '../tournamentTable';
import type { FinalStandingsTournament } from './index';
import type { TableValues } from './types';

export function tableValuesOf(row: Standing): TableValues {
  return {
    games: row.played,
    goalsFor: row.goalsFor,
    goalsAgainst: row.goalsAgainst,
    goalDiff: row.goalDifference,
    points: row.points,
  };
}

/** Werte je Team-ID aus der Tabelle der Gruppe `groupId` ('' = Jeder gegen jeden). */
export function groupTableValues(tournament: FinalStandingsTournament, groupId: string): ReadonlyMap<string, TableValues> {
  return new Map(rankTournamentGroup(tournament, groupId).rows.map((row) => [row.team.id, tableValuesOf(row)]));
}
