/**
 * Tabelle mit Raster zeichnen (T7b, @DR-035; im Endstand auch Finalrunde @DR-054 und Siegerehrung @DR-052): helle Flächen für Kopf,
 * Spalten und Zebra, das graue Raster, Akzentlinien zwischen den Runden, die kräftige Linie unter dem Kopf der Torschützenliste, das
 * Gruppenzeichen im Kopf und alle Texte in Lesereihenfolge. Das Modell hat alles gemessen; hier steht keine Rechnung.
 */
import type { jsPDF } from 'jspdf';
import { printColors } from '../../../design-tokens/print';
import { printCeremony } from '../../../design-tokens/print-endstand';
import { printRule, printTableGrid } from '../../../design-tokens/print-sheet';
import type { Segment, StandingsTableBlock } from '../model/types';
import type { PdfAccent } from '../pdfOptions';
import { drawFill, drawGroupMark, drawRuns } from './runs';
import { rgbOf, type Rgb } from './writeLine';

function drawSegments(doc: jsPDF, segments: readonly Segment[], width: number, color: Rgb): void {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  for (const segment of segments) {
    doc.line(segment.x1, segment.y1, segment.x2, segment.y2);
  }
}

export function drawStandings(doc: jsPDF, block: StandingsTableBlock, accent: PdfAccent): void {
  for (const fill of block.fills) {
    drawFill(doc, fill, accent);
  }
  drawSegments(doc, block.grid, printTableGrid.stroke, [...printTableGrid.color]);
  drawSegments(doc, block.accent ?? [], printRule.round, rgbOf(accent.line));
  drawSegments(doc, block.heavy ?? [], printCeremony.scorerHeadRule, [...printColors.ink]);
  if (block.group) {
    drawGroupMark(doc, block.group, accent);
  }
  drawRuns(doc, block.runs);
}
