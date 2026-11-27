/**
 * Seiten-Zustand der Tabellen-Sortierung (@TS-010, @TS-011, @TS-020): hält die Sortierung ALLER Tabellen der Seite in
 * einer Map und ist der einzige Schreiber des Parameters `ts` (alle anderen Parameter bleiben unberührt).
 *
 * Vorrang: Fehlt `ts` beim Öffnen ganz, greifen die Gerätevorlieben (je Tabellenart, für alle Gruppen); sie werden
 * gebündelt in EINEM `setSearchParams` in die Adresse geschrieben, sobald sich die Tabellen angemeldet haben.
 * Steht `ts` in der Adresse (auch leer als `ts=`), gilt nur die Adresse; ein fehlender Eintrag heißt Platzierung.
 * Die Gerätevorliebe wirkt auch für später angemeldete Tabellen weiter (z. B. Zuschauer-Seite, die auf dem Spielplan
 * startet), solange `ts` beim Öffnen fehlte und noch niemand bedient hat. Sobald `ts` von außen kommt (Link, Hashwechsel,
 * Zurück-Taste) oder bedient wurde, gilt sie nicht mehr. Eine Änderung von `ts` von außen wird übernommen.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useInRouterContext, useSearchParams } from 'react-router-dom';
import type { SortState, TableKind } from '../core/standings/tableSort';
import { SORT_PARAM, decodeSortParam, encodeSortParam } from '../core/standings/tableSortAddress';
import { deviceSortPreferences, type SortPreferenceStore } from '../core/standings/tableSortPreference';
import { TableSortContext, type TableSortContextValue } from './tableSortContext';

export interface TableSortProviderProps {
  children: ReactNode;
  store?: SortPreferenceStore;
  /** Spielplan u. Ä.: keine Sortierung, `useTableSortState` liefert `null` (@TS-013). */
  disabled?: boolean;
}

/** Ohne Router (Tests, Einzelkomponenten) gibt es keine Adresse: Kinder bleiben ohne Kontext, `useTableSortState` liefert `null`. */
export function TableSortProvider(props: TableSortProviderProps) {
  const inRouter = useInRouterContext();
  return inRouter ? <TableSortProviderInRouter {...props} /> : <>{props.children}</>;
}

function TableSortProviderInRouter({ children, store = deviceSortPreferences, disabled = false }: TableSortProviderProps) {
  const [params, setParams] = useSearchParams();
  const [initial] = useState(() => decodeSortParam(params.get(SORT_PARAM)));
  const [map, setMap] = useState<ReadonlyMap<string, SortState>>(() => initial ?? new Map());
  const [tables, setTables] = useState<ReadonlyMap<string, TableKind>>(new Map());
  const mapRef = useRef(map);
  const applied = useRef(new Set<string>());
  // Gerätevorliebe nur, solange die Adresse beim Öffnen nichts sagte und noch nichts bedient wurde.
  const deviceMayApply = useRef(initial === null);

  const commit = useCallback((next: Map<string, SortState>) => {
    mapRef.current = next;
    setMap(next);
    setParams((prev) => {
      const copy = new URLSearchParams(prev);
      copy.set(SORT_PARAM, encodeSortParam(next));
      return copy;
    }, { replace: true });
  }, [setParams]);

  // Änderung von `ts` von außen übernehmen. Keine Schleife: `commit` schreibt genau `encode(map)`.
  const rawTs = params.get(SORT_PARAM);
  useEffect(() => {
    const external = decodeSortParam(rawTs);
    if (external === null || rawTs === encodeSortParam(mapRef.current)) {return;}
    deviceMayApply.current = false;
    mapRef.current = external;
    setMap(external);
  }, [rawTs]);

  const register = useCallback((key: string, kind: TableKind) => {
    setTables((prev) => (prev.has(key) ? prev : new Map(prev).set(key, kind)));
  }, []);

  const update = useCallback((key: string, kind: TableKind, next: (current: SortState) => SortState) => {
    deviceMayApply.current = false;
    const state = next(mapRef.current.get(key) ?? null);
    const copy = new Map(mapRef.current);
    if (state) {copy.set(key, state);} else {copy.delete(key);}
    store.write(kind, state);
    commit(copy);
  }, [commit, store]);

  useEffect(() => {
    if (!deviceMayApply.current) {return;}
    const additions: [string, SortState][] = [];
    for (const [key, kind] of tables) {
      if (applied.current.has(key)) {continue;}
      applied.current.add(key);
      const preferred = store.read(kind);
      if (preferred) {additions.push([key, preferred]);}
    }
    if (additions.length === 0) {return;}
    commit(new Map([...mapRef.current, ...additions]));
  }, [tables, store, commit]);

  const value = useMemo<TableSortContextValue>(
    () => ({ map, disabled, register, update }),
    [map, disabled, register, update],
  );
  return <TableSortContext.Provider value={value}>{children}</TableSortContext.Provider>;
}
