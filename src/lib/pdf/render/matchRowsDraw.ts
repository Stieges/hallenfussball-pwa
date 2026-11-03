/**
 * Spieltabelle zeichnen (T7a, @DR-004, @DR-019, @DR-034): Spaltenkopf, Zebra-Flächen, Stundentrenner, Texte jeder Zeile in
 * Lesereihenfolge (Nummer, Zeit, Gruppe, Heim, Ergebnis, Gast, Schiedsrichter) und die Schreiblinien. Das Modell hat alles
 * gemessen; hier steht keine Rechnung.
 */
import type { jsPDF } from 'jspdf';
import type { MatchRowModel, MatchRowsBlock, TextRun } from '../model/types';
import type { PdfAccent } from '../pdfOptions';
import { drawFill, drawGroupMark, drawRuns } from './runs';
import { drawRule, drawWriteLines } from './writeLine';

/** Texte einer Zeile als eine geschlossene Folge: Nummer, Zeit, Feld, Gruppe, Heim, Ergebnis, Gast, Schiedsrichter (@DR-039). */
export function rowRuns(row: MatchRowModel): TextRun[] {
  return [row.nr, row.time, ...(row.field ? [row.field] : []), ...(row.group ? [row.group.text] : []), ...row.home.runs, ...row.cell.runs, ...row.away.runs, ...(row.referee ?? [])];
}

export function drawRow(doc: jsPDF, row: MatchRowModel, accent: PdfAccent): void {
  if (row.zebra) {
    drawFill(doc, { kind: 'zebra', ...row.box }, accent);
  }
  if (row.ruleAbove) {
    drawRule(doc, row.ruleAbove, accent);
  }
  if (row.group) {
    drawGroupMark(doc, row.group, accent);
  }
  drawRuns(doc, rowRuns(row));
  drawWriteLines(doc, row.lines);
}

/** Zeichnet einen Block Gruppenspiele mit seinem Spaltenkopf. */
export function drawMatchRows(doc: jsPDF, block: MatchRowsBlock, accent: PdfAccent): void {
  drawRuns(doc, block.head.labels);
  drawRule(doc, block.head.rule, accent);
  for (const row of block.rows) {
    drawRow(doc, row, accent);
  }
}
