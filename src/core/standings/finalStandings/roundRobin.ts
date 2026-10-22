/**
 * Endstand „Jeder gegen jeden“ (A-19a, Plan `plan-endstand-abschluss.md` § 3; Record Endstand „Jeder gegen jeden: Der
 * Endstand ist die abgeschlossene Tabelle“). Eine Gruppe ohne Finalrunde:
 * - fest (`complete`) nur, wenn die Gruppe abgeschlossen ist (geltender Abschluss, nicht nach einer Korrektur geändert,
 *   keine offenen Plätze), alle Spiele entschieden sind und kein Gleichstand offen ist; die Reihenfolge kommt dann aus dem
 *   Gruppenabschluss (`groupCompletions`, Spiegel von `group_completions`), nicht aus einer Neuberechnung (@ET-022);
 * - sonst vorläufig (`provisional`): die Tabelle, wie sie gerade steht (@ET-042, @TM-058). Ein offener Gleichstand ohne
 *   Entscheidung wird nie still zu einem festen geteilten Platz;
 * - geteilt wird nur nach „Ergebnis so akzeptieren“ (`shared`), mit Sprung (@ET-020, @ET-029, @ET-057);
 * - ein entferntes Team bekommt keinen Platz, seine Spiele zählen in der Tabelle wie eingestellt (@ET-058, Daniel F5).
 * Rein, ohne React.
 */
import type { Team } from '../../../types/tournament';
import type { TeamId } from '../../models/schemas/MatchSlotSchema';
import { activeCompletion, groupState } from '../../services/GroupCompletionService';
import { rankTournamentGroup } from '../tournamentTable';
import { placeNumbers } from './sharedPlaces';
import type { ComputedFinalStandings, FinalStandingRow } from './types';
import type { FinalStandingsTournament } from './index';

/** Gleiche Teams, jedes genau einmal (Reihenfolge egal). */
const sameMembers = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && new Set(a).size === a.length && a.every((teamId) => b.includes(teamId));

/** Zeilen in der Reihenfolge `order` mit Platzziffern; Herkunft = Platz in der (einzigen) Gruppe. */
function rows(order: readonly string[], places: readonly number[], teams: ReadonlyMap<string, Team>, groupId: string): FinalStandingRow[] {
  return order.map((teamId, i) => ({
    place: places[i],
    // Team-IDs sind seit A-03 UUIDs; die Form prüft FinalStandingsSnapshotSchema vor dem Speichern.
    teamId: teamId as TeamId,
    teamName: teams.get(teamId)?.name ?? '',
    origin: { kind: 'groupPlace', group: groupId, place: places[i] },
  }));
}

/** Endstand einer Gruppe ohne Finalrunde (`groupId` '' bei Jeder gegen jeden). */
export function roundRobinStandings(tournament: FinalStandingsTournament, groupId: string): ComputedFinalStandings {
  const removed = new Set(tournament.teams.filter((team) => team.isRemoved === true).map((team) => team.id));
  const keep = (ids: readonly string[]): string[] => ids.filter((teamId) => !removed.has(teamId));
  const teams = new Map(tournament.teams.map((team) => [team.id, team]));

  const table = rankTournamentGroup(tournament, groupId);
  const tableOrder = keep(table.rows.map((row) => row.team.id));
  const shared = table.rows
    .filter((row) => row.decision?.kind === 'shared' && row.tieBlock !== undefined)
    .map((row) => keep(row.tieBlock ?? []))
    .filter((block, i, all) => block.length > 1 && all.findIndex((b) => sameMembers(b, block)) === i);
  const open = table.openTies.map(keep).filter((block) => block.length > 1);

  const provisional = (): ComputedFinalStandings => {
    const places = placeNumbers(tableOrder, [...shared, ...open]) ?? tableOrder.map((_, i) => i + 1);
    return { state: 'provisional', ranking: rows(tableOrder, places, teams, groupId) };
  };

  const completion = activeCompletion(tournament, groupId);
  if (completion === undefined || groupState(tournament, groupId) !== 'completed' || completion.openRanks.length > 0
    || !table.allGroupMatchesDecided || open.length > 0) {
    return provisional();
  }
  const order = keep(completion.ranking);
  const places = sameMembers(order, tableOrder) ? placeNumbers(order, shared) : undefined;
  if (places === undefined) {
    return provisional();
  }
  return { state: 'complete', ranking: rows(order, places, teams, groupId) };
}
