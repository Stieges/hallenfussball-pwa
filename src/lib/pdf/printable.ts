/**
 * „?“-Ersatz für nicht druckbare Zeichen (B-28 C3, B2, @DR-012): EINE Stelle für alle gedruckten Texte.
 *
 * Die Schrift trägt nicht jedes Zeichen (arabische Buchstaben, Emoji, Steuerzeichen). jsPDF löscht solche Zeichen
 * stumm. `printable` ersetzt stattdessen jeden nicht druckbaren Codepunkt durch ein „?“, damit an der Stelle sichtbar
 * bleibt, dass dort etwas stand. `guardDocText` hängt den Ersatz an die Textfunktionen des Dokuments: Teamnamen,
 * Titel, Regelwerk, Halle, Kontakt und jede künftige Zeile laufen so durch dieselbe Stelle, auch Texte, die
 * `jspdf-autotable` zeichnet.
 */
import type { jsPDF } from 'jspdf';
import { isPdfGlyph, type GlyphCheck } from './fonts';

const SUBSTITUTE = '?';
/** Zeilenumbruch bleibt: mehrzeilige Zellen und `splitTextToSize` brauchen ihn. */
const LINE_BREAK = '\n';
/** Variantenwähler-16 (U+FE0F) und Zero-Width-Joiner (U+200D): unsichtbar, kein „?“ für sie. */
const INVISIBLE = /[\uFE0F\u200D]/g;

/** Ersetzt jedes nicht druckbare Zeichen (je Codepunkt) durch „?“. */
export function printable(text: string, covers: GlyphCheck = isPdfGlyph): string {
  let result = '';
  // Vorher: zusammengesetzte Form (NFD-„ü“ bleibt „ü“), einheitliche Zeilenenden, Variantenwähler und ZWJ ohne Ersatz
  const prepared = text.normalize('NFC').replace(/\r\n?/g, LINE_BREAK).replace(INVISIBLE, '');
  for (const char of prepared) {
    result += char === LINE_BREAK || covers(char) ? char : SUBSTITUTE;
  }
  return result;
}

/** Texteingang der jsPDF-Funktionen: eine Zeichenkette oder eine Liste von Zeilen. Anderes (Zahlen) bleibt. */
function cleaned(value: unknown, covers: GlyphCheck): unknown {
  if (typeof value === 'string') {
    return printable(value, covers);
  }
  if (Array.isArray(value)) {
    return (value as unknown[]).map(entry => (typeof entry === 'string' ? printable(entry, covers) : entry));
  }
  return value;
}

/** Textfunktionen von jsPDF, deren erstes Argument gedruckter oder gemessener Text ist. */
const TEXT_FUNCTIONS = ['text', 'splitTextToSize', 'getTextWidth', 'getStringUnitWidth', 'getTextDimensions'] as const;

/**
 * Setzt den Ersatz an die Textfunktionen dieser Dokument-Instanz. Gemessen wird dasselbe, was gedruckt wird (ein „?“
 * statt eines fehlenden Glyphs), damit Umbrüche und Breiten stimmen. Einmal direkt nach dem Anlegen aufrufen.
 */
export function guardDocText(doc: jsPDF, covers: GlyphCheck): void {
  const target = doc as unknown as Record<string, (first: unknown, ...rest: unknown[]) => unknown>;
  for (const name of TEXT_FUNCTIONS) {
    const original = target[name];
    target[name] = (first, ...rest) => original.call(doc, cleaned(first, covers), ...rest);
  }
}
