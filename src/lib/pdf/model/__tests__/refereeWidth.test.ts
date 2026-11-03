/**
 * Spalte „SR“ aus ihrem Inhalt (@DR-025, @DR-032, @DR-033) und Gruppenzeichen nach Buchstabe (@DR-001), mit der echten Schrift
 * (Inter): Fall c (lange Namen, Spalte „SR“ mit Nummern) bleibt in Stufe „normal“, kein Name über zwei Zeilen.
 */
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import { printMatchTable } from '../../../../design-tokens/print-sheet';
import { FALL_B, FALL_C } from '../../__tests__/fixtures/handzettelFaelle';
import { fontOf, registerPdfFonts } from '../../fonts';
import { jspdfMeasure, type TextMeasure } from '../measure';
import { modelOf } from './modelSupport';

async function inter(): Promise<TextMeasure> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await registerPdfFonts(doc);
  return jspdfMeasure(doc, fontOf(doc));
}

const rowsOf = (m: ReturnType<typeof modelOf>['model']) => m.pages.flatMap(p => p.blocks).flatMap(b => (b.kind === 'matchRows' ? b.rows : []));
const refW = (m: ReturnType<typeof modelOf>['model']): number | undefined =>
  m.pages.flatMap(p => p.blocks).flatMap(b => (b.kind === 'matchRows' ? b.head.columns : [])).find(c => c.key === 'referee')?.w;

describe('@DR-025 @DR-032 @DR-033 Spalte „SR“ so breit wie ihr Inhalt', () => {
  it('Fall c mit Nummern: Spalte schmaler als der Token, kein Name über zwei Zeilen, Seite 1 in Stufe „normal“', async () => {
    const { model } = modelOf(FALL_C, { measure: await inter() });

    expect(refW(model)).toBeLessThan(printMatchTable.cols.referee - 5);
    expect(model.fit).toBe('normal');
    rowsOf(model).forEach(r => {
      expect(r.home.name.length, `Spiel ${r.number} Heim`).toBeLessThanOrEqual(2);
      expect(r.away.name.length, `Spiel ${r.number} Gast`).toBeLessThanOrEqual(2);
    });
  });

  it('Gegenprobe „Teams pfeifen“: Teamnamen in der Spalte, sie bleibt so breit wie der Token', async () => {
    const { model } = modelOf(FALL_C, { measure: await inter(), tournament: { refereeConfig: { mode: 'teams', numberOfReferees: 2 } } });

    expect(refW(model)).toBeCloseTo(printMatchTable.cols.referee, 5);
  });
});

describe('@DR-001 Gruppenzeichen wechseln je Gruppe nach dem Buchstaben', () => {
  const shapes = (m: ReturnType<typeof modelOf>['model']): Record<string, string | undefined> =>
    Object.fromEntries(rowsOf(m).map(r => [r.group?.text.text ?? '', r.group?.shape]));

  it('A eckig, B rund', () => {
    expect(shapes(modelOf(FALL_B).model)).toMatchObject({ A: 'square', B: 'circle' });
  });

  it('spielt Gruppe B zuerst, ist B trotzdem rund und A eckig', () => {
    const vertauscht = { ...FALL_B, spiele: FALL_B.spiele.map(s => (s.nr === 1 ? { ...s, zeit: '10:12' } : s.nr === 2 ? { ...s, zeit: '10:00' } : s)) };
    const m = modelOf(vertauscht).model;

    expect(rowsOf(m)[0].group?.text.text, 'B beginnt').toBe('B');
    expect(shapes(m)).toMatchObject({ A: 'square', B: 'circle' });
  });
});
