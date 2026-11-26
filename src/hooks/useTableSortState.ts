/**
 * Sortierzustand einer Tabelle (@TS-020): liest nur den Kontext des `TableSortProvider`. Ohne Provider (oder mit
 * `disabled`) `null` – der Aufrufer zeigt dann keine Sortierköpfe.
 */
import { useContext, useEffect, useMemo } from 'react';
import { nextSortState, type SortColumn, type SortState, type TableKind } from '../core/standings/tableSort';
import { tableKey } from '../core/standings/tableSortAddress';
import { TableSortContext } from './tableSortContext';

export interface TableSortHandle {
  state: SortState;
  tap(column: SortColumn): void;
  set(state: SortState): void;
  reset(): void;
}

export function useTableSortState(kind: TableKind, groupId?: string): TableSortHandle | null {
  const ctx = useContext(TableSortContext);
  const key = tableKey(kind, groupId);
  const active = ctx !== null && !ctx.disabled;
  const register = ctx?.register;
  const update = ctx?.update;
  const state = ctx?.map.get(key) ?? null;

  useEffect(() => {
    if (active) {register?.(key, kind);}
  }, [active, register, key, kind]);

  return useMemo(() => {
    if (!active || !update) {return null;}
    return {
      state,
      tap: (column: SortColumn) => update(key, kind, (current) => nextSortState(kind, current, column)),
      set: (next: SortState) => update(key, kind, () => next),
      reset: () => update(key, kind, () => null),
    };
  }, [active, update, key, kind, state]);
}
