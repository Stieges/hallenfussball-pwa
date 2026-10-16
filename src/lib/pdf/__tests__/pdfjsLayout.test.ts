/**
 * Selbsttest des Maß-Werkzeugs `pdfjsLayout.ts` (B-28a3-1): ein Mini-PDF mit bekannten Maßen über das echte jsPDF.
 * Rechteck 12 × 8 mm bei (20, 30) und Text 15 pt fett. Gegenbeispiel: 11 × 8 mm darf nicht als 12 × 8 gelten.
 */
import { describe, expect, it } from 'vitest';
import { jsPDF } from 'jspdf';
import { colorsUsed, readLayout, rectsIn, textIn, type LayoutPage } from './pdfjsLayout';

const TOL = 0.1;

function miniPdf(rectWidthMm: number): Uint8Array {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  doc.setFillColor(0, 0, 0);
  doc.rect(20, 30, rectWidthMm, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('Mini', 20, 60);
  return new Uint8Array(doc.output('arraybuffer'));
}

async function pageOf(rectWidthMm: number): Promise<LayoutPage> {
  const [page] = await readLayout(miniPdf(rectWidthMm));
  if (!page) {throw new Error('Mini-PDF ohne Seite');}
  return page;
}

describe('Maß-Werkzeug pdfjsLayout (Selbsttest am Mini-PDF)', () => {
  it('Rechteck 12 × 8 mm bei (20, 30) und Text 15 pt fett auf ±0,1 genau', async () => {
    const page = await pageOf(12);
    const [rect] = rectsIn(page, { x: 19, y: 29, w: 14, h: 10 });

    expect(rect, 'Rechteck gefunden').toBeDefined();
    expect(rect?.w).toBeCloseTo(12, 0);
    expect(Math.abs((rect?.w ?? 0) - 12)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((rect?.h ?? 0) - 8)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((rect?.x ?? 0) - 20)).toBeLessThanOrEqual(TOL);
    expect(Math.abs((rect?.y ?? 0) - 30)).toBeLessThanOrEqual(TOL);

    const [text] = textIn(page, { x: 19, y: 50, w: 20, h: 14 });
    expect(text?.str).toBe('Mini');
    expect(Math.abs((text?.size ?? 0) - 15)).toBeLessThanOrEqual(0.05);
    expect(text?.bold).toBe(true);
    expect(Math.abs((text?.x ?? 0) - 20)).toBeLessThanOrEqual(TOL);
  });

  it('Gegenbeispiel: Rechteck 11 × 8 mm wird nicht als 12 × 8 gemeldet', async () => {
    const page = await pageOf(11);
    const breit = rectsIn(page, { x: 19, y: 29, w: 14, h: 10 }).some(r => Math.abs(r.w - 12) <= TOL);

    expect(breit).toBe(false);
  });

  it('Farben: schwarze Füllung erscheint als #000000', async () => {
    const page = await pageOf(12);

    expect(colorsUsed(page)).toContain('#000000');
  });
});
