/**
 * Hinweiszeile unter der Meta-Box. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import { printColors, printType, printMetrics, printGap } from '../../../design-tokens/print';
import { ensureSpace, type PageGeometry } from '../layout';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

export function renderHints(doc: jsPDF, t: PdfTexts, geo: PageGeometry, yPos: number): number {
  yPos = ensureSpace(doc, yPos, printMetrics.hintMinSpace, geo);

  // Nur der Ergebnis-Hinweis (ohne SR-Erklärung)
  doc.setFontSize(printType.note);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'normal'); // Kursiv gibt es nicht eingebettet
  doc.text(t.hintResults, geo.left, yPos);
  yPos += printMetrics.hintAdvance;

  yPos += printGap.h2Bottom;
  return yPos;
}
