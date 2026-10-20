/**
 * Zuordnung der Teams zu Tabellen – an EINER Stelle (C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN).
 *
 * Ein Turnier ohne Gruppen („Jeder gegen jeden“; der Assistent entfernt die Gruppe der Teams) ist EINE Gruppe mit allen
 * Teams (Record Turniermodi: Jeder gegen jeden = „eine Gruppe“). Genutzt von `GroupTables` (Turnierverwaltung,
 * Zuschauer-Seite) und der Tabellenrechnung `calculateStandingsPerGroup`. Monitor (`standingsSections`: „Gesamttabelle“)
 * und PDF (@DR-009) nutzen diese Funktion NICHT, sie haben eigene Regeln für Turniere ohne Gruppen.
 * Es geht nur um die Zuordnung; die Reihenfolge innerhalb einer Tabelle bleibt Sache der Tabellenrechnung.
 */

/** Kennung der einen Gruppe eines Turniers ohne Gruppen (kein Buchstabe, nie als „Gruppe …“ anzeigen). */
export const OVERALL_GROUP = '';

export interface StandingsGroup<T> {
  group: string;
  teams: T[];
}

/** Tabellen-Gruppen aus den Teams: je Gruppenbuchstabe eine (sortiert), ohne Gruppen eine mit allen Teams, ohne Teams keine. */
export function standingsGroups<T extends { group?: string }>(teams: readonly T[]): Array<StandingsGroup<T>> {
  const letters = [...new Set(teams.map((team) => team.group).filter((group): group is string => group !== undefined && group !== ''))].sort();
  if (letters.length === 0) {
    return teams.length > 0 ? [{ group: OVERALL_GROUP, teams: [...teams] }] : [];
  }
  return letters.map((group) => ({ group, teams: teams.filter((team) => team.group === group) }));
}
