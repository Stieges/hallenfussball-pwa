/**
 * Zuordnung der Teams zu Tabellen – an EINER Stelle (C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN).
 *
 * Ein Turnier ohne Gruppen („Jeder gegen jeden“; der Assistent entfernt die Gruppe der Teams) ist EINE Gruppe mit allen
 * Teams (Record Turniermodi: Jeder gegen jeden = „eine Gruppe“). Genutzt von `GroupTables` (Turnierverwaltung,
 * Zuschauer-Seite), der Tabellenrechnung `calculateStandingsPerGroup` und dem Monitor (`groupIds` → `standingsSections`:
 * „Gesamttabelle“, C-MONITOR-ALLE-TABELLEN-OHNE-ZEILEN). Das PDF (@DR-009) nutzt diese Funktion NICHT, es hat eigene Regeln für Turniere ohne Gruppen.
 * Es geht nur um die Zuordnung; die Reihenfolge innerhalb einer Tabelle bleibt Sache der Tabellenrechnung.
 */

/** Kennung der einen Gruppe eines Turniers ohne Gruppen (kein Buchstabe, nie als „Gruppe …“ anzeigen). */
export const OVERALL_GROUP = '';

/**
 * Gruppe eines Spiels oder Teams (GA4 R-GA4v2-7, Review-Auflage 1): fehlend, leer und `'all'` → `OVERALL_GROUP`, sonst
 * der Buchstabe unverändert (Groß/Klein zählt, `'ALL'` ist ein Buchstabe). Jeder gegen jeden schreibt Spiele mit
 * `'all'`, Teams ohne Gruppe (C-GRUPPE-ALL-UNEINHEITLICH) – diese Funktion ist die EINZIGE Stelle, die `'all'` abbildet.
 * Zwilling am Server `match_engine.group_key`, Gleichlauf `core/standings/__fixtures__/group-key.json`.
 */
export function groupKeyOf(group?: string | null): string {
  return group === undefined || group === null || group === '' || group === 'all' ? OVERALL_GROUP : group;
}

/** Gehört das Spiel/Team zur einen Gruppe von „Jeder gegen jeden“ (fehlend, leer, `'all'`)? Dann gibt es nichts anzuzeigen (@ZM-177). */
export function isSingleGroupId(group?: string | null): boolean {
  return groupKeyOf(group) === OVERALL_GROUP;
}

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
