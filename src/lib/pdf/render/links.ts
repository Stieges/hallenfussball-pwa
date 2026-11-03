/**
 * Links im PDF (T7a, @DR-038): Link-Flächen des Seitenmodells als Annotationen und die Unterstreichung einer Beschriftung
 * als genau ein Strich. Ohne Online-Teilen gibt es keine Fläche, also keinen Link.
 */
import type { jsPDF } from 'jspdf';
import { printColors } from '../../../design-tokens/print';
import { printSheetHead } from '../../../design-tokens/print-sheet';
import type { HLine, LinkArea } from '../model/types';
import { drawStroke } from './writeLine';

/** Eine Link-Annotation je Fläche. */
export function drawLinks(doc: jsPDF, links: readonly LinkArea[]): void {
  for (const link of links) {
    doc.link(link.x, link.y, link.w, link.h, { url: link.url });
  }
}

/** Unterstreichung: ein einziger Strich unter der ganzen Beschriftung (nicht in Stücken). */
export function drawUnderline(doc: jsPDF, line: HLine): void {
  drawStroke(doc, line, printSheetHead.underlineStroke, [...printColors.ink]);
}
