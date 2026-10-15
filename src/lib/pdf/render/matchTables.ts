/**
 * Spieltabellen der Gruppenphase. Nur Zeichnen. Die Finalrunde steht in `finalsTables.ts`.
 * Spielseiten kommen ausschließlich über `sideLabel` (Ein-Stellen-Regel).
 *
 * Überlauf: Die Tabelle läuft auf Folgeseiten weiter, dort steht der Spaltenkopf (autoTable `showHead: 'everyPage'`).
 * Der Kurzkopf kommt für jede Folgeseite zentral aus `shortHeader.ts` (B-28a3-3b).
 * Ohne Schiedsrichter-Spalte (B-28a3-3b: Schiedsrichter im PDF nach dem MVP).
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type Styles, type UserOptions } from 'jspdf-autotable';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import { printColors, printGap, printMetrics, printStroke, printType, printColumns } from '../../../design-tokens/print';
import { getGroupShortCode } from '../../../utils/displayNames';
import { ensureSpace, tableMargins, type PageGeometry } from '../layout';
import { sideLabel } from '../matchSides';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

/** Ergebnis-Platzhalter ohne Spielstand (Textzelle, wird in B-28a3-5 ersetzt). */
const RESULT_PLACEHOLDER = '     :     ';

type GeneratedTournament = GeneratedSchedule['tournament'];

export function resultCell(match: ScheduledMatch, includeScores: boolean): string {
  return includeScores && (match.scoreA !== undefined && match.scoreB !== undefined)
    ? `${match.scoreA} : ${match.scoreB}`
    : RESULT_PLACEHOLDER;
}

/** Innenabstand als autoTable-Objekt aus Vertikal- und Horizontalwert. */
function pad(vertical: number, horizontal: number): { top: number; bottom: number; left: number; right: number } {
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
  columnStyles: Record<number, Partial<Styles>>
): UserOptions {
  return {
    startY,
    head,
    body,
    margin: tableMargins(geo),
    showHead: 'everyPage',
    tableLineColor: [...printColors.ink],
    alternateRowStyles: { fillColor: [...printColors.paper], textColor: [...printColors.ink] },
    styles: {
      font: PDF_FONT.family,
      fontSize: printType.body,
      cellPadding: pad(printGap.bodyPadV, printGap.bodyPadH),
      textColor: [...printColors.ink],
      lineColor: [...printColors.ink],
      lineWidth: printStroke.row,
    },
    headStyles: {
      font: PDF_FONT.family,
      fontSize: printType.head,
      cellPadding: pad(printGap.headPadV, printGap.headPadH),
      fillColor: [...printColors.tint],
      textColor: [...printColors.ink],
      lineColor: [...printColors.ink],
      lineWidth: printStroke.thead,
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

/**
 * Gruppenphase: eine Tabelle, Feld- und Gruppen-Spalte nur wenn nötig. Läuft sie über die Seite, kommt die
 * Folgeseite mit wiederholtem Spaltenkopf (Kurzkopf: `shortHeader.ts`).
 */
export function renderGroupStage(
  doc: jsPDF,
  matches: ScheduledMatch[],
  t: PdfTexts,
  numberOfFields: number,
  includeScores: boolean,
  geo: PageGeometry,
  yPos: number,
  tournament: GeneratedTournament
): number {
  yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);

  // Gibt es mehr als eine Gruppe?
  const uniqueGroups = new Set(matches.map(m => m.group).filter(Boolean));
  const hasMultipleGroups = uniqueGroups.size > 1;

  yPos = sectionTitle(doc, t.groupStage, geo, yPos, printType.h2);

  // Feld-Spalte nur bei mehr als einem Feld
  const showFieldColumn = numberOfFields > 1;

  // Kopfzeile
  const headerRow: CellInput[] = [t.nr, t.timeHeader];
  if (showFieldColumn) {headerRow.push(t.field);}
  if (hasMultipleGroups) {headerRow.push(t.group);}
  headerRow.push(t.home, t.result, t.away);
  const headers: RowInput[] = [headerRow];

  // Zeilen
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [match.matchNumber.toString(), match.time];
    if (showFieldColumn) {row.push(match.field.toString());}
    if (hasMultipleGroups) {row.push(match.group ? getGroupShortCode(match.group, tournament) : '-');}

    row.push(sideLabel(match, 'A'), resultCell(match, includeScores), sideLabel(match, 'B'));
    return row;
  });

  // Spaltenstile in Reihenfolge der Spalten
  const columnStyles = (() => {
    let colIndex = 0;
    const styles: Record<number, Partial<Styles>> = {};

    styles[colIndex++] = { halign: 'center', cellWidth: printColumns.match.nr, fontSize: printType.nr, cellPadding: pad(printGap.bodyPadV, printGap.nrPad) };
    styles[colIndex++] = { halign: 'center', cellWidth: printColumns.match.time, fontSize: printType.time, fontStyle: 'bold' };
    if (showFieldColumn) {styles[colIndex++] = { halign: 'center', cellWidth: printColumns.match.field };}
    if (hasMultipleGroups) {styles[colIndex++] = { halign: 'center', cellWidth: printColumns.match.group, fontStyle: 'bold' };}
    styles[colIndex++] = { halign: 'left' }; // Heim
    styles[colIndex++] = { halign: 'center', cellWidth: printColumns.match.result, fontSize: printType.result, fontStyle: 'bold' };
    styles[colIndex] = { halign: 'left' }; // Gast

    return styles;
  })();

  autoTable(doc, matchTableOptions(geo, yPos, headers, data, columnStyles));

  yPos = tableEndY(doc) + printGap.sectionGap;
  return yPos;
}
