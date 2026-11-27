/**
 * Kontext der Tabellen-Sortierung (@TS-020): Der `TableSortProvider` hält die Sortierung aller Tabellen der Seite,
 * `useTableSortState` liest nur diesen Kontext. Ohne Provider ist der Wert `null`.
 */
import { createContext } from 'react';
import type { SortState, TableKind } from '../core/standings/tableSort';

export interface TableSortContextValue {
  /** Sortierung je Tabellen-Schlüssel (`tableKey`); fehlender Eintrag = Platzierung. */
  readonly map: ReadonlyMap<string, SortState>;
  /** Mit `disabled` liefert `useTableSortState` `null` (@TS-013). */
  readonly disabled: boolean;
  /** Meldet eine Tabelle an, damit beim Öffnen ohne `ts` die Gerätevorliebe ihrer Art greift. */
  register(key: string, kind: TableKind): void;
  /** Ändert den Eintrag einer Tabelle auf Basis des aktuellen Stands; schreibt Adresse und Gerät. */
  update(key: string, kind: TableKind, next: (current: SortState) => SortState): void;
}

export const TableSortContext = createContext<TableSortContextValue | null>(null);
