/**
 * @TS-020 Sortierung je Tabelle in einem Provider, @TS-011 Adresse vor Gerät, @TS-013 ausgeschaltet.
 * Der Provider ist der einzige Schreiber von `ts`; andere Parameter bleiben erhalten.
 */
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { SortState, TableKind } from '../../core/standings/tableSort';
import type { SortPreferenceStore } from '../../core/standings/tableSortPreference';
import { TableSortProvider } from '../TableSortProvider';
import { useTableSortState } from '../useTableSortState';

function memoryStore(initial: Partial<Record<TableKind, SortState>> = {}): SortPreferenceStore & { data: Partial<Record<TableKind, SortState>> } {
  const data = { ...initial };
  return {
    data,
    read: (kind) => (kind in data ? (data[kind] ?? null) : undefined),
    write: (kind, state) => { data[kind] = state; },
  };
}

function setup(url: string, store: SortPreferenceStore, disabled = false) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>
      <TableSortProvider store={store} disabled={disabled}>{children}</TableSortProvider>
    </MemoryRouter>
  );
  return wrapper;
}

function useBoth() {
  return { a: useTableSortState('gruppe', 'A'), b: useTableSortState('gruppe', 'B'), search: useLocation().search };
}

const TORE: SortState = { column: 'tore', reversed: false };

describe('useTableSortState', () => {
  it('ohne Provider: null', () => {
    const { result } = renderHook(() => useTableSortState('gruppe', 'A'));
    expect(result.current).toBeNull();
  });

  it('@TS-013 mit disabled: null', () => {
    const { result } = renderHook(() => useTableSortState('gruppe', 'A'), { wrapper: setup('/', memoryStore(), true) });
    expect(result.current).toBeNull();
  });

  it('@TS-020 Tipp in A ändert nur gA, B bleibt Platzierung, obwohl das Gerät jetzt tore hat; Reset in A lässt gB', () => {
    const store = memoryStore();
    const { result } = renderHook(useBoth, { wrapper: setup('/', store) });
    act(() => result.current.a?.tap('tore'));
    expect(result.current.a?.state).toEqual(TORE);
    expect(result.current.b?.state).toBeNull();
    expect(result.current.search).toBe('?ts=gA.tore');
    expect(store.data.gruppe).toEqual(TORE);
    act(() => result.current.b?.tap('pkt'));
    expect(new URLSearchParams(result.current.search).get('ts')).toBe('gA.tore,gB.pkt');
    act(() => result.current.a?.reset());
    expect(result.current.a?.state).toBeNull();
    expect(result.current.b?.state).toEqual({ column: 'pkt', reversed: false });
    expect(result.current.search).toBe('?ts=gB.pkt');
  });

  it('@TS-020 neuer Provider ohne ts: beide Gruppen starten mit der Gerätevorliebe, beide Einträge stehen EINMAL in der Adresse', () => {
    const store = memoryStore({ gruppe: TORE });
    const { result } = renderHook(useBoth, { wrapper: setup('/?ansicht=tabelle&g=A', store) });
    expect(result.current.a?.state).toEqual(TORE);
    expect(result.current.b?.state).toEqual(TORE);
    const params = new URLSearchParams(result.current.search);
    expect(params.get('ts')).toBe('gA.tore,gB.tore');
    expect(params.get('ansicht')).toBe('tabelle');
    expect(params.get('g')).toBe('A');
  });

  it('@TS-011 Adresse geht vor Gerät: ts in der Adresse, Gerät wird ignoriert; fehlender Eintrag = Platzierung', () => {
    const store = memoryStore({ gruppe: TORE });
    const { result } = renderHook(useBoth, { wrapper: setup('/?ts=gA.pkt.r', store) });
    expect(result.current.a?.state).toEqual({ column: 'pkt', reversed: true });
    expect(result.current.b?.state).toBeNull();
    expect(result.current.search).toBe('?ts=gA.pkt.r');
  });

  it('@TS-011 leeres ts= heißt „alles Platzierung“, kein Gerät', () => {
    const store = memoryStore({ gruppe: TORE });
    const { result } = renderHook(useBoth, { wrapper: setup('/?ts=', store) });
    expect(result.current.a?.state).toBeNull();
    expect(result.current.b?.state).toBeNull();
    expect(result.current.search).toBe('?ts=');
  });

  it('@TS-005 „Nach Platzierung“ als letzter Eintrag lässt ts= stehen und merkt Platzierung am Gerät', () => {
    const store = memoryStore();
    const { result } = renderHook(useBoth, { wrapper: setup('/?ts=gA.tore', store) });
    act(() => result.current.a?.reset());
    expect(result.current.search).toBe('?ts=');
    expect(store.data.gruppe).toBeNull();
  });

  it('@TS-011 nichts gemerkt, nichts in der Adresse: keine Schreibung, Platzierung', () => {
    const write = vi.fn();
    const store: SortPreferenceStore = { read: () => undefined, write };
    const { result } = renderHook(useBoth, { wrapper: setup('/?tab=x', store) });
    expect(result.current.a?.state).toBeNull();
    expect(result.current.search).toBe('?tab=x');
    expect(write).not.toHaveBeenCalled();
  });

  it('@TS-020 set() setzt Zustand und schreibt andere Parameter nicht um', () => {
    const { result } = renderHook(useBoth, { wrapper: setup('/?p=1&my=2', memoryStore()) });
    act(() => result.current.b?.set({ column: 'team', reversed: true }));
    const params = new URLSearchParams(result.current.search);
    expect(params.get('ts')).toBe('gB.team.r');
    expect(params.get('p')).toBe('1');
    expect(params.get('my')).toBe('2');
  });
});
