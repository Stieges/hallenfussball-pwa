/**
 * B-28 C8-F (Ruling 7, VISUAL-DESIGN § 2): Im Tabellenkopf bricht kein Wort um, in Deutsch und Englisch. Die Spalte ist
 * mindestens so breit wie das Kopfwort in der PDF-Schrift. Gelesen aus dem PDF (pdfjs): jedes Kopfwort steht als ein Textstück.
 */
import { describe, expect, it } from 'vitest';
import { hallencupSchedule, hallencupTournament } from './pdfFixture';
import { layoutOf } from './pdfFixtureLayout';
import { translatorFor } from './pdfText';

const MATCH_HEAD = {
  de: ['Nr', 'Zeit', 'Feld', 'Gr', 'Heim', 'Ergebnis', 'Gast', 'SR'],
  en: ['No.', 'Time', 'Pitch', 'Grp', 'Home', 'Result', 'Away', 'Ref.'],
} as const;
const TABLE_HEAD = {
  de: ['Pl', 'Team', 'Sp', 'S', 'U', 'N', 'Tore', 'Diff', 'Pkt'],
  en: ['Pos', 'Team', 'P', 'W', 'D', 'L', 'Goals', 'Diff', 'Pts'],
} as const;

describe.each(['de', 'en'] as const)('@DR-001 Kopfwörter der Tabellen brechen nicht um (%s)', locale => {
  it('Spieltabellen (Gruppenphase und Finalrunde): jedes Kopfwort ist ein Textstück, nie „N“ + „o.“', async () => {
    const { pages } = await layoutOf({ locale, translate: translatorFor(locale), includeScores: true }, hallencupSchedule());
    const strs = pages.flatMap(p => p.texts.map(t => t.str.trim()));

    for (const word of MATCH_HEAD[locale]) {
      expect(strs.filter(s => s === word).length, `Kopfwort „${word}“`).toBeGreaterThanOrEqual(1);
    }
    // Gruppenphase und jede Finalrunden-Tabelle tragen „Zeit“: auf jeder Tabelle steht das Wort vollständig
    const tables = strs.filter(s => s === MATCH_HEAD[locale][1]).length;
    for (const word of MATCH_HEAD[locale].filter(w => w !== MATCH_HEAD[locale][2] && w !== MATCH_HEAD[locale][3])) {
      expect(strs.filter(s => s === word).length, `„${word}“ je Tabelle`).toBe(tables);
    }
  });

  it('Gruppentabellen: Kopfwörter vollständig', async () => {
    const { pages } = await layoutOf({ locale, translate: translatorFor(locale), includeScores: true }, hallencupSchedule(hallencupTournament()));
    const strs = pages.flatMap(p => p.texts.map(t => t.str.trim()));

    for (const word of TABLE_HEAD[locale]) {
      expect(strs, `Kopfwort „${word}“`).toContain(word);
    }
  });
});
