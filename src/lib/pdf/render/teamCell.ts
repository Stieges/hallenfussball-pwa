/**
 * Teamzelle der Finalrunde in der Fassung zum Ausfüllen (B-28 C6, @DR-005, @BM-014): die Herkunft des Platzes steht
 * klein über einer Schreiblinie, das Team trägt der Veranstalter von Hand ein. Die Geometrie ist rein
 * (`teamCellLayout`), gezeichnet wird in `drawTeamCell`. Heim endet am Ergebnis (rechtsbündig), Gast beginnt dort (linksbündig).
 * Maße nur aus den Druck-Tokens.
 */
import type jsPDF from 'jspdf';
import { printBox, printColors, printStroke, printType } from '../../../design-tokens/print';
import { ascentMm } from '../layout';
import type { Rect } from '../scoreLayout';
import { fontOf } from '../fonts';

export type TeamSide = 'home' | 'away';

/** Zeilen der Herkunft (unterste zuerst gezeichnet), Grundlinien und die Schreiblinie in mm. */
export interface TeamCellLayout {
  line: { x1: number; x2: number; y: number };
  align: 'left' | 'right';
  /** x, an dem der Text ausgerichtet wird. */
  textX: number;
  /** Grundlinie der untersten Textzeile. */
  baseline: number;
}

/** Mindesthöhe der Zelle: Innenabstand oben, Herkunft, Platz zum Schreiben bis zur Linie, Abstand der Linie zur Unterkante. */
export function teamCellMinHeight(padV: number): number {
  return padV + ascentMm(printType.origin) + printBox.writeSpace + printBox.writeLineInset;
}

/**
 * Linie und Textanker einer Teamzelle. `padH` links und rechts, `padV` oben: die Herkunft sitzt an der Oberkante der
 * Zelle, die Linie unten; dazwischen bleiben mindestens `printBox.writeSpace` zum Schreiben.
 */
export function teamCellLayout(cell: Rect, side: TeamSide, padH: number, padV: number): TeamCellLayout {
  const lineY = cell.y + cell.h - printBox.writeLineInset;
  const x1 = cell.x + padH;
  const x2 = cell.x + cell.w - padH;
  return {
    line: { x1, x2, y: lineY },
    align: side === 'home' ? 'right' : 'left',
    textX: side === 'home' ? x2 : x1,
    baseline: cell.y + padV + ascentMm(printType.origin),
  };
}

/** Zeichnet Herkunft und Schreiblinie in die Zelle `cell`. Zu lange Herkunft bricht um und wächst nach unten. */
export function drawTeamCell(doc: jsPDF, cell: Rect, side: TeamSide, origin: string, pad: { h: number; v: number }): void {
  const layout = teamCellLayout(cell, side, pad.h, pad.v);
  doc.setDrawColor(...printColors.ink);
  doc.setTextColor(...printColors.ink);
  doc.setLineWidth(printStroke.box);
  doc.setFont(fontOf(doc), 'normal');
  doc.setFontSize(printType.origin);
  doc.line(layout.line.x1, layout.line.y, layout.line.x2, layout.line.y);
  const lines = doc.splitTextToSize(origin, layout.line.x2 - layout.line.x1) as string[];
  const advance = doc.getLineHeight() * doc.internal.scaleFactor ** -1;
  lines.forEach((text, index) => {
    doc.text(text, layout.textX, layout.baseline + index * advance, { align: layout.align });
  });
}
