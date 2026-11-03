/**
 * Messfunktion des Seitenmodells (PDF-Paket V1): die feste Fake-Messung der Modelltests (2,0 / 2,2 mm je Zeichen) und
 * der Adapter auf jsPDF mit der eingebetteten Schrift aus T1 (ein Abgleich, Review G7).
 */
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { fontOf, registerPdfFonts } from '../../fonts';
import { fixedWidthMeasure, jspdfMeasure } from '../measure';
import { FAKE_MEASURE } from '../../__tests__/fixtures/fakeMeasure';

describe('fixedWidthMeasure (Fake der Modelltests)', () => {
  it('2,0 mm je Zeichen normal, 2,2 mm fett, unabhängig von der Schriftgröße', () => {
    expect(FAKE_MEASURE.width('FC Nord', 12, 'normal')).toBeCloseTo(14, 9);
    expect(FAKE_MEASURE.width('FC Nord', 24, 'bold')).toBeCloseTo(15.4, 9);
  });

  it('zählt Zeichen, nicht UTF-16-Einheiten (Umlaut, Kyrillisch, geschütztes Leerzeichen)', () => {
    expect(FAKE_MEASURE.width('Süd', 12, 'normal')).toBeCloseTo(6, 9);
    expect(FAKE_MEASURE.width('Кубок', 12, 'normal')).toBeCloseTo(10, 9);
    expect(FAKE_MEASURE.width('Platz 3', 12, 'normal')).toBeCloseTo(14, 9);
    expect(fixedWidthMeasure({ normal: 1, bold: 1 }).width('😀', 12, 'normal')).toBe(1);
  });
});

describe('jspdfMeasure (Adapter, Schrift aus T1)', () => {
  it('misst wie getTextWidth in mm, fett breiter als normal, doppelte Größe doppelt so breit', async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const mode = await registerPdfFonts(doc);
    expect(mode.fallback).toBe(false);
    const measure = jspdfMeasure(doc, fontOf(doc));

    doc.setFont(fontOf(doc), 'normal');
    doc.setFontSize(12);
    const direkt = doc.getTextWidth('SG Grabenstätt/Chieming');
    const normal = measure.width('SG Grabenstätt/Chieming', 12, 'normal');

    expect(normal).toBeCloseTo(direkt, 6);
    expect(measure.width('SG Grabenstätt/Chieming', 12, 'bold')).toBeGreaterThan(normal);
    expect(measure.width('SG Grabenstätt/Chieming', 24, 'normal')).toBeCloseTo(2 * normal, 6);
  });

  it('lässt Schrift, Schnitt und Größe des Dokuments unverändert', async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    await registerPdfFonts(doc);
    doc.setFont(fontOf(doc), 'normal');
    doc.setFontSize(9);

    jspdfMeasure(doc, fontOf(doc)).width('Live-Ergebnisse', 14, 'bold');

    expect(doc.getFont().fontStyle).toBe('normal');
    expect(doc.getFont().fontName).toBe(fontOf(doc));
    expect(doc.getFontSize()).toBe(9);
  });
});
