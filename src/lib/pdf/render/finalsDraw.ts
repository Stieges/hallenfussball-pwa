/**
 * Finalrunde zeichnen (T7b, @DR-019, @DR-037): Spaltenkopf, je Runde Rundentrenner und Rundenname, dann die Zeilen wie die
 * Gruppenspiele (Zebra, Texte in Lesereihenfolge, Schreib- und Namenslinien). Die K.-o.-Zeilen darüber sind ein Textblock.
 */
import type { jsPDF } from 'jspdf';
import type { FinalsBlock, TextBlock } from '../model/types';
import type { PdfAccent } from '../pdfOptions';
import { drawRow } from './matchRowsDraw';
import { drawRuns } from './runs';
import { drawRule } from './writeLine';

export function drawText(doc: jsPDF, block: TextBlock): void {
  drawRuns(doc, block.runs);
}

export function drawFinals(doc: jsPDF, block: FinalsBlock, accent: PdfAccent): void {
  drawRuns(doc, block.head.labels);
  drawRule(doc, block.head.rule, accent);
  for (const round of block.rounds) {
    if (round.rule) {
      drawRule(doc, round.rule, accent);
    }
    drawRuns(doc, round.title);
    for (const row of round.rows) {
      drawRow(doc, row, accent);
    }
  }
}
