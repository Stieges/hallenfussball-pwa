/**
 * Einzeilige Texte in eine Breite zwingen (Fußzeile, Kurzkopf-Untertitel): zu lange Texte enden mit „…“. Dazu der
 * Umbruch an Trennstellen für die Angaben im Kopf. Nur Messen, kein Zeichnen. Schrift und Größe müssen am Dokument schon gesetzt sein.
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

/**
 * Bricht `text` nur an der Trennstelle `separator` (z. B. „ · “) in Zeilen der Breite `width`, nie innerhalb eines Teils
 * (G6, Termin-Zeile). Der Trenner bleibt am Ende der abgebrochenen Zeile. Ein einzelner Teil, der allein nicht passt,
 * bricht notfalls im Wort (`fallback`).
 */
export function wrapAtSeparators(
  measure: (text: string) => number,
  text: string,
  width: number,
  separator: string,
  fallback: (text: string, width: number) => string[] = part => [part]
): string[] {
  const glue = separator.trimEnd();
  const parts = text.split(separator);
  const lines: string[] = [];
  let current = '';
  parts.forEach((part, index) => {
    const last = index === parts.length - 1;
    const piece = last ? part : `${part}${glue}`;
    const joined = current === '' ? piece : `${current}${separator.slice(glue.length)}${piece}`;
    if (current !== '' && measure(joined) > width) {
      lines.push(current);
      current = piece;
    } else {
      current = joined;
    }
  });
  lines.push(current);
  return lines.flatMap(line => (measure(line) > width ? fallback(line, width) : [line]));
}
