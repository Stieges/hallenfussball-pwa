/**
 * Platzierung zeichnen (T7b, @DR-005, @DR-009): Überschrift, Satz, Nummern bzw. Namen und je Platz eine Schreiblinie.
 */
import type { jsPDF } from 'jspdf';
import type { RankingBlock } from '../model/types';
import { drawRuns } from './runs';
import { drawWriteLines } from './writeLine';

export function drawRanking(doc: jsPDF, block: RankingBlock): void {
  drawRuns(doc, block.runs);
  drawWriteLines(doc, block.lines);
}
