/**
 * @DR-004, @DR-019, @DR-034: Schreiblinien und Ergebniszelle je Zustand, Abstände der Linien zu allen anderen Kanten auf jeder
 * Seite. Modell mit Fake-Messfunktion (2,0 / 2,2 mm je Zeichen). Die Erwartungen stammen aus dem Gherkin, die Zahlen aus den Tokens.
 */
import { describe, expect, it } from 'vitest';
import { printWriteLine } from '../../../../design-tokens/print-sheet';
import { FAKE_MEASURE } from '../../__tests__/fixtures/fakeMeasure';
import { FALL_A, FALL_B, FALL_C, fallBLang, mitStandA } from '../../__tests__/fixtures/handzettelFaelle';
import { buildRow, layoutColumns, type RowSource, type RowTexts } from '../matchRows';
import type { MatchRowModel, ScheduleModel, WriteLine } from '../types';
import { modelOf } from './modelSupport';

const TOL = printWriteLine.tolerance;
const TEXTS: RowTexts = { skipped: 'ausgefallen', overtime: 'nach Verlängerung', shootout: 'Strafstoßschießen' };

function source(partial: Partial<RowSource> = {}): RowSource {
  return { matchId: 'm1', number: 12, time: '10:00', hour: 10, home: 'FC Nord', away: 'SV Süd', state: { kind: 'empty' }, referee: '', small: [], ...partial };
}

function rowOf(src: RowSource, flags = { field: false, group: false, referee: false, smallPairs: 0 }, height = 8.3): MatchRowModel {
  const cols = layoutColumns(15, 180, flags);
  return buildRow(src, cols, 100, height, { zebra: false, hourRule: false }, TEXTS, FAKE_MEASURE, { left: 15, width: 180 });
}

const textsOf = (row: MatchRowModel): string[] => row.cell.runs.map(r => r.text);

describe('@DR-004 Schreiblinien statt Kästen', () => {
  it('@DR-004 je eine Schreiblinie für Heim und Gast, getrennt durch einen Doppelpunkt', () => {
    const row = rowOf(source());

    expect(row.cell.kind).toBe('lines');
    expect(row.lines.filter(l => l.kind === 'result')).toHaveLength(2);
    expect(textsOf(row)).toContain(':');
    const [home, away] = row.lines;
    expect(home.x2).toBeLessThan(away.x1);
  });

  it('@DR-004 die Linie nimmt eine zweistellige Zahl auf: 12 mm, mit Spalte „SR“ mindestens 10 mm (Token)', () => {
    const wide = rowOf(source()).lines[0];
    const narrow = rowOf(source(), { field: false, group: false, referee: true, smallPairs: 0 }).lines[0];

    expect(wide.x2 - wide.x1).toBeCloseTo(printWriteLine.result, 5);
    expect(narrow.x2 - narrow.x1).toBeCloseTo(printWriteLine.resultNarrow, 5);
    expect(narrow.x2 - narrow.x1).toBeGreaterThanOrEqual(printWriteLine.resultNarrow);
  });

  it('@DR-004 K.-o.-Spiel hat kleine Linien der Runde neben dem Ergebnis', () => {
    const row = rowOf(source({ small: ['overtime', 'shootout'] }), { field: false, group: false, referee: false, smallPairs: 2 });

    expect(row.lines.filter(l => l.kind === 'small')).toHaveLength(4);
    expect(textsOf(row)).toEqual(expect.arrayContaining(['nach Verlängerung', 'Strafstoßschießen']));
  });
});

describe('@DR-019 Ergebniszelle je Zustand', () => {
  it('@DR-019 laufendes Spiel: je eine leere Schreiblinie für Heim und Gast, kein „läuft“', () => {
    const row = rowOf(source({ state: { kind: 'live' } }));

    expect(row.cell.kind).toBe('lines');
    expect(textsOf(row)).toEqual([':']);
    expect(row.lines).toHaveLength(2);
  });

  it('@DR-019 ausgefallen: „ausgefallen“ ohne Schreiblinien', () => {
    const row = rowOf(source({ state: { kind: 'skipped' } }));

    expect(row.cell).toMatchObject({ kind: 'text', text: 'ausgefallen' });
    expect(row.lines).toEqual([]);
  });

  it('@DR-019 Finalrunde Halbfinale: nur kleine Linien „Strafstoßschießen“, fluchtend mit den Ergebnislinien', () => {
    const row = rowOf(source({ small: ['shootout'] }), { field: false, group: false, referee: false, smallPairs: 1 });
    const small = row.lines.filter(l => l.kind === 'small');
    const result = row.lines.filter(l => l.kind === 'result');

    expect(small).toHaveLength(2);
    expect(textsOf(row)).toContain('Strafstoßschießen');
    expect(textsOf(row)).not.toContain('nach Verlängerung');
    expect(Math.abs(small[0].y - result[0].y)).toBeLessThanOrEqual(TOL);
  });

  it('@DR-019 Finale mit Verlängerung: beide kleinen Linienpaare auf der Grundlinie der Ergebnislinien', () => {
    const row = rowOf(source({ small: ['overtime', 'shootout'] }), { field: false, group: false, referee: false, smallPairs: 2 });
    const ys = row.lines.map(l => l.y);

    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(TOL);
  });

  it('@DR-019 beendetes Spiel: das Ergebnis steht als Zahlen, keine Linien', () => {
    const row = rowOf(source({ state: { kind: 'final', scoreA: 2, scoreB: 1 } }));

    expect(row.cell).toMatchObject({ kind: 'score', a: '2', b: '1' });
    expect(row.lines).toEqual([]);
  });

  it('Gegenbeispiel @DR-019 ein ausgefallenes K.-o.-Spiel hat auch dann keine kleinen Linien', () => {
    const row = rowOf(source({ state: { kind: 'skipped' }, small: ['shootout'] }), { field: false, group: false, referee: false, smallPairs: 1 });

    expect(row.lines).toEqual([]);
  });
});

/** Alle waagerechten Striche, gegen die eine Schreiblinie Abstand halten muss (@DR-034), ohne die Linie selbst. */
function otherStrokes(model: ScheduleModel, geoFootY: number, pageIndex: number): number[] {
  const page = model.pages[pageIndex];
  const ys: number[] = [geoFootY];
  for (const block of page.blocks) {
    if (block.kind === 'header') { ys.push(block.rule.y); }
    if (block.kind === 'matchRows') {
      ys.push(block.head.rule.y);
      for (const row of block.rows) { if (row.ruleAbove) { ys.push(row.ruleAbove.y); } }
    }
  }
  return ys;
}

const FALLS = [['a', FALL_A], ['b', FALL_B], ['c', FALL_C], ['b-lang eng', fallBLang(1)], ['b-lang Folgeseite', fallBLang(2)]] as const;

describe('@DR-034 Abstand der Schreiblinien (auf jeder Seite)', () => {
  it.each(FALLS)('@DR-034 Fall %s: Linie mindestens 3 mm von der Kante einer hellen Fläche und 4 mm von jedem anderen Strich (± 0,15)', (_name, fall) => {
    const { model, geo } = modelOf(fall);

    model.pages.forEach((page, index) => {
      const strokes = otherStrokes(model, geo.footRuleY, index);
      for (const block of page.blocks) {
        if (block.kind !== 'matchRows') { continue; }
        for (const row of block.rows) {
          const edges = row.zebra ? [row.box.y, row.box.y + row.box.h] : [];
          for (const line of row.lines) {
            for (const edge of edges) { expect(Math.abs(line.y - edge)).toBeGreaterThanOrEqual(printWriteLine.minGapToFill - TOL); }
            for (const y of strokes) { expect(Math.abs(line.y - y)).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - TOL); }
          }
        }
      }
    });
  });

  it('@DR-034 die Linie liegt in jeder Zeile gleich hoch über dem Zeilenboden, auch bei mehrzeiligem Namen', () => {
    const { model } = modelOf(fallBLang(2));
    const lines: Array<{ row: MatchRowModel; line: WriteLine }> = model.pages.flatMap(p => p.blocks.flatMap(b => (b.kind === 'matchRows' ? b.rows.flatMap(row => row.lines.map(line => ({ row, line }))) : [])));

    expect(lines.length).toBeGreaterThan(0);
    for (const { row, line } of lines) { expect(row.box.y + row.box.h - line.y).toBeCloseTo(printWriteLine.aboveRowBottom, 5); }
  });

  it('@DR-034 je Zeile genau ein Strich je Linie: keine zwei Linien übereinander', () => {
    const { model } = modelOf(FALL_B);
    const rows = model.pages.flatMap(p => p.blocks.flatMap(b => (b.kind === 'matchRows' ? b.rows : [])));

    for (const row of rows) { expect(new Set(row.lines.map(l => `${l.x1}|${l.x2}|${l.y}`)).size).toBe(row.lines.length); }
  });

  it('@DR-034 Zeilen über Zebra, keine Trennstriche: Stundentrenner nur bei Stundenwechsel, nie unter dem Spaltenkopf', () => {
    const { model } = modelOf(FALL_B);
    const rows = model.pages[0].blocks.flatMap(b => (b.kind === 'matchRows' ? b.rows : []));

    expect(rows[0].ruleAbove).toBeUndefined();
    expect(rows.filter(r => r.ruleAbove).map(r => r.number)).toEqual([6, 11, 16]);
    expect(rows.map(r => r.zebra).slice(0, 4)).toEqual([false, true, false, true]);
  });

  it('Gegenbeispiel @DR-034 mit laufenden und ausgefallenen Spielen bleibt der Abstand gewahrt', () => {
    const { model, geo } = modelOf(mitStandA(), { options: { includeScores: true } });
    const strokes = otherStrokes(model, geo.footRuleY, 0);
    const rows = model.pages[0].blocks.flatMap(b => (b.kind === 'matchRows' ? b.rows : []));

    for (const row of rows) { for (const line of row.lines) { for (const y of strokes) { expect(Math.abs(line.y - y)).toBeGreaterThanOrEqual(printWriteLine.minGapToStroke - TOL); } } }
  });
});
