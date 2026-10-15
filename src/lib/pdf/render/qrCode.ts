/**
 * Zuschauer-QR im Kopf (B-28 C4, @DR-003, @BM-009, @DR-010): Vektor aus der Modul-Matrix, schwarz auf Papier-Weiß, Kante
 * des Symbols mindestens 30 mm, Ruhezone von vier Modulen, kurze Beschriftung darunter. Nur Messen und Zeichnen; die
 * Matrix kommt aus `lib/qr/publicQr.ts`. Ohne Matrix wird nichts gemessen und nichts gezeichnet (@ZM-064).
 */
import type { jsPDF } from 'jspdf';
import { printColors } from '../../../design-tokens/print';
import { printHeader } from '../../../design-tokens/print-header';
import { ascentMm, descentMm } from '../layout';
import { fontOf } from '../fonts';

/** Was der Kopf vom QR braucht: die Matrix und die fertig übersetzte Beschriftung. */
export interface HeaderQr {
  modules: boolean[][];
  caption: string;
}

/** Maße des QR-Blocks in mm. */
export interface QrBlock {
  /** Breite und Höhe der weißen Fläche (Symbol plus Ruhezone). */
  side: number;
  /** Kantenlänge eines Moduls. */
  module: number;
  captionLines: string[];
  /** Höhe von der Oberkante der weißen Fläche bis zur Unterkante der Beschriftung. */
  height: number;
}

/** Zeilen der Beschriftung in der Breite der Spalte. */
function captionLinesOf(doc: jsPDF, caption: string, width: number): string[] {
  doc.setFont(fontOf(doc), 'normal');
  doc.setFontSize(printHeader.qrCaptionPt);
  return doc.splitTextToSize(caption, width) as string[];
}

/** Misst den Block: Modulgröße so, dass das Symbol `qrEdge` mm misst; Ruhezone ringsum; Beschriftung darunter. */
export function measureQr(doc: jsPDF, qr: HeaderQr): QrBlock {
  const module = printHeader.qrEdge / qr.modules.length;
  const side = printHeader.qrEdge + 2 * printHeader.qrQuietModules * module;
  const captionLines = captionLinesOf(doc, qr.caption, side);
  const captionHeight = ascentMm(printHeader.qrCaptionPt) + (captionLines.length - 1) * printHeader.qrCaptionAdvance + descentMm(printHeader.qrCaptionPt);
  return { side, module, captionLines, height: side + printHeader.qrCaptionGap + captionHeight };
}

/** Zeichnet den Block mit der Oberkante der weißen Fläche bei (`left`, `top`). */
export function drawQr(doc: jsPDF, qr: HeaderQr, block: QrBlock, left: number, top: number): void {
  // Weiß ist das Papier: die Ruhezone bleibt unbedruckt, es wird keine weiße Fläche gezeichnet
  const quiet = printHeader.qrQuietModules * block.module;

  // Zusammenhängende dunkle Module einer Zeile als ein Rechteck: kurzer Inhalt, keine Lücken zwischen Modulen
  doc.setFillColor(...printColors.ink);
  qr.modules.forEach((row, r) => {
    let start = -1;
    [...row, false].forEach((dark, c) => {
      if (dark && start < 0) {
        start = c;
      } else if (!dark && start >= 0) {
        doc.rect(left + quiet + start * block.module, top + quiet + r * block.module, (c - start) * block.module, block.module, 'F');
        start = -1;
      }
    });
  });

  // Beschriftung mittig unter der Ruhezone
  doc.setTextColor(...printColors.ink);
  doc.setFont(fontOf(doc), 'normal');
  doc.setFontSize(printHeader.qrCaptionPt);
  const first = top + block.side + printHeader.qrCaptionGap + ascentMm(printHeader.qrCaptionPt);
  block.captionLines.forEach((line, i) => {
    doc.text(line, left + block.side / 2, first + i * printHeader.qrCaptionAdvance, { align: 'center' });
  });
}
