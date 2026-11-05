/**
 * T9 (Befund C-PDF-GEWERTET): Ein gewertetes Spiel (Nichtantritt, `decidedBy: 'forfeit'`) trägt unter dem Ergebnis klein
 * „gewertet“ (EN „awarded“), wie ein korrigiertes Spiel „korrigiert 14:52“, in Gruppenspielen und Finalrunde, ohne Farbe.
 * Ein normal beendetes Spiel trägt kein Kennzeichen. Gemessen am fertigen PDF (pdfjs), Fall b.
 * Szenario: @DR-001 („beendet, ausgefallen, gewertet und korrigiert sind ohne Farbe voneinander zu unterscheiden“).
 */
import { describe, expect, it } from 'vitest';
import { printType } from '../../../design-tokens/print';
import type { Match } from '../../../types/tournament';
import type { PdfLocale } from '../translations';
import { FALL_B } from './fixtures/handzettelFaelle';
import { fallMatches } from './fixtures/handzettelTurnier';
import { handzettelPdf } from './handzettelPdf';
import type { LayoutPage, LayoutText } from './pdfjsLayout';

const TOL = 0.05;
const MARK = { de: 'gewertet', en: 'awarded' } as const;
const ABOVE = 4;

/** Fall b am Turniertag: 3 und 22 normal beendet, 4 und 21 gewertet (Gast nicht angetreten). */
function stand(): Match[] {
  return fallMatches(FALL_B).map((m): Match => {
    switch (m.matchNumber) {
      case 3: return { ...m, matchStatus: 'finished', scoreA: 1, scoreB: 0 };
      case 4: return { ...m, matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' };
      case 21: return { ...m, matchStatus: 'finished', scoreA: 2, scoreB: 0, decidedBy: 'forfeit', forfeitAbsent: 'B' };
      case 22: return { ...m, matchStatus: 'finished', scoreA: 3, scoreB: 1, decidedBy: 'regular' };
      default: return m;
    }
  });
}

/**
 * Seite und Textstücke der Zeile, deren Uhrzeit `time` ist: Grundlinien von 4 mm über ihrer Uhrzeit bis 4 mm über der Uhrzeit der
 * nächsten Zeile (die Ziffern eines Ergebnisses mit Kennzeichen stehen etwas höher als die Uhrzeit; jede Zeile ist mindestens 8,3 mm hoch).
 */
function rowTexts(pages: LayoutPage[], time: string, next: string): { page: LayoutPage; texts: LayoutText[] } {
  const page = pages.find(p => p.texts.some(t => t.str.trim() === time));
  expect(page, `Zeile ${time}`).toBeDefined();
  const top = page!.texts.find(t => t.str.trim() === time)!.y - ABOVE;
  const bottom = (page!.texts.find(t => t.str.trim() === next)?.y ?? Number.POSITIVE_INFINITY) - ABOVE;
  return { page: page!, texts: page!.texts.filter(t => t.y > top && t.y < bottom && t.str.trim() !== '') };
}

async function pdfIn(locale: PdfLocale) {
  return handzettelPdf(FALL_B, { locale, tournament: { matches: stand() }, options: { includeScores: true } });
}

describe.each(['de', 'en'] as const)('@DR-001 gewertet (%s)', locale => {
  it.each([
    ['Gruppenspiel 4', '10:36', '10:48'],
    ['Finalspiel 21 (Viertelfinale)', '14:08', '14:20'],
  ])('@DR-001 %s: unter dem Ergebnis steht klein das Kennzeichen, schwarz wie alle Texte', async (_name, time, next) => {
    const { pages } = await pdfIn(locale);
    const { texts } = rowTexts(pages, time, next);
    const mark = texts.find(t => t.str.trim() === MARK[locale]);
    const digits = texts.filter(t => t.size >= printType.result - TOL && /^\d+$/.test(t.str.trim()));

    expect(digits.map(t => t.str.trim()), 'Ergebnis 2:0').toEqual(['2', '0']);
    expect(mark, `„${MARK[locale]}“`).toBeDefined();
    expect(mark!.size).toBeCloseTo(printType.mark, 1);
    expect(mark!.y, 'unter den Ziffern').toBeGreaterThan(Math.max(...digits.map(t => t.y)));
    const digitsMid = (Math.min(...digits.map(t => t.x)) + Math.max(...digits.map(t => t.x + t.w))) / 2;
    expect(Math.abs(mark!.x + mark!.w / 2 - digitsMid), 'mittig unter dem Ergebnis').toBeLessThanOrEqual(1);
  });

  it.each([
    ['Gruppenspiel 3', '10:24', '10:36'],
    ['Finalspiel 22', '14:20', '14:32'],
  ])('@DR-001 Gegenbeispiel %s normal beendet: kein Kennzeichen unter dem Ergebnis', async (_name, time, next) => {
    const { pages } = await pdfIn(locale);
    const { texts } = rowTexts(pages, time, next);

    expect(texts.filter(t => t.size >= printType.result - TOL && /^\d+$/.test(t.str.trim())).length).toBe(2);
    expect(texts.filter(t => Math.abs(t.size - printType.mark) < 0.1).map(t => t.str)).toEqual([]);
  });

  it('@DR-001 das Kennzeichen steht nur bei den beiden gewerteten Spielen', async () => {
    const { pages } = await pdfIn(locale);

    expect(pages.flatMap(p => p.texts).filter(t => t.str.includes(MARK[locale]))).toHaveLength(2);
  });
});

describe('@DR-001 gewertet und korrigiert zugleich (Entscheidung Daniel, Review N2)', () => {
  it('@DR-001 ein gewertetes Spiel mit Korrektur trägt genau „gewertet“, kein „korrigiert“', async () => {
    const matches = stand().map((m): Match => (m.matchNumber === 4
      ? { ...m, correctionHistory: [{ timestamp: new Date(2026, 10, 15, 10, 50).toISOString(), previousScoreA: 3, previousScoreB: 0, newScoreA: 2, newScoreB: 0 }] }
      : m));
    const { pages } = await handzettelPdf(FALL_B, { tournament: { matches }, options: { includeScores: true } });
    const { texts } = rowTexts(pages, '10:36', '10:48');

    expect(texts.filter(t => Math.abs(t.size - printType.mark) < 0.1).map(t => t.str.trim())).toEqual(['gewertet']);
    expect(pages.flatMap(p => p.texts).some(t => t.str.includes('korrigiert'))).toBe(false);
  });
});

