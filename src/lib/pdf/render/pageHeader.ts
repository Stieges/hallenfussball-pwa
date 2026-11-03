/**
 * Kopf von Seite 1 zeichnen (T7a, @DR-003, @DR-006, @DR-023, @DR-024, @DR-031, @DR-038): Grafiken, Titel, heller Eckdaten-
 * Block, Regelzeile, Zuschauer-QR mit unterstrichener Beschriftung und die Kopflinie in Akzent. 1:1 nach `HeaderBlock`.
 */
import type { jsPDF } from 'jspdf';
import { printHeader } from '../../../design-tokens/print-header';
import type { HeaderBlock } from '../model/types';
import type { PdfAccent } from '../pdfOptions';
import { drawLogo, type PlacedLogo } from './headerGraphics';
import { drawQrSymbol } from './qrCode';
import { drawFill, drawRuns } from './runs';
import { drawRule, drawStroke, rgbOf } from './writeLine';
import { printSheetHead } from '../../../design-tokens/print-sheet';

/** Schon geprüfte und bemessene Grafiken (`usableLogo`); fehlt eine, hat das Modell ihren Platz nicht vorgesehen (@DR-024). */
export interface HeaderPictures { left?: PlacedLogo; right?: PlacedLogo }

export function drawPageHeader(doc: jsPDF, block: HeaderBlock, pictures: HeaderPictures, qr: boolean[][] | undefined, accent: PdfAccent): void {
  for (const place of block.images) {
    const logo = pictures[place.side];
    if (logo) {
      drawLogo(doc, logo, place.x, place.y);
    }
  }
  drawRuns(doc, block.title);
  drawFill(doc, block.facts.fill, accent);
  for (const cell of block.facts.cells) {
    drawRuns(doc, cell.runs);
    drawStroke(doc, cell.mark, printSheetHead.factMarkStroke, rgbOf(accent.line));
  }
  drawRuns(doc, block.rules);
  if (block.qr && qr) {
    drawQrSymbol(doc, qr, printHeader.qrEdge, block.qr.box.x, block.qr.box.y);
  }
  if (block.qrCaption) {
    drawRuns(doc, [block.qrCaption]);
  }
  drawRule(doc, block.rule, accent);
}
