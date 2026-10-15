/**
 * Finalrunde: K.-o.-Zeilen über der Finalrunde (B-28a3-3b, @DR-015) und je Runde eine Überschrift und eine Tabelle
 * (B-28a3-4b Punkt 4): Achtelfinale, Viertelfinale, Halbfinale, Spiel um Platz 3 bzw. 5/7, Finale. Runden in der
 * Reihenfolge ihrer ersten Anstoßzeit, Spiele darin nach Anstoßzeit. Nur Zeichnen. Gemeinsame Tabellenoptionen und
 * Zellen-Helfer kommen aus `matchTables.ts`. Spielseiten über `sideLabel`. Ohne Schiedsrichter-Spalte.
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type Styles } from 'jspdf-autotable';
import type { ScheduledMatch } from '../../../core/generators';
import { printColors, printType, printMetrics, printGap, printColumns } from '../../../design-tokens/print';
import type { KnockoutRound } from '../../../types/tournament';
import { ascentMm, ensureSpace, type PageGeometry } from '../layout';
import { bracketRoundPerMatch } from '../koSlots';
import { sideLabel } from '../matchSides';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';
import { matchTableOptions, resultCell, sectionTitle } from './matchTables';

/** Überschrift einer Runde: eine Runde des Brackets oder ein Platzierungsspiel. */
export type FinalRoundKey = KnockoutRound | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';

export interface FinalRound {
  key: FinalRoundKey;
  /** Spiele der Runde, nach Anstoßzeit (bei gleicher Zeit nach Spielnummer). */
  matches: ScheduledMatch[];
}

const PLACEMENT_KEYS: readonly FinalRoundKey[] = ['thirdPlace', 'fifthSixth', 'seventhEighth'];

/** Zeitfolge: Anstoßzeit, dann Spielnummer. */
function byKickoff(a: ScheduledMatch, b: ScheduledMatch): number {
  return a.startTime.getTime() - b.startTime.getTime() || a.matchNumber - b.matchNumber;
}

/**
 * Finalspiele in Runden gegliedert. Jede Runde kommt einmal vor, in der Reihenfolge ihrer ersten Anstoßzeit. Die
 * Runde eines Bracket-Spiels kommt aus `bracketRoundPerMatch` (Phase oder Bracket-Größe).
 */
export function finalRounds(finals: readonly ScheduledMatch[]): FinalRound[] {
  const bracket = finals.filter(m => m.finalType !== 'final' && !PLACEMENT_KEYS.includes(m.finalType as FinalRoundKey));
  const rounds = bracketRoundPerMatch(bracket);
  const bracketRound = new Map<ScheduledMatch, KnockoutRound>(bracket.map((match, index) => [match, rounds[index]]));

  const groups = new Map<FinalRoundKey, ScheduledMatch[]>();
  for (const match of finals) {
    const key: FinalRoundKey = match.finalType === 'final'
      ? 'final'
      : (match.finalType as FinalRoundKey | undefined) ?? bracketRound.get(match) ?? 'roundOf16';
    groups.set(key, [...(groups.get(key) ?? []), match]);
  }

  return Array.from(groups, ([key, matches]) => ({ key, matches: [...matches].sort(byKickoff) }))
    .sort((a, b) => byKickoff(a.matches[0], b.matches[0]));
}

/** Überschrift einer Runde über die Übersetzungen. */
function roundTitle(key: FinalRoundKey, t: PdfTexts): string {
  switch (key) {
    case 'thirdPlace':
      return t.thirdPlace;
    case 'fifthSixth':
      return t.fifthSixth;
    case 'seventhEighth':
      return t.seventhEighth;
    default:
      return t.phaseTitle(key, key);
  }
}

/**
 * K.-o.-Zeilen über der Finalrunde, je Zeile umbrochen. Rückgabe: nächste freie Grundlinie.
 */
function drawKoLines(doc: jsPDF, lines: string[], geo: PageGeometry, yPos: number): number {
  if (lines.length === 0) {
    return yPos;
  }
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'normal');
  doc.setFontSize(printType.note);
  for (const line of lines) {
    const wrapped = doc.splitTextToSize(line, geo.contentWidth) as string[];
    const height = wrapped.length * printMetrics.koLineAdvance;
    yPos = ensureSpace(doc, yPos, height, geo);
    wrapped.forEach((part, index) => {
      doc.text(part, geo.left, yPos + index * printMetrics.koLineAdvance);
    });
    yPos += height;
  }
  return yPos + printGap.sectionGap;
}

/**
 * Finalrunde: K.-o.-Zeilen, dann je Runde eine Überschrift (h2) und eine Tabelle.
 */
export function renderFinalsSection(
  doc: jsPDF,
  finals: ScheduledMatch[],
  t: PdfTexts,
  numberOfFields: number,
  includeScores: boolean,
  geo: PageGeometry,
  yPos: number,
  koLines: string[]
): number {
  yPos = drawKoLines(doc, koLines, geo, yPos);
  for (const round of finalRounds(finals)) {
    yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);
    yPos = sectionTitle(doc, roundTitle(round.key, t), geo, yPos, printType.h2);
    yPos = renderFinalsTable(doc, round.matches, t, numberOfFields, includeScores, geo, yPos);
  }
  return yPos;
}

/** Eine Finaltabelle einer Runde. */
function renderFinalsTable(
  doc: jsPDF,
  matches: ScheduledMatch[],
  t: PdfTexts,
  numberOfFields: number,
  includeScores: boolean,
  geo: PageGeometry,
  yPos: number
): number {
  const showFieldColumn = numberOfFields > 1;

  // Kopfzeile
  const headerRow: CellInput[] = [t.nr, t.timeHeader];
  if (showFieldColumn) {headerRow.push(t.field);}
  headerRow.push(t.home, t.result, t.away);
  const headers: RowInput[] = [headerRow];

  // Zeilen
  const data: RowInput[] = matches.map(match => {
    const row: CellInput[] = [match.matchNumber.toString(), match.time];
    if (showFieldColumn) {row.push(match.field.toString());}

    row.push(sideLabel(match, 'A'), resultCell(match, includeScores), sideLabel(match, 'B'));
    return row;
  });

  // Spaltenstile mit und ohne Feld-Spalte
  const columnStyles: Record<number, Partial<Styles>> = showFieldColumn
    ? {
        0: { halign: 'center', cellWidth: printColumns.finals.nr, fontSize: printType.nr, cellPadding: { top: printGap.bodyPadV, bottom: printGap.bodyPadV, left: printGap.nrPad, right: printGap.nrPad } },
        1: { halign: 'center', cellWidth: printColumns.finals.time, fontSize: printType.time, fontStyle: 'bold' },
        2: { halign: 'center', cellWidth: printColumns.finals.field },
        3: { halign: 'right' },                                      // Heim endet am Ergebnis
        4: { halign: 'center', cellWidth: printColumns.finals.result, fontSize: printType.result, fontStyle: 'bold' },
        5: { halign: 'left' },                                       // Gast
      }
    : {
        0: { halign: 'center', cellWidth: printColumns.finals.nr, fontSize: printType.nr, cellPadding: { top: printGap.bodyPadV, bottom: printGap.bodyPadV, left: printGap.nrPad, right: printGap.nrPad } },
        1: { halign: 'center', cellWidth: printColumns.finals.time, fontSize: printType.time, fontStyle: 'bold' },
        2: { halign: 'right' },                                      // Heim endet am Ergebnis
        3: { halign: 'center', cellWidth: printColumns.finals.result, fontSize: printType.result, fontStyle: 'bold' },
        4: { halign: 'left' },                                       // Gast
      };

  autoTable(doc, matchTableOptions(geo, yPos, headers, data, columnStyles));

  // Rückgabe: Grundlinie der nächsten Überschrift (Runde oder Platzierung), B-28a3-4F F3
  yPos = tableEndY(doc) + printGap.sectionGap + ascentMm(printType.h2);
  return yPos;
}
