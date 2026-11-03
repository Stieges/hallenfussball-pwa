/**
 * Strafstoßschießen um Platz 1 zeichnen (T7b, @DR-036): Überschrift, Beschriftungen und die vier Schreiblinien, ohne Kasten.
 */
import type { jsPDF } from 'jspdf';
import type { ShootoutBlock } from '../model/types';
import { drawRuns } from './runs';
import { drawWriteLines } from './writeLine';

export function drawShootout(doc: jsPDF, block: ShootoutBlock): void {
  drawRuns(doc, block.runs);
  drawWriteLines(doc, block.lines);
}
