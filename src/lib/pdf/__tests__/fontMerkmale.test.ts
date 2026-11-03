/**
 * C-PDF-SCHRIFT-OHNE-MERKMALE (Paket PDF, T1): Die eingebettete Schrift trägt gleich breite Ziffern (tnum) und
 * unterscheidbare Formen für I und l (cv08, cv05) fest eingebacken, weil jsPDF keine OpenType-Merkmale verarbeitet.
 * Erwartung aus @DR-001 („Uhrzeiten in mindestens 14 pt“ stehen exakt untereinander) und DIN 1450 (I und l unterscheidbar).
 * `fontData/features.json` nennt die Glyphen, die das Skript `scripts/pdf-font-subset.sh` erzeugt hat.
 */
import { jsPDF } from 'jspdf';
import { describe, expect, it } from 'vitest';
import features from '../fontData/features.json';
import { printType } from '../../../design-tokens/print';
import { PDF_FONT, registerPdfFonts } from '../fonts';
import { hallencupTournament } from './pdfFixture';
import { advanceAus, glyphNameAus } from './pdfFontMetrics';
import { kopfPdf } from './pdfKopfSupport';

const SCHNITTE = [
  { datei: 'regular.ts', weight: 'normal' },
  { datei: 'bold.ts', weight: 'bold' },
] as const;

const ZIFFERN = '0123456789';
const FONT_SIZE_PT = 14;
const SIZE_TOLERANCE_PT = 0.01;

/** Breite eines Textes in mm, gesetzt mit der eingebetteten Schrift in 14 pt (wie die Uhrzeit im Spielplan). */
async function breite(text: string, weight: 'normal' | 'bold'): Promise<number> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const mode = await registerPdfFonts(doc);
  expect(mode.fallback).toBe(false);
  doc.setFont(PDF_FONT.family, weight);
  doc.setFontSize(FONT_SIZE_PT);
  return doc.getTextWidth(text);
}

describe('@DR-001 gleich breite Ziffern in der eingebetteten Schrift', () => {
  it.each(SCHNITTE)('@DR-001 Ziffern gleich breit: „1111“ und „0000“ gleich breit ($weight)', async ({ weight }) => {
    const einsen = await breite('1111', weight);
    const nullen = await breite('0000', weight);

    expect(einsen).toBeGreaterThan(0);
    expect(einsen).toBeCloseTo(nullen, 9);
  });

  it.each(SCHNITTE)('@DR-001 Uhrzeiten stehen exakt untereinander: „09:00“, „11:11“, „23:59“ gleich breit ($weight)', async ({ weight }) => {
    const breiten = await Promise.all(['09:00', '11:11', '23:59', '10:45'].map(zeit => breite(zeit, weight)));

    for (const b of breiten) {
      expect(b).toBeCloseTo(breiten[0] ?? 0, 9);
    }
  });

  it.each(SCHNITTE)('@DR-001 alle zehn Ziffern haben dieselbe Vorschubbreite in der Schriftdatei ($datei)', ({ datei }) => {
    const breiten = [...ZIFFERN].map(ziffer => advanceAus(datei, ziffer.charCodeAt(0)));

    expect(new Set(breiten).size).toBe(1);
  });

  it('Gegenbeispiel: ein Buchstabe ist nicht so breit wie eine Ziffer (die Prüfung unterscheidet etwas)', async () => {
    expect(await breite('1', 'normal')).not.toBeCloseTo(await breite('m', 'normal'), 3);
  });
});

describe('C-PDF-SCHRIFT-OHNE-MERKMALE I und l haben verschiedene Glyphen', () => {
  const zeichen = Object.keys(features.glyphs) as (keyof typeof features.glyphs)[];

  it.each(SCHNITTE)('C-PDF-SCHRIFT-OHNE-MERKMALE I und l haben verschiedene Glyphen ($datei)', ({ datei }) => {
    const gross = glyphNameAus(datei, 'I'.charCodeAt(0));
    const klein = glyphNameAus(datei, 'l'.charCodeAt(0));

    expect(gross).toBe(features.glyphs.I.glyph);
    expect(klein).toBe(features.glyphs.l.glyph);
    expect(gross).not.toBe(features.glyphs.I.standard);
    expect(klein).not.toBe(features.glyphs.l.standard);
    expect(gross).not.toBe(klein);
  });

  it.each(SCHNITTE)('C-PDF-SCHRIFT-OHNE-MERKMALE 0–9 stehen als gleich breite Ziffern (tnum) in der cmap ($datei)', ({ datei }) => {
    for (const ziffer of ZIFFERN) {
      const eintrag = features.glyphs[ziffer as keyof typeof features.glyphs];
      expect(glyphNameAus(datei, ziffer.charCodeAt(0)), `Ziffer ${ziffer}`).toBe(eintrag.glyph);
      expect(eintrag.glyph).not.toBe(eintrag.standard);
    }
  });

  it('features.json nennt die eingebackenen Merkmale und deckt 0–9, I und l ab', () => {
    expect(Object.keys(features.frozenFeatures)).toEqual(['tnum', 'cv05', 'cv08']);
    expect(features.frozenFeatures.tnum).toBe(`${ZIFFERN}:`);
    expect(zeichen.sort()).toEqual([...ZIFFERN, 'I', 'l'].sort());
  });
});

describe('C-PDF-SCHRIFT-OHNE-MERKMALE gleich breite Ziffern ändern keine Satzzeichen', () => {
  const kept = features.keptAdvanceUnits;

  it.each(SCHNITTE)('Gegenbeispiel: Leerzeichen, Bindestrich, Punkt, Komma und Klammern behalten ihre Breite ($datei)', ({ datei }) => {
    const schnitt = datei === 'regular.ts' ? kept.regular : kept.bold;
    for (const [zeichen, erwartet] of Object.entries(schnitt)) {
      expect(advanceAus(datei, zeichen.charCodeAt(0)), `Breite von „${zeichen}“`).toBe(erwartet);
    }
    expect(Object.keys(schnitt).join('')).toBe(' -.,()');
  });
});

describe('@DR-001 Uhrzeiten in der Zeit-Spalte (Spielplan-Review 01.11.: „09:00“ brach als „09:0“ / „0“ um)', () => {
  it.each(['09:00', '10:00', '20:00'])('@DR-001 Uhrzeit „%s“ steht in einer Zeile, jedes Spiel zeigt eine volle Uhrzeit', async start => {
    const { pages } = await kopfPdf({}, hallencupTournament({ timeSlot: start }));
    const kopf = pages[0].texts.find(text => text.str.trim() === 'Zeit');
    // nur die Zeit-Spalte: unter dem Spaltenkopf (die Eckdaten darüber tragen „Beginn 10:00“ in einem Stück mit Wort)
    const zeiten = pages.flatMap(page => page.texts).filter(text => Math.abs(text.size - printType.time) < SIZE_TOLERANCE_PT && /\d/.test(text.str) && text.y > (kopf?.y ?? 0));

    expect(zeiten.length).toBeGreaterThanOrEqual(12);
    for (const zeit of zeiten) {
      expect(zeit.str.trim(), 'Uhrzeit in 14 pt ist ein ganzes HH:MM, kein abgebrochenes Stück').toMatch(/^\d{2}:\d{2}$/);
    }
    expect(zeiten.some(zeit => zeit.str.trim() === start)).toBe(true);
  });
});
