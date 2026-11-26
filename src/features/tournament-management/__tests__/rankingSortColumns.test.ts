/** Task 6: Spalten der Platzierungstabelle (@TS-002, @TS-014). */
import { describe, expect, it } from 'vitest';
import { rankingSortColumns } from '../ranking/rankingSortColumns';

describe('rankingSortColumns', () => {
  it('@TS-002 „Gruppe“ gibt es nur bei einem Turnier mit Gruppen', () => {
    expect(rankingSortColumns(true).map((c) => c.column)).toContain('gruppe');
    expect(rankingSortColumns(false).map((c) => c.column)).not.toContain('gruppe');
  });

  it('@TS-002 keine Sortierung nach „Entschieden durch“ / Herkunft: nur die Spalten der Gruppentabelle plus „Gruppe“', () => {
    expect(rankingSortColumns(true).map((c) => c.column)).toEqual(['team', 'sp', 's', 'u', 'n', 'tore', 'gegentore', 'diff', 'pkt', 'gruppe']);
  });

  it('@TS-014 Erste Richtung: Namen und Gruppe A–Z, Niederlagen und Gegentore wenigste, übrige beste zuerst; Liste ist stabil', () => {
    const richtung = Object.fromEntries(rankingSortColumns(true).map((c) => [c.column, c.bestFirst]));
    expect(richtung).toEqual({ team: 'asc', gruppe: 'asc', n: 'asc', gegentore: 'asc', sp: 'desc', s: 'desc', u: 'desc', tore: 'desc', diff: 'desc', pkt: 'desc' });
    expect(rankingSortColumns(true)).toBe(rankingSortColumns(true));
  });
});
