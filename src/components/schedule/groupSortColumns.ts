/**
 * Sortierspalten der Gruppentabelle (@TS-003, @TS-014): welcher Wert je Spalte zählt und welche Richtung zuerst kommt.
 * Rein, ohne React; die Werte sind dieselben, die die Tabelle anzeigt (Differenz = Tore minus Gegentore).
 */
import type { Standing } from '../../types/tournament';
import type { SortColumnDef } from '../../hooks/useTableSort';

export const groupSortColumns: SortColumnDef<Standing>[] = [
  { column: 'team', value: (s) => s.team.name, bestFirst: 'asc' },
  { column: 'sp', value: (s) => s.played, bestFirst: 'desc' },
  { column: 's', value: (s) => s.won, bestFirst: 'desc' },
  { column: 'u', value: (s) => s.drawn, bestFirst: 'desc' },
  { column: 'n', value: (s) => s.lost, bestFirst: 'asc' },
  { column: 'tore', value: (s) => s.goalsFor, bestFirst: 'desc' },
  { column: 'gegentore', value: (s) => s.goalsAgainst, bestFirst: 'asc' },
  { column: 'diff', value: (s) => s.goalsFor - s.goalsAgainst, bestFirst: 'desc' },
  { column: 'pkt', value: (s) => s.points, bestFirst: 'desc' },
];
