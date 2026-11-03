/**
 * T7b – Seitenumbruch an der Stunde (@DR-033), Verteilung der Abschnitte (@DR-002), Linien der Finalrunde, Tabellen und
 * Platzierung im Seitenmodell (@DR-005, @DR-009, @DR-034, @DR-036, @DR-037). Fake-Messfunktion (2,0 / 2,2 mm je Zeichen).
 */
import { describe, expect, it } from 'vitest';
import { printWriteLine } from '../../../../design-tokens/print-sheet';
import { FALL_A, FALL_B, fallBLang, mitRegelnDR019 } from '../../__tests__/fixtures/handzettelFaelle';
import { splitRows } from '../pagePlan';
import { modelOf } from './modelSupport';
import type { Block, FinalsBlock, RankingBlock, StandingsTableBlock } from '../types';

const blocks = (fall: Parameters<typeof modelOf>[0], opts: Parameters<typeof modelOf>[1] = {}): Block[] => modelOf(fall, opts).model.pages.flatMap(p => p.blocks);
const finalsOf = (bs: Block[]): FinalsBlock => bs.find((b): b is FinalsBlock => b.kind === 'finals')!;

describe('@DR-033 Umbruch an der Stunde (splitRows)', () => {
  const heights = Array.from({ length: 20 }, () => 10);
  const starts = heights.map((_, i) => i > 0 && i % 5 === 0);

  it('bricht vor der ersten Zeile der Stunde, wenn die Seite dabei voll bleibt und danach mindestens 3 Zeilen folgen', () => {
    const pages = splitRows(heights, [170, 200], 3, { starts, maxFree: 25 });

    expect(pages.map(p => p.length)).toEqual([15, 5]);
  });

  it('Gegenbeispiel: bliebe zu viel Platz auf Seite 1 frei, bricht sie dort, wo der Platz endet', () => {
    const pages = splitRows(heights, [190, 200], 3, { starts, maxFree: 5 });

    expect(pages.map(p => p.length)).toEqual([17, 3]);
  });

  it('Gegenbeispiel: stünden auf der Folgeseite weniger als 3 Zeilen, bricht sie nicht an der Stunde', () => {
    const kurz = heights.slice(0, 16);
    const pages = splitRows(kurz, [150, 200], 3, { starts: kurz.map((_, i) => i === 15), maxFree: 25 });

    expect(pages[1].length).toBeGreaterThanOrEqual(3);
    expect(pages[0].length).not.toBe(15);
  });

  it('ohne Stundenangabe gilt das bisherige Verhalten', () => {
    expect(splitRows(heights, [170, 200], 3).map(p => p.length)).toEqual([17, 3]);
  });
});

describe('@DR-002 Verteilung der Abschnitte', () => {
  it('Jeder gegen jeden (a): Seite 1 Spiele, Seite 2 Tabelle, Strafstoß-Zeile und Platzierung', () => {
    const { model } = modelOf(FALL_A);

    expect(model.pages.map(p => p.section)).toEqual(['matches', 'tables']);
    expect(model.pages[1].blocks.map(b => b.kind)).toEqual(['standingsTable', 'shootout', 'ranking']);
  });

  it('Gruppen mit Finalrunde (b): die Platzierung mit einer Linie je Team passt nicht mehr neben die Finalrunde, beide beginnen auf einer neuen Seite', () => {
    const { model } = modelOf(FALL_B);

    expect(model.pages.map(p => p.section)).toEqual(['matches', 'tables', 'finals']);
    expect(model.pages[2].blocks.map(b => b.kind)).toEqual(['text', 'finals', 'ranking']);
  });

  it('Gegenbeispiel: ohne Regel entfällt die Strafstoß-Zeile, ohne Tabellen entfällt der Abschnitt', () => {
    expect(blocks(FALL_A, { tournament: { placementsToPlayOut: [] } }).some(b => b.kind === 'shootout')).toBe(false);
    expect(modelOf(FALL_B, { options: { includeStandings: false } }).model.pages.map(p => p.section)).toEqual(['matches', 'finals']);
  });
});

describe('@DR-005 @DR-009 Platzierung', () => {
  it('eine Linie je Team, bei 10 Teams zehn', () => {
    const ranking = blocks(FALL_B).find((b): b is RankingBlock => b.kind === 'ranking')!;

    expect(ranking.lines).toHaveLength(10);
  });
});

describe('@DR-035 @DR-037 @DR-034 Tabellen und Finalrunde im Modell', () => {
  it('Fassung ohne Ergebnisse: Raster in jeder Tabelle, keine Zebra-Flächen', () => {
    const tables = blocks(FALL_B, { options: { edition: 'blank' } }).filter((b): b is StandingsTableBlock => b.kind === 'standingsTable');

    expect(tables).toHaveLength(2);
    for (const t of tables) {
      expect(t.grid.length).toBeGreaterThan(0);
      expect(t.fills.every(f => f.kind === 'tableHead')).toBe(true);
    }
  });

  it('jeder offene Platz hat eine Namenslinie von mindestens 50 mm und darunter die Herkunft; über der Linie bleiben 5 mm bis zur Oberkante der Zeile', () => {
    const rows = finalsOf(blocks(FALL_B)).rounds.flatMap(r => r.rows);

    expect(rows).toHaveLength(8);
    for (const row of rows) {
      const names = row.lines.filter(l => l.kind === 'name');
      expect(names).toHaveLength(2);
      for (const l of names) { expect(l.x2 - l.x1).toBeGreaterThanOrEqual(printWriteLine.nameMin); }
      for (const l of row.lines) { expect(l.y - row.box.y).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace); }
      for (const side of [row.home, row.away]) { expect(side.runs[0].y).toBeGreaterThan(names[0].y); }
    }
  });

  it('ohne feststehende Teams steht in der Finalrunde auch mit Ergebnissen die Herkunft (feststehende Teams: ausfuellen.test)', () => {
    const rows = finalsOf(blocks(FALL_B, { options: { includeScores: true } })).rounds.flatMap(r => r.rows);

    expect(rows.every(r => r.home.origin !== undefined)).toBe(true);
  });

  it('Regel der Runde: Strafstoßschießen = ein Paar, Verlängerung/Golden Goal + Strafstoßschießen = zwei Paare untereinander', () => {
    const rows = finalsOf(blocks(mitRegelnDR019())).rounds.flatMap(r => r.rows);
    const klein = (n: number): number[] => (rows.find(r => r.number === n)?.lines.filter(l => l.kind === 'small') ?? []).map(l => l.y);

    expect(klein(25)).toHaveLength(2);
    expect(new Set(klein(27)).size).toBe(2);
    expect(new Set(klein(28)).size).toBe(2);
  });

  it('kein Block reicht unter den Satzspiegel (Fälle a, b, b-lang)', () => {
    for (const fall of [FALL_A, FALL_B, fallBLang(1), fallBLang(2)]) {
      const { model, geo } = modelOf(fall);
      for (const b of model.pages.flatMap(p => p.blocks)) { expect(b.top + b.height).toBeLessThanOrEqual(geo.bottom + 0.01); }
    }
  });
});
