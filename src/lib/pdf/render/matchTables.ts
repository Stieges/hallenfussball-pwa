/**
 * Spieltabellen der Gruppenphase. Nur Zeichnen. Die Finalrunde steht in `finalsTables.ts`.
 * Spielseiten kommen ausschließlich über `sideLabel` (Ein-Stellen-Regel).
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type Styles, type UserOptions } from 'jspdf-autotable';
import type { GeneratedSchedule, ScheduledMatch } from '../../../core/generators';
import type { RefereeConfig } from '../../../types/tournament';
import { printColors, printFonts, printMetrics, printSpacing, printTableColumns } from '../../../design-tokens/print';
import { getGroupShortCode } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import { sideLabel } from '../matchSides';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

/** Ergebnis-Platzhalter ohne Spielstand (Textzelle, wird in B-28a3 ersetzt). */
const RESULT_PLACEHOLDER = '     :     ';

type GeneratedTournament = GeneratedSchedule['tournament'];

export function hasReferees(refereeConfig: RefereeConfig | undefined): boolean {
  return Boolean(refereeConfig && refereeConfig.mode !== 'none');
}

export function resultCell(match: ScheduledMatch, includeScores: boolean): string {
  return includeScores && (match.scoreA !== undefined && match.scoreB !== undefined)
    ? `${match.scoreA} : ${match.scoreB}`
    : RESULT_PLACEHOLDER;
}

/** Gemeinsame Tabellenoptionen für Spieltabellen. Nur die Spaltenstile unterscheiden sich. */
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
    margin: {
      left: geo.left,
      right: geo.right,
    },
    styles: {
      font: PDF_FONT.family,
      fontSize: printFonts.table,
      cellPadding: printMetrics.tableCellPadding,
      lineColor: [...printColors.border],
      lineWidth: printMetrics.tableLineWidth,
    },
    headStyles: {
      fillColor: [...printColors.headBg],
      textColor: [...printColors.textMain],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles,
  };
}

/** Abschnittstitel mit Unterstrich-Abstand (Gruppenphase, Finalrunde). */
export function sectionTitle(doc: jsPDF, text: string, geo: PageGeometry, yPos: number, size: number): number {
  doc.setFontSize(size);
  doc.setTextColor(...printColors.textMain);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(text, geo.left, yPos);
  return yPos + printMetrics.sectionTitleUnderline;
}

/**
 * Gruppenphase: eine Tabelle, Feld- und Gruppen-Spalte nur wenn nötig.
 */
export function renderGroupStage(
  doc: jsPDF,
  matches: ScheduledMatch[],
  t: PdfTexts,
  refereeConfig: RefereeConfig | undefined,
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

  yPos = sectionTitle(doc, t.groupStage, geo, yPos, printFonts.sectionTitle);

  // Feld-Spalte nur bei mehr als einem Feld
  const showFieldColumn = numberOfFields > 1;
  const withReferee = hasReferees(refereeConfig);

  // Kopfzeile
  const headerRow: CellInput[] = [t.nr, t.timeHeader];
  if (showFieldColumn) {headerRow.push(t.field);}
  if (hasMultipleGroups) {headerRow.push(t.group);}
  headerRow.push(t.home, t.result, t.away);
  if (withReferee) {
    headerRow.push(t.referee);
  }
  const headers: RowInput[] = [headerRow];

  // Zeilen
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [match.matchNumber.toString(), match.time];
    if (showFieldColumn) {row.push(match.field.toString());}
    if (hasMultipleGroups) {row.push(match.group ? getGroupShortCode(match.group, tournament) : '-');}

    row.push(sideLabel(match, 'A'), resultCell(match, includeScores), sideLabel(match, 'B'));

    if (withReferee) {
      row.push(match.referee ? t.refereeNumber(match.referee) : '-');
    }

    return row;
  });

  // Spaltenstile in Reihenfolge der Spalten
  const columnStyles = (() => {
    let colIndex = 0;
    const styles: Record<number, Partial<Styles>> = {};

    styles[colIndex++] = { halign: 'center', cellWidth: printTableColumns.nr };
    styles[colIndex++] = { halign: 'center', cellWidth: printTableColumns.time };
    if (showFieldColumn) {styles[colIndex++] = { halign: 'center', cellWidth: printTableColumns.field };}
    if (hasMultipleGroups) {styles[colIndex++] = { halign: 'center', cellWidth: printTableColumns.group };}
    styles[colIndex++] = { halign: 'left' }; // Heim
    styles[colIndex++] = { halign: 'center', cellWidth: printTableColumns.result };
    styles[colIndex++] = { halign: 'left' }; // Gast
    if (withReferee) {
      styles[colIndex] = { halign: 'center', cellWidth: printTableColumns.referee };
    }

    return styles;
  })();

  autoTable(doc, matchTableOptions(geo, yPos, headers, data, columnStyles));

  yPos = tableEndY(doc) + printSpacing.sectionGap;
  return yPos;
}
