/**
 * Striche des Spielplans (T7a, @DR-034): Schreiblinien und Trennstriche. Jede Linie ist ein einziger Strich (`doc.line`),
 * nie ein Rechteck; die Lage kommt fertig aus dem Seitenmodell.
 */
import type { jsPDF } from 'jspdf';
import { printColors } from '../../../design-tokens/print';
import { printHourRule, printRule, printWriteLine } from '../../../design-tokens/print-sheet';
import { hexToRgb } from '../../colorUtils';
import type { HLine, RuleLine, WriteLine } from '../model/types';
import type { PdfAccent } from '../pdfOptions';

export type Rgb = [number, number, number];

/** `#rrggbb` als Farbwerte für jsPDF. */
export function rgbOf(hex: string): Rgb {
  const { r, g, b } = hexToRgb(hex);
  return [r, g, b];
}

/** Ein einziger Strich der Stärke `width` in `color`. */
export function drawStroke(doc: jsPDF, line: HLine, width: number, color: Rgb): void {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(line.x1, line.y, line.x2, line.y);
}

/** Schreiblinien: dünner schwarzer Strich, kein Kasten. */
export function drawWriteLines(doc: jsPDF, lines: readonly WriteLine[]): void {
  for (const line of lines) {
    drawStroke(doc, line, printWriteLine.stroke, [...printColors.ink]);
  }
}

/** Trennstriche: Stunden-, Runden- und Kopflinie in Akzent, Spaltenkopf- und Fußlinie schwarz. */
export function drawRule(doc: jsPDF, rule: RuleLine, accent: PdfAccent): void {
  const ink: Rgb = [...printColors.ink];
  switch (rule.kind) {
    case 'hour': drawStroke(doc, rule, printHourRule.stroke, rgbOf(accent.line)); break;
    case 'round': drawStroke(doc, rule, printRule.round, rgbOf(accent.line)); break;
    case 'head': drawStroke(doc, rule, printRule.head, rgbOf(accent.line)); break;
    case 'tableHead': drawStroke(doc, rule, printRule.tableHead, ink); break;
    case 'foot': drawStroke(doc, rule, printRule.foot, ink); break;
  }
}
