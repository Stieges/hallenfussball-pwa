/**
 * Gruppenplätze für den Endstand (Paket TB, Plan v2 § 3.3, TB-4): der Gruppenplatz kommt aus der Tabellenrechnung je Gruppe
 * (`rankGroup` mit Entscheidungen), nicht aus der Position in einer gruppenübergreifenden Liste. Teilen Teams ihren
 * Gruppenplatz, weil die Turnierleitung „gleichen Platz lassen“ gewählt hat (Daniel F4 Variante C, @ET-020, @ET-021,
 * @ET-029, @W2A-063), liefert `sharedWith` ihre Gruppe; ein offener Gleichstand ohne diese Entscheidung teilt nie still.
 * Rein, ohne React.
 */
import type { Match, Standing, Team } from '../../types/tournament';
import { OVERALL_GROUP, standingsGroups } from '../models/standingsGroups';
import { rankGroup } from './groupTable';
import { tableInput, type TableTournament } from './tournamentTable';

export interface GroupPlaceInfo {
  /** Gruppenplatz; 0 bei Teams ohne Gruppe (Jeder gegen jeden, dort gilt die Reihenfolge der Gesamtwertung). */
  place: number;
  /** Team-IDs, die sich diesen Platz nach „gleichen Platz lassen“ teilen (einschließlich des Teams selbst). */
  sharedWith?: readonly string[];
}

/** Gruppenplatz und geteilter Platz je Team-ID, gerechnet je Gruppe. */
export function groupPlaceInfo(teams: readonly Team[], matches: readonly Match[], tournament: TableTournament): Map<string, GroupPlaceInfo> {
  const info = new Map<string, GroupPlaceInfo>();
  for (const { group } of standingsGroups(teams)) {
    const hasGroup = group !== OVERALL_GROUP;
    for (const row of rankGroup(tableInput(teams, matches, tournament, hasGroup ? group : undefined)).rows) {
      const sharedWith = row.decision?.kind === 'shared' ? row.tieBlock : undefined;
      info.set(row.team.id, { place: hasGroup ? row.place : 0, ...(sharedWith !== undefined ? { sharedWith } : {}) });
    }
  }
  return info;
}

/**
 * `standings` (Gesamtwertung) nach Gruppenplatz geordnet: alle Ersten vor allen Zweiten usw., bei gleichem Platz in der
 * Reihenfolge der Gesamtwertung (stabile Sortierung). Teams ohne Gruppe (Platz 0) behalten ihre Reihenfolge.
 */
export function orderByGroupPlace(standings: readonly Standing[], info: ReadonlyMap<string, GroupPlaceInfo>): Standing[] {
  return standings
    .map((standing, i) => ({ standing, i, place: info.get(standing.team.id)?.place ?? 0 }))
    .sort((a, b) => a.place - b.place || a.i - b.i)
    .map(({ standing }) => standing);
}
