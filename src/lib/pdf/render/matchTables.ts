/**
 * Gemeinsame Optionen der Spieltabellen (Gruppenphase in `groupTables.ts`, Finalrunde in `finalsTables.ts`) und der
 * Abschnittstitel. Nur Zeichnen.
 *
 * Überlauf: Die Tabelle läuft auf Folgeseiten weiter, dort steht der Spaltenkopf (autoTable `showHead: 'everyPage'`).
 * Der Kurzkopf kommt für jede Folgeseite zentral aus `shortHeader.ts` (B-28a3-3b). Keine Zeile bricht über eine
 * Seitengrenze (`rowPageBreak: 'avoid'`, @BM-022). Linien: nur waagerechte Zeilenlinien (B-28 C1, G1).
 */
import type jsPDF from 'jspdf';
import type { RowInput, Styles, UserOptions } from 'jspdf-autotable';
import { printColors, printGap, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { tableMargins, type PageGeometry } from '../layout';
import { PDF_FONT } from '../fonts';

/** Innenabstand als autoTable-Objekt aus Vertikal- und Horizontalwert. */
export function pad(vertical: number, horizontal: number): { top: number; bottom: number; left: number; right: number } {
  return { top: vertical, bottom: vertical, left: horizontal, right: horizontal };
}

/**
 * Gemeinsame Tabellenoptionen für Spieltabellen. Nur die Spaltenstile unterscheiden sich. Folgeseiten beginnen
 * unter dem Kurzkopf (`tableMargins`).
 */
export function matchTableOptions(
  geo: PageGeometry,
  startY: number,
  head: RowInput[],
  body: RowInput[],
  columnStyles: Record<number, Partial<Styles>>,
  padV: number = printGap.bodyPadV
): UserOptions {
  return {
    startY,
    head,
    body,
    margin: tableMargins(geo),
    showHead: 'everyPage',
    rowPageBreak: 'avoid',
    tableLineColor: [...printColors.ink],
    // Keine Füllung im Body: eine weiße Zelle übermalte die untere Hälfte der Zeilenlinie darüber (C1-F S1)
    alternateRowStyles: { fillColor: false, textColor: [...printColors.ink] },
    styles: {
      font: PDF_FONT.family,
      fontSize: printType.body,
      cellPadding: pad(padV, printGap.bodyPadH),
      fillColor: false,
      textColor: [...printColors.ink],
      lineColor: [...printColors.ink],
      valign: 'middle',
      // Zeilenlinien wie v7.2: nur unten, kein Vollgitter (G1)
      lineWidth: { bottom: printStroke.row },
    },
    headStyles: {
      font: PDF_FONT.family,
      fontSize: printType.head,
      cellPadding: pad(printGap.headPadV, printGap.headPadH),
      fillColor: [...printColors.tint],
      textColor: [...printColors.ink],
      lineColor: [...printColors.ink],
      lineWidth: { top: printStroke.thead, bottom: printStroke.thead },
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles,
  };
}

/** Abschnittstitel mit Unterstrich-Abstand (Gruppenphase, Finalrunde). */
export function sectionTitle(doc: jsPDF, text: string, geo: PageGeometry, yPos: number, size: number): number {
  doc.setFontSize(size);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(text, geo.left, yPos);
  return yPos + printMetrics.sectionTitleUnderline;
}
