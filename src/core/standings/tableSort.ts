/**
 * Sortier-Modell der Tabellen (Record `2026-11-25_tabellen-sortieren`): welche Spalte, welche Richtung, welche Stufe.
 * Rein, ohne React. Eine Sortierung zur Zeit; `null` heißt „nach Platzierung“.
 */
export type TableKind = 'gruppe' | 'gesamt' | 'end' | 'tor';

export type SortColumn =
  | 'platz' | 'team' | 'sp' | 's' | 'u' | 'n' | 'tore' | 'gegentore' | 'diff' | 'pkt' | 'gruppe';

export type SortedColumn = Exclude<SortColumn, 'platz'>;

/** `null` = Platzierung. `reversed` kehrt die erste Richtung der Spalte um. */
export type SortState = { column: SortedColumn; reversed: boolean } | null;

export const SORT_COLUMNS: readonly SortedColumn[] = [
  'team', 'sp', 's', 'u', 'n', 'tore', 'gegentore', 'diff', 'pkt', 'gruppe',
];

export function isSortedColumn(value: string): value is SortedColumn {
  return (SORT_COLUMNS as readonly string[]).includes(value);
}

/** Kurzform `<spalte>[.r]` – gemeinsam für Adresse und Gerätespeicher. Platzierung (`null`) hat keine Kurzform. */
export function sortToken(state: Exclude<SortState, null>): string {
  return state.reversed ? `${state.column}.r` : state.column;
}

export function parseSortToken(token: string): SortState {
  const reversed = token.endsWith('.r');
  const column = reversed ? token.slice(0, -2) : token;
  return isSortedColumn(column) ? { column, reversed } : null;
}

/**
 * Nächster Zustand nach einem Tipp auf einen Kopf.
 * Standard: 1. Tipp erste Richtung, 2. umgekehrt, 3. zurück zur Platzierung (@TS-003).
 * Kopf „Tore“ in Gruppen-/Platzierungstabelle: fünf Stufen Tore meiste → Tore wenigste → Gegentore wenigste → Gegentore meiste → zurück (@TS-014); „Gegentore“ hat dort keinen eigenen Kopf.
 * Anderer Kopf ersetzt die Sortierung (@TS-015); Tipp auf „Platz“ = Platzierung (@TS-005).
 */
export function nextSortState(kind: TableKind, current: SortState, tapped: SortColumn): SortState {
  if (tapped === 'platz') {return null;}
  if (tapped === 'tore' && (kind === 'gruppe' || kind === 'gesamt')) {
    if (current?.column === 'tore') {return current.reversed ? { column: 'gegentore', reversed: false } : { column: 'tore', reversed: true };}
    if (current?.column === 'gegentore') {return current.reversed ? null : { column: 'gegentore', reversed: true };}
    return { column: 'tore', reversed: false };
  }
  if (current?.column !== tapped) {return { column: tapped, reversed: false };}
  return current.reversed ? null : { column: tapped, reversed: true };
}
