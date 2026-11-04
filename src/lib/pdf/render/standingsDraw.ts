/**
 * Gruppentabelle zeichnen (T7b, @DR-035): helle Flächen für Kopf und Zebra-Zeilen, in der Fassung ohne Ergebnisse das graue Raster,
 * das Gruppenzeichen im Kopf und alle Texte in Lesereihenfolge. Das Modell hat alles gemessen; hier steht keine Rechnung.
 */
import type { jsPDF } from 'jspdf';
import { printTableGrid } from '../../../design-tokens/print-sheet';
import type { StandingsTableBlock } from '../model/types';
import type { PdfAccent } from '../pdfOptions';
import { drawFill, drawGroupMark, drawRuns } from './runs';

export function drawStandings(doc: jsPDF, block: StandingsTableBlock, accent: PdfAccent): void {
  for (const fill of block.fills) {
    drawFill(doc, fill, accent);
  }
  doc.setDrawColor(...printTableGrid.color);
  doc.setLineWidth(printTableGrid.stroke);
  for (const segment of block.grid) {
    doc.line(segment.x1, segment.y1, segment.x2, segment.y2);
  }
  if (block.group) {
    drawGroupMark(doc, block.group, accent);
  }
  drawRuns(doc, block.runs);
}
