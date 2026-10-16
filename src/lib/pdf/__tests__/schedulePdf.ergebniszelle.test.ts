/**
 * B-28 C1 (a3-5): Ergebniszelle im fertigen PDF, je Zustand ein Fall, gelesen mit pdfjs. Zwei Kästchen mit Doppelpunkt,
 * Ziffern 18 pt fett, „läuft“ mit Balken links, „korrigiert hh:mm“ und „ausgefallen“ ohne Farbe unterscheidbar.
 * Szenarien: @DR-001, @BM-011, @BM-012, @BM-013, @BM-045.
 */
import { describe, expect, it } from 'vitest';
import { printBox, printColors, printLimits, printType } from '../../../design-tokens/print';
import { pageGeometry } from '../layout';
import { balken, hallencupMitStand, istFett, kaestchenIn, SIZE_TOL, textsIn, TOL, zeileVon, type Zeile } from './pdfScoreSupport';
import type { LayoutPage } from './pdfjsLayout';
import { colorsUsed } from './pdfjsLayout';

const KORREKTUR = [{ timestamp: '2026-11-14T14:52:00', previousScoreA: 1, previousScoreB: 0, newScoreA: 1, newScoreB: 1 }];
const LINKS = pageGeometry('a4', 'portrait').left;

const STAND = {
  11: { matchStatus: 'finished' as const, scoreA: 2, scoreB: 1 },
  12: { matchStatus: 'running' as const, scoreA: 1, scoreB: 0 },
  9: { matchStatus: 'finished' as const, scoreA: 1, scoreB: 1, correctionHistory: KORREKTUR },
  8: { matchStatus: 'skipped' as const },
};

/** Ergebnisspalte der Zeile: Ziffern in der Ergebnisschrift und der Doppelpunkt in seiner Schrift (Feld- und Gruppenspalte haben andere Größen). */
const ergebnisTexte = (zeile: Zeile) => textsIn(zeile).filter(t =>
  (/^\d+$/.test(t.str.trim()) && Math.abs(t.size - printType.result) <= SIZE_TOL) ||
  (t.str.trim() === ':' && Math.abs(t.size - printType.resultColon) <= SIZE_TOL));

describe('@BM-011 beendet: zwei Kästchen, Doppelpunkt, Ziffern 18 pt fett', () => {
  it('Spiel 11 (2:1): „2“ und „1“ je in einem Kästchen der Größe printBox.scoreField, Doppelpunkt dazwischen', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 11);
    const kaesten = kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h);
    const texte = ergebnisTexte(zeile);
    const zwei = texte.find(t => t.str.trim() === '2');
    const eins = texte.find(t => t.str.trim() === '1');
    const punkt = texte.find(t => t.str.trim() === ':');

    expect(kaesten, 'zwei Kästchen').toHaveLength(2);
    expect(zwei && eins && punkt).toBeTruthy();
    if (zwei && eins && punkt) {
      expect(zwei.x + zwei.w / 2).toBeGreaterThan(kaesten[0].x);
      expect(zwei.x + zwei.w / 2).toBeLessThan(kaesten[0].x + kaesten[0].w);
      expect(eins.x + eins.w / 2).toBeGreaterThan(kaesten[1].x);
      expect(eins.x + eins.w / 2).toBeLessThan(kaesten[1].x + kaesten[1].w);
      expect(punkt.x).toBeGreaterThan(kaesten[0].x + kaesten[0].w);
      expect(punkt.x).toBeLessThan(kaesten[1].x);
      for (const ziffer of [zwei, eins]) {
        expect(ziffer.size, 'Ziffern mindestens 18 pt').toBeGreaterThanOrEqual(printLimits.resultPt - SIZE_TOL);
        expect(istFett(zeile.page, ziffer), 'Ziffern fett').toBe(true);
        expect(ziffer.y, 'Ziffer im Kästchen').toBeGreaterThan(kaesten[0].y);
        expect(ziffer.y).toBeLessThan(kaesten[0].y + kaesten[0].h);
      }
    }
  });

  it('Spiel 11 trägt weder „läuft“ noch „korrigiert“ noch einen Balken', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 11);

    expect(textsIn(zeile).map(t => t.str)).not.toContain('läuft');
    expect(textsIn(zeile).some(t => t.str.startsWith('korrigiert'))).toBe(false);
    expect(balken(zeile.page, printBox.liveBar, zeile.top, zeile.bottom)).toEqual([]);
  });
});

describe('@BM-012 läuft: Kästchen leer, „läuft“ unter dem Kasten, dicker Balken links', () => {
  it('Spiel 12: zwei leere Kästchen, kein Zwischenstand, Wort „läuft“ fett unter den Kästchen', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 12);
    const kaesten = kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h);
    const laeuft = textsIn(zeile).find(t => t.str.trim() === 'läuft');

    expect(kaesten).toHaveLength(2);
    expect(ergebnisTexte(zeile).map(t => t.str.trim()), 'nur der Doppelpunkt, keine Ziffer').toEqual([':']);
    expect(laeuft, '„läuft“ in der Zeile').toBeDefined();
    expect(laeuft && istFett(zeile.page, laeuft)).toBe(true);
    expect(Math.abs((laeuft?.size ?? 0) - printType.mark)).toBeLessThanOrEqual(SIZE_TOL);
    expect(laeuft?.y ?? 0, 'unter den Kästchen').toBeGreaterThan(kaesten[0].y + kaesten[0].h);
  });

  it('Spiel 12: ein schwarzer Balken der Breite printBox.liveBar am linken Rand, über die ganze Zeilenhöhe', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 12);
    const [leiste] = balken(zeile.page, printBox.liveBar, zeile.top, zeile.bottom);

    expect(leiste, 'Balken').toBeDefined();
    expect(Math.abs((leiste?.x ?? 0) - LINKS)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((leiste?.h ?? 0) - (zeile.bottom - zeile.top))).toBeLessThanOrEqual(0.3);
  });

  it('Gegenbeispiel: in der Ergebnisspalte von Spiel 12 steht kein Textstück „1“ und keine „0“', async () => {
    const pages = await hallencupMitStand(STAND);
    const ziffern = ergebnisTexte(zeileVon(pages, 12)).map(t => t.str.trim());

    expect(ziffern).not.toContain('1');
    expect(ziffern).not.toContain('0');
  });
});

describe('@BM-013 korrigiert und ausgefallen', () => {
  it('Spiel 9 (1:1, korrigiert 14:52): Ergebnis mit „korrigiert 14:52“ unter den Kästchen, nicht fett', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 9);
    const kaesten = kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h);
    const kennzeichen = textsIn(zeile).find(t => t.str.trim() === 'korrigiert 14:52');

    expect(kaesten).toHaveLength(2);
    expect(ergebnisTexte(zeile).filter(t => t.str.trim() === '1')).toHaveLength(2);
    expect(kennzeichen, 'Kennzeichen').toBeDefined();
    expect(kennzeichen && istFett(zeile.page, kennzeichen)).toBe(false);
    expect(Math.abs((kennzeichen?.size ?? 0) - printType.mark)).toBeLessThanOrEqual(SIZE_TOL);
    expect(kennzeichen?.y ?? 0).toBeGreaterThan(kaesten[0].y + kaesten[0].h);
  });

  it('Spiel 8 (übersprungen): Kasten „ausgefallen“ statt Kästchen, ohne Ziffern', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 8);
    const kasten = kaestchenIn(zeile, printBox.cancel.w, printBox.cancel.h);
    const wort = textsIn(zeile).find(t => t.str.trim() === 'ausgefallen');

    expect(kasten, 'Kasten').toHaveLength(1);
    expect(wort, 'Wort').toBeDefined();
    expect(wort && istFett(zeile.page, wort)).toBe(true);
    expect(wort?.x ?? 0).toBeGreaterThan(kasten[0].x);
    expect((wort?.x ?? 0) + (wort?.w ?? 0)).toBeLessThan(kasten[0].x + kasten[0].w);
    expect(kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h), 'keine Schreibfelder').toEqual([]);
    expect(ergebnisTexte(zeile)).toEqual([]);
  });

  it('Gegenbeispiel: ein geplantes Spiel hat zwei leere Kästchen, kein Wort, keine Ziffer', async () => {
    const pages = await hallencupMitStand(STAND);
    const zeile = zeileVon(pages, 10);

    expect(kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h)).toHaveLength(2);
    expect(ergebnisTexte(zeile).map(t => t.str.trim())).toEqual([':']);
    expect(textsIn(zeile).some(t => ['läuft', 'ausgefallen'].includes(t.str.trim()) || t.str.startsWith('korrigiert'))).toBe(false);
  });
});

/** Merkmale einer Ergebniszelle, die ohne Farbe zu sehen sind. */
function merkmale(page: LayoutPage, zeile: Zeile): string {
  const texte = textsIn(zeile).map(t => t.str.trim());
  return JSON.stringify({
    ziffern: ergebnisTexte(zeile).some(t => /\d/.test(t.str)),
    balken: balken(page, printBox.liveBar, zeile.top, zeile.bottom).length > 0,
    wort: texte.filter(t => ['läuft', 'ausgefallen'].includes(t) || t.startsWith('korrigiert')),
    kasten: kaestchenIn(zeile, printBox.cancel.w, printBox.cancel.h).length,
  });
}

describe('@DR-001 Zustände ohne Farbe unterscheidbar', () => {
  it('beendet, läuft, korrigiert, ausgefallen und geplant haben fünf verschiedene Merkmale; nur Schwarz und Weiß', async () => {
    const pages = await hallencupMitStand(STAND);
    const nummern = [11, 12, 9, 8, 10];
    const hex = (rgb: readonly number[]): string => `#${rgb.map(v => v.toString(16).padStart(2, '0')).join('')}`;
    const erlaubt = [printColors.ink, printColors.paper, printColors.tint].map(hex);
    const signaturen = nummern.map(nr => {
      const zeile = zeileVon(pages, nr);
      return merkmale(zeile.page, zeile);
    });

    expect(new Set(signaturen).size).toBe(nummern.length);
    for (const page of pages) {
      expect(colorsUsed(page).filter(c => !erlaubt.includes(c))).toEqual([]);
    }
  });
});

describe('Fassung und Schalter: Ergebnisse erscheinen nicht', () => {
  it.each([
    ['Fassung zum Ausfüllen', { edition: 'blank' as const, includeScores: false }],
    ['Schalter „Ergebnisse zeigen“ aus', { includeScores: false }],
  ])('%s: Spiel 11, 12 und 8 zeigen leere Kästchen, keinen Balken, kein Kennzeichen', async (_name, options) => {
    const pages = await hallencupMitStand(STAND, {}, options);

    for (const nr of [11, 12, 8]) {
      const zeile = zeileVon(pages, nr);
      expect(kaestchenIn(zeile, printBox.scoreField.w, printBox.scoreField.h), `Spiel ${nr}`).toHaveLength(2);
      expect(ergebnisTexte(zeile).map(t => t.str.trim()), `Spiel ${nr}`).toEqual([':']);
      expect(balken(zeile.page, printBox.liveBar, zeile.top, zeile.bottom), `Spiel ${nr}`).toEqual([]);
      expect(textsIn(zeile).some(t => ['läuft', 'ausgefallen'].includes(t.str.trim())), `Spiel ${nr}`).toBe(false);
    }
  });
});
