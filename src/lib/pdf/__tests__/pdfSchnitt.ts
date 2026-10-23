/**
 * Fett oder normal aus dem fertigen PDF (B-28a3-3b Punkt 5). pdfjs liefert für beide Schnitte denselben Schriftnamen,
 * deshalb wird jedes Textstück mit beiden Schnitten neu gemessen: der Schnitt, dessen Breite zur gelesenen Breite passt,
 * ist der richtige. Nur für Tests.
 */
import { jsPDF } from 'jspdf';
import { PDF_FONT, registerPdfFonts } from '../fonts';
import type { LayoutText } from './pdfjsLayout';

/** Ordnet jedem Textstück zu, ob es im Schnitt „bold“ steht. */
export async function fettMap(texts: LayoutText[]): Promise<Map<LayoutText, boolean>> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await registerPdfFonts(doc);
  const map = new Map<LayoutText, boolean>();
  for (const t of texts) {
    const text = t.str.trim();
    doc.setFontSize(t.size);
    doc.setFont(PDF_FONT.family, 'bold');
    const breiteFett = doc.getTextWidth(text);
    doc.setFont(PDF_FONT.family, 'normal');
    const breiteNormal = doc.getTextWidth(text);
    map.set(t, Math.abs(breiteFett - t.w) < Math.abs(breiteNormal - t.w));
  }
  return map;
}
