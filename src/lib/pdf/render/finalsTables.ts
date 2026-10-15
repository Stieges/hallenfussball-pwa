/**
 * Finalrunde: Phasentitel, Platzierungsspiele mit Untertitel, je Phase und Finaltyp eine Tabelle. Nur Zeichnen.
 * Gemeinsame Tabellenoptionen und Zellen-Helfer kommen aus `matchTables.ts`. Spielseiten über `sideLabel`.
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type Styles } from 'jspdf-autotable';
import type { ScheduledMatch } from '../../../core/generators';
import type { RefereeConfig } from '../../../types/tournament';
import { printColors, printType, printMetrics, printGap, printColumns } from '../../../design-tokens/print';
import { ensureSpace, type PageGeometry } from '../layout';
import { sideLabel } from '../matchSides';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';
import { hasReferees, matchTableOptions, resultCell, sectionTitle } from './matchTables';

/** Untertitel einer Platzierungsrunde, sonst keiner. */
function getSubtitleForFinalType(finalType: string | undefined, t: PdfTexts): string | undefined {
  if (!finalType) {return undefined;}

  switch (finalType) {
    case 'thirdPlace':
      return t.thirdPlace;
    case 'fifthSixth':
      return t.fifthSixth;
    case 'seventhEighth':
      return t.seventhEighth;
    default:
      return undefined;
  }
}

/**
 * Finalrunde: je Phase ein Titel, je Gruppe aufeinanderfolgender Spiele mit gleichem Finaltyp eine Tabelle.
 */
export function renderFinalsSection(
  doc: jsPDF,
  phases: Array<{ name: string; label: string; matches: ScheduledMatch[] }>,
  t: PdfTexts,
  refereeConfig: RefereeConfig | undefined,
  numberOfFields: number,
  includeScores: boolean,
  geo: PageGeometry,
  yPos: number
): number {
  phases.forEach(phase => {
    yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);

    // Phasentitel
    yPos = sectionTitle(doc, t.phaseTitle(phase.name, phase.label), geo, yPos, printType.h2);

    // Nach Spielnummer, damit die Reihenfolge des Plans bleibt
    const sortedMatches = [...phase.matches].sort((a, b) => a.matchNumber - b.matchNumber);

    // Aufeinanderfolgende Spiele mit gleichem Finaltyp zusammenfassen
    const matchGroups: Array<{ matches: ScheduledMatch[]; subtitle?: string }> = [];
    let currentGroup: ScheduledMatch[] = [];
    let currentFinalType: string | undefined = undefined;

    sortedMatches.forEach((match, index) => {
      if (match.finalType !== currentFinalType) {
        // Neue Gruppe beginnen
        if (currentGroup.length > 0) {
          matchGroups.push({
            matches: currentGroup,
            subtitle: getSubtitleForFinalType(currentFinalType, t),
          });
        }
        currentGroup = [match];
        currentFinalType = match.finalType;
      } else {
        currentGroup.push(match);
      }

      // Letzte Gruppe abschließen
      if (index === sortedMatches.length - 1 && currentGroup.length > 0) {
        matchGroups.push({
          matches: currentGroup,
          subtitle: getSubtitleForFinalType(currentFinalType, t),
        });
      }
    });

    // Alle Gruppen zeichnen
    matchGroups.forEach(group => {
      yPos = renderFinalsTable(doc, group.matches, t, refereeConfig, numberOfFields, includeScores, geo, yPos, group.subtitle);
    });
  });

  return yPos;
}

/** Eine Finaltabelle, optional mit Untertitel. */
function renderFinalsTable(
  doc: jsPDF,
  matches: ScheduledMatch[],
  t: PdfTexts,
  refereeConfig: RefereeConfig | undefined,
  numberOfFields: number,
  includeScores: boolean,
  geo: PageGeometry,
  yPos: number,
  subtitle?: string
): number {
  const showFieldColumn = numberOfFields > 1;
  const withReferee = hasReferees(refereeConfig);

  // Untertitel für Platzierungsspiele
  if (subtitle) {
    yPos = ensureSpace(doc, yPos, printMetrics.finalsSubtitleMinSpace, geo);
    doc.setFontSize(printType.body);
    doc.setTextColor(...printColors.ink);
    doc.setFont(PDF_FONT.family, 'bold');
    doc.text(subtitle, geo.left, yPos);
    yPos += printMetrics.finalsSubtitleAdvance;
  }

  // Kopfzeile
  const headerRow: CellInput[] = [t.nr, t.timeHeader];
  if (showFieldColumn) {headerRow.push(t.field);}
  headerRow.push(t.home, t.result, t.away);
  if (withReferee) {
    headerRow.push(t.referee);
  }
  const headers: RowInput[] = [headerRow];

  // Zeilen
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [match.matchNumber.toString(), match.time];
    if (showFieldColumn) {row.push(match.field.toString());}

    row.push(sideLabel(match, 'A'), resultCell(match, includeScores), sideLabel(match, 'B'));

    if (withReferee) {
      row.push(match.referee ? t.refereeNumber(match.referee) : '-');
    }

    return row;
  });

  // Spaltenstile mit und ohne Feld-Spalte
  const columnStyles: Record<number, Partial<Styles>> = showFieldColumn
    ? {
        0: { halign: 'center', cellWidth: printColumns.finals.nr, fontSize: printType.nr, cellPadding: { top: printGap.bodyPadV, bottom: printGap.bodyPadV, left: printGap.nrPad, right: printGap.nrPad } },
        1: { halign: 'center', cellWidth: printColumns.finals.time, fontSize: printType.time, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: printColumns.finals.field },
        3: { halign: 'left' },                                       // Heim
        4: { halign: 'center', cellWidth: printColumns.finals.result, fontSize: printType.result, fontStyle: 'bold' },
        5: { halign: 'left' },                                       // Gast
      }
    : {
        0: { halign: 'center', cellWidth: printColumns.finals.nr, fontSize: printType.nr, cellPadding: { top: printGap.bodyPadV, bottom: printGap.bodyPadV, left: printGap.nrPad, right: printGap.nrPad } },
        1: { halign: 'center', cellWidth: printColumns.finals.time, fontSize: printType.time, fontStyle: 'bold' },
        2: { halign: 'left' },                                       // Heim
        3: { halign: 'center', cellWidth: printColumns.finals.result, fontSize: printType.result, fontStyle: 'bold' },
        4: { halign: 'left' },                                       // Gast
      };
  if (withReferee) {
    columnStyles[showFieldColumn ? 6 : 5] = { halign: 'center', cellWidth: printColumns.finals.referee };
  }

  autoTable(doc, matchTableOptions(geo, yPos, headers, data, columnStyles));

  yPos = tableEndY(doc) + printGap.sectionGap;
  return yPos;
}
