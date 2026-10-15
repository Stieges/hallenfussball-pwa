/**
 * Einzeilige Texte in eine Breite zwingen (Fußzeile, Kurzkopf-Untertitel): zu lange Texte enden mit „…“.
 * Nur Messen, kein Zeichnen. Schrift und Größe müssen am Dokument schon gesetzt sein.
 */
import type { jsPDF } from 'jspdf';

/** Kürzt `text` hinten, bis er samt „…“ in `width` mm passt. Passt er schon, bleibt er unverändert. */
export function clipToWidth(doc: jsPDF, text: string, width: number): string {
  if (doc.getTextWidth(text) <= width) {
    return text;
  }
  let cut = text;
  while (cut.length > 0 && doc.getTextWidth(`${cut}…`) > width) {
    cut = cut.slice(0, -1);
  }
  return `${cut.trimEnd()}…`;
}
