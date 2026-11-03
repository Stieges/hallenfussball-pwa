/**
 * Messfunktion für Textbreiten (PDF-Paket § 3, Vorlauf V1). Das Seitenmodell misst nur über `TextMeasure`; die
 * Schrift kennt allein der Adapter `jspdfMeasure`. Modelltests nehmen eine feste Breite je Zeichen
 * (`fixedWidthMeasure`), damit jede Erwartung von Hand nachrechenbar ist.
 */
import type { jsPDF } from 'jspdf';

/** Schnitt der Schrift. Inter kennt im PDF nur diese beiden (T1). */
export type FontWeight = 'normal' | 'bold';

/** Breite eines einzeiligen Textes in mm bei `pt` Punkt im Schnitt `weight`. Kein Umbruch, keine Kürzung. */
export interface TextMeasure {
  width(text: string, pt: number, weight: FontWeight): number;
}

/**
 * Feste Breite je Zeichen (Codepunkt), unabhängig von der Schriftgröße. Nur für Modelltests: Mit
 * `{ normal: 2, bold: 2.2 }` (PDF-Paket § 4.0) ist „FC Nord“ 14 mm breit, fett 15,4 mm.
 */
export function fixedWidthMeasure(mmPerChar: Readonly<Record<FontWeight, number>>): TextMeasure {
  return { width: (text, _pt, weight) => [...text].length * mmPerChar[weight] };
}

/**
 * Misst mit der Schrift des Dokuments (`family`, aus `fontOf(doc)`; T1). Das Dokument rechnet in mm (`unit: 'mm'`,
 * wie `openDocument`), sonst stimmt die Einheit nicht. Schrift, Schnitt und Größe des Dokuments sind
 * danach wie vorher; so darf der Adapter auch mitten im Zeichnen messen.
 */
export function jspdfMeasure(doc: jsPDF, family: string): TextMeasure {
  return {
    width(text, pt, weight) {
      const before = doc.getFont();
      const beforeSize = doc.getFontSize();
      doc.setFont(family, weight);
      doc.setFontSize(pt);
      const width = doc.getTextWidth(text);
      doc.setFont(before.fontName, before.fontStyle);
      doc.setFontSize(beforeSize);
      return width;
    },
  };
}
