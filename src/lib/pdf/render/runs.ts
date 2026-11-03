/**
 * Grundbausteine der Zeichenschicht (T7a): Textstücke, Flächen und Gruppenzeichen des Seitenmodells 1:1 in jsPDF-Aufrufe
 * umsetzen. Nichts davon rechnet eine Position; alle Maße kommen aus `model/*`. Text ist immer schwarz (@DR-001), Akzent
 * und heller Ton stehen nur auf Linien und Flächen.
 */
import type { jsPDF } from 'jspdf';
import { printColors } from '../../../design-tokens/print';
import { printGroupMark, printZebra } from '../../../design-tokens/print-sheet';
import { fontOf } from '../fonts';
import type { Fill, GroupMark, TextRun } from '../model/types';
import type { PdfAccent } from '../pdfOptions';
import { drawUnderline } from './links';
import { rgbOf } from './writeLine';

/** Zeichnet Textstücke in der Reihenfolge der Liste (Lesereihenfolge, @DR-039); schwarz und aufrecht. */
export function drawRuns(doc: jsPDF, runs: readonly TextRun[]): void {
  const family = fontOf(doc);
  doc.setTextColor(...printColors.ink);
  for (const run of runs) {
    doc.setFont(family, run.weight);
    doc.setFontSize(run.pt);
    doc.text(run.text, run.x, run.y, run.align === 'left' ? undefined : { align: run.align });
    if (run.underline) {
      drawUnderline(doc, run.underline);
    }
  }
}

/** Helle Fläche im Ton des Akzents; die Eckdaten mit gerundeten Ecken (@DR-031). */
export function drawFill(doc: jsPDF, fill: Fill, accent: PdfAccent): void {
  doc.setFillColor(...rgbOf(accent.tint));
  if (fill.kind === 'facts') {
    doc.roundedRect(fill.x, fill.y, fill.w, fill.h, printZebra.factsRadius, printZebra.factsRadius, 'F');
  } else {
    doc.rect(fill.x, fill.y, fill.w, fill.h, 'F');
  }
}

/** Rahmen des Gruppenzeichens: Gruppe A eckig, B rund, in Akzent; den Buchstaben (schwarz, @DR-001) zeichnet die Zeile mit ihren Texten. */
export function drawGroupMark(doc: jsPDF, mark: GroupMark, accent: PdfAccent): void {
  doc.setDrawColor(...rgbOf(accent.line));
  doc.setLineWidth(printGroupMark.stroke);
  const { x, y, w, h } = mark.frame;
  if (mark.shape === 'circle') {
    doc.circle(x + w / 2, y + h / 2, w / 2, 'S');
  } else {
    doc.rect(x, y, w, h, 'S');
  }
}
