/**
 * Task 2 „Tabellen sortieren“: Stufenfolge je Tabellenart (Record `2026-11-25_tabellen-sortieren`).
 */
import { describe, expect, it } from 'vitest';
import { nextSortState, type SortColumn, type SortState, type TableKind } from '../tableSort';

const folge = (kind: TableKind, spalte: SortColumn, n: number): SortState[] => {
  const out: SortState[] = [];
  let cur: SortState = null;
  for (let i = 0; i < n; i++) {
    cur = nextSortState(kind, cur, spalte);
    out.push(cur);
  }
  return out;
};

describe('nextSortState', () => {
  it.each(['team', 'pkt', 'n', 'sp'] as const)('@TS-003 %s: Tipp 1 erste Richtung, Tipp 2 umgekehrt, Tipp 3 zurück', (spalte) => {
    expect(folge('gruppe', spalte, 3)).toEqual([{ column: spalte, reversed: false }, { column: spalte, reversed: true }, null]);
  });

  it('@TS-003 Torschützen: Tore normal, umgekehrt, zurück', () => {
    expect(folge('tor', 'tore', 3)).toEqual([{ column: 'tore', reversed: false }, { column: 'tore', reversed: true }, null]);
  });

  it('@TS-014 Gruppentabelle: fünf Stufen Tore meiste → Tore wenigste → Gegentore wenigste → Gegentore meiste → Platzierung', () => {
    const fuenf = [
      { column: 'tore', reversed: false }, { column: 'tore', reversed: true },
      { column: 'gegentore', reversed: false }, { column: 'gegentore', reversed: true }, null,
    ];
    expect(folge('gruppe', 'tore', 5)).toEqual(fuenf);
    expect(folge('gesamt', 'tore', 5)).toEqual(fuenf);
  });

  it('@TS-014 Endstand kennt keine Gegentore-Stufe', () => {
    expect(folge('end', 'tore', 3)).toEqual([{ column: 'tore', reversed: false }, { column: 'tore', reversed: true }, null]);
  });

  it('@TS-015 anderer Kopf ersetzt die Sortierung (immer nur eine)', () => {
    expect(nextSortState('gruppe', { column: 's', reversed: false }, 'pkt')).toEqual({ column: 'pkt', reversed: false });
    expect(nextSortState('gruppe', { column: 's', reversed: true }, 'pkt')).toEqual({ column: 'pkt', reversed: false });
  });

  it('@TS-005 Tipp auf Platz = nach Platzierung', () => {
    expect(nextSortState('gruppe', { column: 'pkt', reversed: false }, 'platz')).toBeNull();
    expect(nextSortState('gruppe', null, 'platz')).toBeNull();
  });
});
