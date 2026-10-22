/**
 * Endstand des Turniers (A-19a, Plan `plan-endstand-abschluss.md` § 3, Schnittstelle für A-21a-C1, B-33, B-23):
 * - `computeFinalStandings`: Endstand, wie er gerade steht – bei Jeder gegen jeden nach dem Gruppenabschluss fest
 *   (`complete`), sonst vorläufig (@ET-042, @TM-058); mit Finalrunde oder mehreren Gruppen in Schnitt N vorläufig über den
 *   heutigen Weg (Schnitt F, Daniel F12).
 * - `readFinalStandings`: Ist ein gespeicherter Endstand da (Turnier abgeschlossen), gilt nur er – nie eine Neuberechnung
 *   (R-EA-9, @ET-045); sonst der vorläufige.
 * Rein, ohne React.
 */
import type { Tournament } from '../../../types/tournament';
import type { EngineEventsById } from '../../../utils/calculations';
import { hasFinalRound } from '../../../utils/openPlacements';
import { groupIds } from '../../services/GroupCompletionService';
import type { TableTournament } from '../tournamentTable';
import { legacyStandings } from './legacy';
import { roundRobinStandings } from './roundRobin';
import type { ComputedFinalStandings, FinalStandingsSnapshot, ReadFinalStandings } from './types';

export type * from './types';
export { placeNumbers, placeNumbersValid } from './sharedPlaces';

/** Was die Rechnung vom Turnier braucht. */
export type FinalStandingsTournament =
  Pick<Tournament, 'teams' | 'matches' | 'groupCompletions' | 'finalsConfig' | 'groupSystem'> & TableTournament;

/**
 * Endstand, wie er gerade steht. `engineEventsById` (Ereignisse der Spielsteuerung, ohne Zurückgenommenes) braucht erst
 * die Wertung je Spiel der Finalrunde (A-19b); Jeder gegen jeden rechnet mit den Ständen der Spiele.
 */
export function computeFinalStandings(t: FinalStandingsTournament, _engineEventsById?: EngineEventsById): ComputedFinalStandings {
  const groups = groupIds(t);
  if (!hasFinalRound(t) && groups.length === 1) {
    return roundRobinStandings(t, groups[0]);
  }
  return legacyStandings(t);
}

/** Gespeicherter Endstand, wenn vorhanden – sonst der vorläufige (R-EA-9). */
export function readFinalStandings(t: Tournament, stored?: FinalStandingsSnapshot): ReadFinalStandings {
  if (stored !== undefined) {
    return { source: 'stored', snapshot: stored };
  }
  return { source: 'provisional', ranking: computeFinalStandings(t).ranking };
}
