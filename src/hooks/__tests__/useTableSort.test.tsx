import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTableSort, type SortColumnDef } from '../useTableSort';
import type { SortState } from '../../core/standings/tableSort';

interface Row { id: string; team: string; pkt: number; tore: number }

// Eingang = Platzierungs-Reihenfolge
const rows: readonly Row[] = [
  { id: 'a', team: 'Adler', pkt: 6, tore: 4 },
  { id: 'b', team: 'Bären', pkt: 4, tore: 5 },
  { id: 'c', team: 'Cobras', pkt: 4, tore: 3 },
  { id: 'd', team: 'Dachse', pkt: 3, tore: 2 },
  { id: 'e', team: 'Eulen', pkt: 6, tore: 1 },
];

const columns: readonly SortColumnDef<Row>[] = [
  { column: 'pkt', value: (r) => r.pkt, bestFirst: 'desc' },
  { column: 'tore', value: (r) => r.tore, bestFirst: 'desc' },
  { column: 'team', value: (r) => r.team, bestFirst: 'asc' },
];

const ids = (list: readonly Row[]) => list.map((r) => r.id).join('');
const sorted = (state: SortState, input: readonly Row[] = rows) =>
  renderHook(({ s, r }) => useTableSort(r, columns, s), { initialProps: { s: state, r: input } }).result.current;

describe('useTableSort', () => {
  it('@TS-003 meiste Punkte zuerst, umgekehrt wenigste zuerst', () => {
    expect(ids(sorted({ column: 'pkt', reversed: false }))).toBe('aebcd');
    expect(ids(sorted({ column: 'pkt', reversed: true }))).toBe('dbcae');
  });

  it('@TS-003 Team A bis Z, umgekehrt Z bis A', () => {
    expect(ids(sorted({ column: 'team', reversed: false }))).toBe('abcde');
    expect(ids(sorted({ column: 'team', reversed: true }))).toBe('edcba');
  });

  it('@TS-006 gleicher Wert bleibt in beiden Richtungen in Platzierungsreihenfolge', () => {
    // a und e (6 Punkte), b und c (4 Punkte)
    expect(ids(sorted({ column: 'pkt', reversed: false }))).toBe('aebcd');
    expect(ids(sorted({ column: 'pkt', reversed: true }))).toBe('dbcae');
  });

  it('@TS-017 gleicher Platz und gleicher Wert bleiben in Eingangsreihenfolge', () => {
    const gleich: readonly Row[] = [
      { id: 'x', team: 'Xanten', pkt: 3, tore: 1 },
      { id: 'y', team: 'Yeti', pkt: 3, tore: 1 },
      { id: 'z', team: 'Zebra', pkt: 3, tore: 1 },
    ];
    expect(ids(sorted({ column: 'pkt', reversed: false }, gleich))).toBe('xyz');
    expect(ids(sorted({ column: 'pkt', reversed: true }, gleich))).toBe('xyz');
  });

  it('@TS-018 vor dem ersten Spiel nach Tore bleibt die Teilnehmerliste', () => {
    const vorSpiel: readonly Row[] = ['m', 'k', 'l'].map((id) => ({ id, team: id, pkt: 0, tore: 0 }));
    expect(ids(sorted({ column: 'tore', reversed: false }, vorSpiel))).toBe('mkl');
    expect(ids(sorted({ column: 'tore', reversed: true }, vorSpiel))).toBe('mkl');
  });

  it('@TS-009 neue Zeilen bei gleichem Zustand werden neu sortiert', () => {
    const state: SortState = { column: 'tore', reversed: false };
    const { result, rerender } = renderHook(({ s, r }) => useTableSort(r, columns, s), {
      initialProps: { s: state, r: rows },
    });
    expect(ids(result.current)).toBe('bacde');
    const neu: readonly Row[] = rows.map((r) => (r.id === 'e' ? { ...r, tore: 9 } : r));
    rerender({ s: state, r: neu });
    expect(ids(result.current)).toBe('ebacd');
  });

  it('@TS-003 ohne Zustand oder mit unbekannter Spalte kommen die Zeilen unverändert zurück', () => {
    expect(sorted(null)).toBe(rows);
    expect(sorted({ column: 'gegentore', reversed: false })).toBe(rows);
  });
});
