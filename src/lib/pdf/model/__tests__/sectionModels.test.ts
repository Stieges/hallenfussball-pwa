/**
 * T7b – Seitenumbruch an der Stunde (@DR-033), Verteilung der Abschnitte (@DR-002), Linien der Finalrunde, Tabellen und
 * Platzierung im Seitenmodell (@DR-005, @DR-009, @DR-034, @DR-036, @DR-037). Fake-Messfunktion (2,0 / 2,2 mm je Zeichen).
 */
import { describe, expect, it } from 'vitest';
import { printWriteLine } from '../../../../design-tokens/print-sheet';
import { FALL_A, FALL_B, FALL_B_SR, fallBLang, mitRegelnDR019 } from '../../__tests__/fixtures/handzettelFaelle';
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

describe('@DR-037 @DR-034 kleine Linien neben oder unter dem Ergebnis', () => {
  const rowsOf = (fall: Parameters<typeof modelOf>[0]) => finalsOf(blocks(fall)).rounds.flatMap(r => r.rows);
  const klein = (row: ReturnType<typeof rowsOf>[number]) => row.lines.filter(l => l.kind === 'small');
  const ergebnis = (row: ReturnType<typeof rowsOf>[number]) => row.lines.filter(l => l.kind === 'result');

  it('ohne SR- und Feldspalte (b): kleine Linien 7 mm neben dem Ergebnis auf derselben Linie, waagerecht ≥ 4 mm Abstand zu den Linien nebenan, Namenslinie ≥ 50 mm', () => {
    for (const row of rowsOf(FALL_B)) {
      const [r1, r2] = ergebnis(row);
      const [k1, k2] = klein(row);
      const namen = row.lines.filter(l => l.kind === 'name');

      expect(k1.x2 - k1.x1).toBeCloseTo(printWriteLine.small, 5);
      expect(k1.y).toBeCloseTo(r1.y, 5);
      expect(k1.x1 - r2.x2).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - printWriteLine.tolerance);
      expect(k1.x1 - r1.x2).toBeGreaterThan(0);
      expect(namen[1].x1 - k2.x2).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - printWriteLine.tolerance);
      expect(r1.x1 - namen[0].x2).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - printWriteLine.tolerance);
      for (const l of namen) { expect(l.x2 - l.x1).toBeGreaterThanOrEqual(printWriteLine.nameMin); }
    }
  });

  it('mit Spalte „SR“ (b mit Schiedsrichtern): jede Namenslinie ≥ 50 mm, die kleinen Linien stehen unter den Ergebnislinien, mittig, ≥ 4 mm und mit 5 mm Schreibraum darüber, die Zeile ist höher', () => {
    const mit = rowsOf(FALL_B_SR);
    const ohne = rowsOf(FALL_B);

    expect(mit).toHaveLength(8);
    mit.forEach((row, i) => {
      const [r1, r2] = ergebnis(row);
      const [k1, k2] = klein(row);

      for (const l of row.lines.filter(x => x.kind === 'name')) { expect(l.x2 - l.x1, `Spiel ${row.number}`).toBeGreaterThanOrEqual(printWriteLine.nameMin); }
      expect(k1.y - r1.y).toBeGreaterThanOrEqual(Math.max(printWriteLine.minWriteSpace, printWriteLine.minGapToStroke) - printWriteLine.tolerance);
      expect((k1.x1 + k2.x2) / 2).toBeCloseTo((r1.x1 + r2.x2) / 2, 5);
      expect(row.box.h).toBeGreaterThan(ohne[i].box.h);
      for (const l of row.lines) { expect(l.y - row.box.y).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace); }
    });
  });

  it('mit SR-Spalte und zwei Paaren (Verlängerung, Strafstoßschießen): beide Reihen unter dem Ergebnis, je 5 mm Schreibraum, Abstände ≥ 4 mm', () => {
    const rows = finalsOf(blocks({ ...mitRegelnDR019(FALL_B_SR) })).rounds.flatMap(r => r.rows);
    const finale = rows.find(r => r.number === 28);
    const ys = [...new Set((finale ? klein(finale) : []).map(l => l.y))].sort((a, b) => a - b);

    expect(ys).toHaveLength(2);
    expect(ys[1] - ys[0]).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace);
    expect(ys[0] - (finale ? ergebnis(finale)[0].y : 0)).toBeGreaterThanOrEqual(printWriteLine.minWriteSpace);
  });

  it('Gegenbeispiel: nur ein Feld (a) hat keine Finalrunde; mit zwei Feldern stehen die kleinen Linien ebenfalls unten', () => {
    const rows = finalsOf(blocks(FALL_B, { tournament: { numberOfFields: 2 } })).rounds.flatMap(r => r.rows);

    expect(rows.every(r => klein(r)[0].y > ergebnis(r)[0].y)).toBe(true);
  });
});

describe('@DR-036 Strafstoß-Zeile nur ohne Finalrunde und bei einer Gruppe', () => {
  it('Gegenbeispiel: mehrere Gruppen ohne Finalrunde, Regel für Platz 1 eingestellt → keine Strafstoß-Zeile', () => {
    const ohneFinale = { ...FALL_B, finale: undefined };
    const bs = blocks(ohneFinale, { tournament: { placementsToPlayOut: [1], groupSystem: 'groupsAndFinals', finalsConfig: { preset: 'none' } } });

    expect(bs.some(b => b.kind === 'standingsTable')).toBe(true);
    expect(bs.some(b => b.kind === 'shootout')).toBe(false);
  });
});

describe('@DR-033 Umbruch an der Stunde: eine Stunde beginnt eine Zeile vor dem natürlichen Umbruch', () => {
  const hoehen = Array.from({ length: 20 }, () => 10);

  it('bricht dort, wo die Stunde beginnt, auch wenn noch eine Zeile Platz wäre; danach folgen mindestens 3 Zeilen', () => {
    const starts = hoehen.map((_, i) => i === 16);
    const pages = splitRows(hoehen, [180, 200], 3, { starts, maxFree: 25 });

    expect(pages.map(p => p.length)).toEqual([16, 4]);
  });

  it('beginnt die Stunde erst zwei Zeilen vor dem Ende, bleiben der Folgeseite mindestens 3 Zeilen (die Schlussregel schiebt eine Zeile nach)', () => {
    const starts = hoehen.map((_, i) => i === 18);
    const pages = splitRows(hoehen, [190, 200], 3, { starts, maxFree: 25 });

    expect(pages[1].length).toBeGreaterThanOrEqual(3);
  });
});
