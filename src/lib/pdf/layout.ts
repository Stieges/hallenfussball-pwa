/**
 * Seitengeometrie und Seitenumbruch für das Spielplan-PDF (B-28a1). Rein, nur Maße aus den Druck-Tokens.
 */
import type { jsPDF } from 'jspdf';
import { printPage, printSpacing } from '../../design-tokens/print';

export type PdfFormat = 'a4';
export type PdfOrientation = 'portrait' | 'landscape';

export interface PageGeometry {
  width: number;
  height: number;
  /** Breite des Satzspiegels zwischen den Seitenrändern. */
  contentWidth: number;
  /** Oberkante des Satzspiegels, y der ersten Zeile nach einem Seitenumbruch. */
  top: number;
  /** Unterkante des Satzspiegels. */
  bottom: number;
  left: number;
  right: number;
}

export function pageGeometry(format: PdfFormat, orientation: PdfOrientation): PageGeometry {
  const size = printPage[format][orientation];
  const margin = printSpacing.pageMargin;
  return {
    width: size.width,
    height: size.height,
    contentWidth: size.width - margin.left - margin.right,
    top: margin.top,
    bottom: size.height - margin.bottom,
    left: margin.left,
    right: margin.right,
  };
}

/** Stellt sicher, dass `minSpace` mm ab `yPos` passen. Sonst neue Seite, Rückgabe ist die Oberkante. */
export function ensureSpace(doc: jsPDF, yPos: number, minSpace: number, geo: PageGeometry): number {
  if (yPos + minSpace > geo.bottom) {
    doc.addPage();
    return geo.top;
  }
  return yPos;
}
