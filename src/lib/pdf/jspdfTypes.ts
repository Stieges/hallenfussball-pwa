/**
 * Typ-Erweiterung von jsPDF um die Metadaten des AutoTable-Plugins (B-28a1).
 */
import type { jsPDF } from 'jspdf';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

/** Unterkante der zuletzt gezeichneten Tabelle. */
export function tableEndY(doc: jsPDF): number {
  return doc.lastAutoTable.finalY;
}
