/**
 * Kurzkopf der Folgeseiten (B-28a3-3b, K3): Turniername und Altersklasse über dem Satzspiegel, dünne Linie.
 * Er gilt für jede Seite ab der zweiten, auch beim Umbruch von Gruppenspielen, Tabellen und Finalrunde.
 * Nur Zeichnen.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printGap, printStroke, printType } from '../../../design-tokens/print';
import type { PageGeometry } from '../layout';
import { PDF_FONT } from '../fonts';

/** Kurzkopf der Folgeseiten: Turniername und Altersklasse. */
export interface ShortHeadText {
  title: string;
  subtitle: string;
}

/** Zeichnet den Kurzkopf auf jede Seite ab der zweiten. Wird nach dem Satz aufgerufen, vor den Seitenzahlen. */
export function drawShortHeads(doc: jsPDF, geo: PageGeometry, head: ShortHeadText): void {
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page++) {
    doc.setPage(page);
    drawShortHead(doc, head, geo);
  }
}

function drawShortHead(doc: jsPDF, head: ShortHeadText, geo: PageGeometry): void {
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.setFontSize(printType.titleShort);
  doc.text(head.title, geo.left, geo.top + printGap.shortHeadTitleBaseline);
  doc.setFontSize(printType.subtitle);
  doc.text(head.subtitle, geo.left, geo.top + printGap.shortHeadSubBaseline);
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.shortHead);
  doc.line(geo.left, geo.top + printGap.shortHeadRule, geo.left + geo.contentWidth, geo.top + printGap.shortHeadRule);
}
