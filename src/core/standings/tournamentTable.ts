/**
 * Tabelle aus einem Turnier: welche Teams, welche Spiele, welcher Modus (Paket TB, Plan v2 § 3.1).
 * - mit Gruppe: je Gruppe (Modus `group`, direkter Vergleich als Sondertabelle, Markierung nach allen Gruppenspielen);
 * - ohne Gruppe und höchstens eine Tabellengruppe (Jeder gegen jeden): ebenso, Gruppe `OVERALL_GROUP`;
 * - ohne Gruppe bei zwei und mehr Gruppen: gruppenübergreifend (`crossGroup`) – ohne direkten Vergleich und Markierung.
 * Eine leere gespeicherte Reihenfolge gilt als Voreinstellung BFV privat (C-WERTUNG-LEER). Für Annahmen gibt die Eingabe
 * die auszuspielenden Plätze und die Herkünfte der Folgespiele mit (TB-3'). Rein, ohne React.
 */
import type { Match, Team, Tournament } from '../../types/tournament';
import { OVERALL_GROUP, standingsGroups } from '../models/standingsGroups';
import { rankGroup, type GroupTableResult, type RankGroupInput } from './groupTable';
import { effectivePlacementLogic } from './placementDefaults';
import { followUpRanks, parsePlacementsToPlayOut } from './playOutPlaces';
import { effectiveForfeitScore } from '../models/forfeit';

export type TableTournament = Pick<Tournament, 'pointSystem' | 'placementLogic' | 'standingDecisions' | 'placementsToPlayOut' | 'forfeitScore'>;

export function tableInput(teams: readonly Team[], matches: readonly Match[], tournament: TableTournament, group?: string): RankGroupInput {
  const hasGroup = group !== undefined && group !== OVERALL_GROUP;
  const groups = standingsGroups(teams);
  const single = groups.length === 1 ? groups[0].group : OVERALL_GROUP;
  const groupId = hasGroup ? group : single;
  return {
    groupId,
    teams: hasGroup ? teams.filter((t) => t.group === group) : teams,
    matches: hasGroup ? matches.filter((m) => m.group === group) : matches.filter((m) => m.isFinal !== true),
    pointSystem: tournament.pointSystem,
    forfeitScore: effectiveForfeitScore(tournament), // A-25c: Wertung bei Nichtantritt (Einstellung oder 2:0)
    placementLogic: effectivePlacementLogic(tournament.placementLogic),
    decisions: tournament.standingDecisions ?? [],
    mode: hasGroup || groups.length <= 1 ? 'group' : 'crossGroup',
    // Plätze eines Blocks liegen nie über der Teamzahl der Gruppe – die Kappung (@W2A-073) ändert hier nichts.
    placesToPlayOut: parsePlacementsToPlayOut(tournament.placementsToPlayOut),
    // Herkünfte aus ALLEN übergebenen Spielen (Finalrunde), nicht nur aus den Gruppenspielen (@W2A-069).
    followUpRanks: followUpRanks(matches, groupId),
  };
}

/** Tabelle einer Gruppe des Turniers (`OVERALL_GROUP` bei Jeder gegen jeden). */
export function rankTournamentGroup(tournament: Pick<Tournament, 'teams' | 'matches'> & TableTournament, groupId: string): GroupTableResult {
  return rankGroup(tableInput(tournament.teams, tournament.matches, tournament, groupId));
}
