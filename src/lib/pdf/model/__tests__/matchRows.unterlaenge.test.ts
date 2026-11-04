/**
 * T9 (Befund C-PDF-ENGE-STUFE-UNTERLAENGE): In jeder Stufe der Reserve-Regel (normal, eng, Folgeseite) bleibt jeder Text einer Spielzeile
 * mit Ober- und Unterlänge in seiner Zeile; ein Stundentrenner über der Zeile berührt keinen Text. Mit der echten Schrift (Inter,
 * jsPDF-Adapter); welche Stufe greift, regelt der Platz auf Seite 1 (Satzspiegel unten länger oder kürzer).
 * Szenarien: @DR-033 (Reserve-Regel, Zeilenabstand ≥ 1,15, Namen nie gekürzt; dritte Zeile nach @DR-032), @DR-001 (Schrift, nichts geht verloren).
 */
import { jsPDF } from 'jspdf';
import { beforeAll, describe, expect, it } from 'vitest';
import { printFont, printUnit } from '../../../../design-tokens/print';
import { printHourRule } from '../../../../design-tokens/print-sheet';
import { fontOf, registerPdfFonts } from '../../fonts';
import { FALL_C, fallBLang, type HandzettelFall } from '../../__tests__/fixtures/handzettelFaelle';
import { jspdfMeasure, type TextMeasure } from '../measure';
import type { FitStep, MatchRowModel, ScheduleModel, TextRun } from '../types';
import { matchPages, modelOf } from './modelSupport';

const TOL = 0.01;
/** Zeichen mit Unterlänge in Inter; Ziffern, Doppelpunkt und Versalien ohne sie enden auf der Grundlinie. */
const DESCENDER = /[gjpqyß/(),;|]/;
/** Nur Ziffern und Doppelpunkt: oben reichen sie bis zur Versalhöhe, nicht bis zur Oberlänge der Schrift. */
const CAPS_ONLY = /^[\d:]+$/;
const LANG3 = 'SG Kirchanschöring/Petting/Waging/Tengling/Taching/Fridolfing';

/** Fall c mit einem Namen, der auf drei Zeilen bricht (@DR-032 Gegenbeispiel, T9 Fall c-3zeilig). */
function fallC3(): HandzettelFall {
  const ren = (n: string): string => (n === 'SG Kirchanschöring/Petting/Waging' ? LANG3 : n);
  return { ...FALL_C, teams: FALL_C.teams.map(t => ({ ...t, name: ren(t.name) })), spiele: FALL_C.spiele.map(s => ({ ...s, heim: ren(s.heim), gast: ren(s.gast) })) };
}

const mm = (pt: number, em: number): number => pt * em * printUnit.mmPerPt;
const top = (r: TextRun): number => r.y - mm(r.pt, CAPS_ONLY.test(r.text) ? printFont.capEm : printFont.ascentEm);
const bottom = (r: TextRun): number => r.y + (DESCENDER.test(r.text) ? mm(r.pt, printFont.descentEm) : 0);
const runsOf = (row: MatchRowModel): TextRun[] =>
  [row.nr, row.time, ...(row.field ? [row.field] : []), ...(row.group ? [row.group.text] : []), ...row.home.runs, ...row.away.runs, ...row.cell.runs, ...(row.referee ?? [])];
const rowsOf = (model: ScheduleModel): MatchRowModel[] => matchPages(model).flatMap(p => p.blocks.flatMap(b => (b.kind === 'matchRows' ? b.rows : [])));

let measure: TextMeasure;
beforeAll(async () => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await registerPdfFonts(doc);
  measure = jspdfMeasure(doc, fontOf(doc));
});

/** Modelle des Falls bei mehr oder weniger Platz auf Seite 1, je Stufe das erste. */
function byStep(fall: HandzettelFall): Map<FitStep, ScheduleModel> {
  const found = new Map<FitStep, ScheduleModel>();
  for (let extra = -60; extra <= 120; extra += 2) {
    const { model } = modelOf(fall, { measure, geo: g => ({ ...g, bottom: g.bottom + extra }) });
    if (!found.has(model.fit)) { found.set(model.fit, model); }
  }
  return found;
}

describe.each([
  ['c mit dreizeiligem Namen', fallC3()],
  ['b-lang (ein langer Name)', fallBLang(1)],
  ['b-lang (zwei lange Namen)', fallBLang(2)],
] as const)('@DR-033 @DR-001 Fall %s: jeder Text bleibt in seiner Zeile', (_name, fall) => {
  it('@DR-033 die Stufen normal, eng und Folgeseite kommen vor, und es gibt mehrzeilige Namen', () => {
    const steps = byStep(fall);

    expect([...steps.keys()].sort()).toEqual(['nextPage', 'normal', 'tight']);
    for (const model of steps.values()) { expect(rowsOf(model).some(r => r.home.runs.length > 1 || r.away.runs.length > 1)).toBe(true); }
  });

  it.each(['normal', 'tight', 'nextPage'] as const)('@DR-001 Stufe %s: Unterkante jedes Textes ≤ Unterkante der Zeile, Oberkante ≥ Oberkante der Zeile', step => {
    const model = byStep(fall).get(step)!;

    for (const row of rowsOf(model)) {
      for (const r of runsOf(row)) {
        expect(bottom(r), `Spiel ${row.number} „${r.text}“ unten`).toBeLessThanOrEqual(row.box.y + row.box.h + TOL);
        expect(top(r), `Spiel ${row.number} „${r.text}“ oben`).toBeGreaterThanOrEqual(row.box.y - TOL);
      }
    }
  });

  it.each(['normal', 'tight', 'nextPage'] as const)('@DR-001 Stufe %s: kein Text reicht in den Stundentrenner über seiner Zeile', step => {
    const model = byStep(fall).get(step)!;

    for (const row of rowsOf(model).filter(r => r.ruleAbove)) {
      const ruleBottom = row.ruleAbove!.y + printHourRule.stroke / 2;
      for (const r of runsOf(row)) { expect(top(r), `Spiel ${row.number} „${r.text}“`).toBeGreaterThanOrEqual(ruleBottom - TOL); }
    }
  });
});
