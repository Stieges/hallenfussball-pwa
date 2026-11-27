/**
 * Sortierspalten des Endstands und der Torschützenliste (@TS-002, @TS-008, @TS-019): rein, ohne React.
 * Endstand: Team immer, Sp./Diff./Pkt. nur, wenn die Zeilen gespeicherte Tabellenwerte tragen (sonst gibt es die Spalten nicht).
 * Zeilen ohne Tabellenwerte (Platzierungsspiel) stehen beim Sortieren nach Sp./Diff./Pkt. immer am Ende (@TS-002).
 * Torschützen: Tore (meiste zuerst) und Team; sortiert werden nur Spielerzeilen, die Sammelzeilen bleiben am Ende (@TS-019).
 */
import type { SortColumnDef } from '../../../hooks/useTableSort';
import type { SortedColumn } from '../../../core/standings/tableSort';
import type { FinalStandingRow, ScorerRow, TableValues } from '../../../core/standings/finalStandings';

export type PlayerRow = Extract<ScorerRow, { kind: 'player' }>;
/** Endstand-Zeile mit gespeicherten Tabellenwerten; nur diese Zeilen lassen sich nach Sp./Diff./Pkt. sortieren. */
export type ValuedRow = FinalStandingRow & { tableValues: TableValues };

export const hasValues = (row: FinalStandingRow): row is ValuedRow => row.tableValues !== undefined;

/** „Team“ gilt für alle Zeilen. */
export const finalTeamColumns: SortColumnDef<FinalStandingRow>[] = [{ column: 'team', value: (r) => r.teamName, bestFirst: 'asc' }];
/**
 * Sp., Diff., Pkt. gelten nur für Zeilen mit Tabellenwerten; Zeilen ohne Werte nimmt der Aufrufer aus der Sortierung und hängt sie
 * in der Reihenfolge des Endstands hinten an (immer am Ende, in beiden Richtungen; kein Ersatzwert).
 */
export const finalValueColumns: SortColumnDef<ValuedRow>[] = [
  { column: 'sp', value: (r) => r.tableValues.games, bestFirst: 'desc' },
  { column: 'diff', value: (r) => r.tableValues.goalDiff, bestFirst: 'desc' },
  { column: 'pkt', value: (r) => r.tableValues.points, bestFirst: 'desc' },
];

/** Spalten, die es in dieser Liste gibt (Zahlen nur, wenn die Zeilen Tabellenwerte tragen). */
export const finalSortableColumns = (withValues: boolean): readonly SortedColumn[] => (withValues ? ['team', 'sp', 'diff', 'pkt'] : ['team']);

export const scorerSortColumns: SortColumnDef<PlayerRow>[] = [
  { column: 'tore', value: (r) => r.goals, bestFirst: 'desc' },
  { column: 'team', value: (r) => r.teamName, bestFirst: 'asc' },
];
