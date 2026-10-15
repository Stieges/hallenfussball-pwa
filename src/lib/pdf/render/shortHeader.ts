/**
 * Kurzkopf der Folgeseiten (B-28a3-3b, K3, Fixrunde W1): Turniername und Altersklasse über dem Satzspiegel, dünne
 * Linie. Er gilt für jede Seite ab der zweiten, auch beim Umbruch von Gruppenspielen, Tabellen und Finalrunde.
 * Der Titel bricht innerhalb der Satzbreite um, höchstens zwei Zeilen, die zweite Zeile wird bei Bedarf gekürzt.
 * Nur Zeichnen; die Zeilen misst `shortHeadTitleLines` vor dem Seitenmaß.
 */
import type { jsPDF } from 'jspdf';
import { printColors, printGap, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import type { PageGeometry } from '../layout';
import { fontOf } from '../fonts';
import { clipToWidth } from './textFit';

/**
 * Kurzkopf der Folgeseiten: Titelzeilen (umbrochen) und Untertitel je Seite. Der Untertitel nennt Altersklasse, Datum
 * und den Abschnitt, der oben auf der Seite steht (G8), und ist erst nach dem Satz bekannt.
 */
export interface ShortHeadText {
  titleLines: string[];
  subtitleFor: (page: number) => string;
}

/** Höchstens so viele Titelzeilen; mehr wird gekürzt. */
const MAX_TITLE_LINES = 2;

/**
 * Titelzeilen des Kurzkopfs innerhalb der Satzbreite, höchstens zwei. Ist der Titel länger, endet die zweite Zeile mit „…“.
 */
export function shortHeadTitleLines(doc: jsPDF, title: string, width: number): string[] {
  doc.setFont(fontOf(doc), 'bold');
  doc.setFontSize(printType.titleShort);
  const lines = doc.splitTextToSize(title, width) as string[];
  if (lines.length <= MAX_TITLE_LINES) {
    return lines;
  }
  let last = lines[MAX_TITLE_LINES - 1] ?? '';
  while (last.length > 0 && doc.getTextWidth(`${last}…`) > width) {
    last = last.slice(0, -1);
  }
  return [...lines.slice(0, MAX_TITLE_LINES - 1), `${last.trimEnd()}…`];
}

/** Zeichnet den Kurzkopf auf jede Seite ab der zweiten. Wird nach dem Satz aufgerufen, vor den Seitenzahlen. */
export function drawShortHeads(doc: jsPDF, geo: PageGeometry, head: ShortHeadText): void {
  const total = doc.getNumberOfPages();
  for (let page = 2; page <= total; page++) {
    doc.setPage(page);
    drawShortHead(doc, head, geo, head.subtitleFor(page));
  }
}

function drawShortHead(doc: jsPDF, head: ShortHeadText, geo: PageGeometry, subtitle: string): void {
  const extra = (head.titleLines.length - 1) * printMetrics.shortTitleAdvance;
  doc.setTextColor(...printColors.ink);
  doc.setFont(fontOf(doc), 'bold');
  doc.setFontSize(printType.titleShort);
  head.titleLines.forEach((line, index) => {
    doc.text(line, geo.left, geo.top + printGap.shortHeadTitleBaseline + index * printMetrics.shortTitleAdvance);
  });
  doc.setFontSize(printType.subtitle);
  doc.text(clipToWidth(doc, subtitle, geo.contentWidth), geo.left, geo.top + printGap.shortHeadSubBaseline + extra);
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.shortHead);
  doc.line(geo.left, geo.top + printGap.shortHeadRule + extra, geo.left + geo.contentWidth, geo.top + printGap.shortHeadRule + extra);
}
