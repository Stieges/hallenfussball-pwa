/**
 * Sortier-Baustein der Tabellen (Record `2026-11-25_tabellen-sortieren`). Einzige Stelle, die TanStack Table
 * importiert (ESLint-Sperre). Die Zeilen kommen in Platzierungs-Reihenfolge; sortiert wird stabil danach:
 * gleicher Wert bleibt in Eingangsreihenfolge, in beiden Richtungen (@TS-006, @TS-017).
 */
import { useMemo } from 'react';
import {
  createSortedRowModel,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnDef,
  type RowData,
  type SortingState,
} from '@tanstack/react-table';
import { compareNames } from '../core/standings/nameOrder';
import type { SortState, SortedColumn } from '../core/standings/tableSort';

export interface SortColumnDef<Row> {
  column: SortedColumn;
  value: (row: Row) => number | string;
  /** Erste Richtung: `desc` = größter Wert zuerst, `asc` = kleinster / A–Z zuerst. */
  bestFirst: 'desc' | 'asc';
}

const features = tableFeatures({ rowSortingFeature, sortedRowModel: createSortedRowModel() });

function compareValues(a: number | string, b: number | string): number {
  if (typeof a === 'string' || typeof b === 'string') {return compareNames(String(a), String(b));}
  return a - b;
}

/**
 * `null` oder eine Spalte ohne Definition → `rows` unverändert (so wirken Adress-Einträge wie `tor.gegentore`
 * in Tabellen ohne diese Spalte nicht). Die Spaltenliste sollte der Aufrufer stabil halten (useMemo/Konstante).
 */
export function useTableSort<Row extends RowData>(
  rows: readonly Row[],
  columns: readonly SortColumnDef<Row>[],
  state: SortState,
): readonly Row[] {
  const def = state ? columns.find((c) => c.column === state.column) : undefined;

  const columnDefs = useMemo<ColumnDef<typeof features, Row>[]>(
    () =>
      columns.map((c) => ({
        id: c.column,
        accessorFn: (row: Row) => c.value(row),
        // Aufsteigend, Gleichstand 0: die Bibliothek fällt dann auf die Eingangsreihenfolge zurück
        // und dreht bei `desc` nur das Ergebnis des Vergleichs um (nicht die Gleichstände).
        sortFn: (a, b) => compareValues(c.value(a.original), c.value(b.original)),
      })),
    [columns],
  );

  const sorting = useMemo<SortingState>(() => {
    if (!state || !def) {return [];}
    const desc = (def.bestFirst === 'desc') !== state.reversed;
    return [{ id: state.column, desc }];
  }, [state, def]);

  const table = useTable({
    features,
    columns: columnDefs,
    data: rows,
    state: { sorting },
    enableMultiSort: false,
  });

  const sortedRows = table.getRowModel().rows;
  const result = useMemo(() => sortedRows.map((r) => r.original), [sortedRows]);
  return def ? result : rows;
}
