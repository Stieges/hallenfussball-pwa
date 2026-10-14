/**
 * Schrift des Spielplan-PDFs (B-28a2, Daniel 15.10.: Inter überall). Eingebettet statt `helvetica`, damit ł, ğ,
 * ı, ź und die übrigen Latein-erweitert-Zeichen darstellbar sind (@BM-048).
 *
 * EINE Stelle zum Tauschen der Schrift: das Objekt `PDF_FONT` unten (Name, Dateien, Lader, Abdeckung).
 * Render-Dateien und Tests lesen nur `PDF_FONT.family` bzw. die Abdeckung, nie einen Schriftnamen.
 */
import type { jsPDF } from 'jspdf';

/** Abdeckung als Codepunkt-Bereiche (inklusive). Muss zur eingebetteten Teilmenge passen. */
type CodepointRange = readonly [from: number, to: number];

export const PDF_FONT = {
  /** Registrierter Schriftname in jsPDF. Nur hier. */
  family: 'pdfSans',
  /** Dateinamen im virtuellen Dateisystem von jsPDF, je Schnitt. */
  files: { normal: 'pdfSans-normal.ttf', bold: 'pdfSans-bold.ttf' },
  /** Lazy geladene Schriftdaten (base64), je Schnitt. Eigener Chunk, nicht im Haupt-Chunk. */
  load: {
    normal: () => import('./fontData/regular'),
    bold: () => import('./fontData/bold'),
  },
  /**
   * Abdeckung der eingebetteten Teilmenge: ASCII, Latin-1 und Latin Extended-A/B, ohne U+00AD (weiches Trennzeichen),
   * U+0149 (ŉ) und U+01C4 (Ǆ), die Inter-Teilmenge trägt sie nicht. Steuerzeichen fehlen ebenfalls. Gegenprüfung:
   * `schedulePdf.text.test.ts` vergleicht mit der Zeichenliste der Schrift.
   */
  coverage: [
    [0x0020, 0x007e],
    [0x00a0, 0x00ac],
    [0x00ae, 0x0148],
    [0x014a, 0x01c3],
    [0x01c5, 0x024f],
    [0x2013, 0x2014],
    [0x2018, 0x201a],
    [0x201c, 0x201e],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x20ac, 0x20ac],
  ] satisfies readonly CodepointRange[],
} as const;

/** Trägt die eingebettete Schrift dieses Zeichen? */
export function isPdfGlyph(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return PDF_FONT.coverage.some(([from, to]) => code >= from && code <= to);
}

/** Zeichen eines Textes, die die Schrift nicht trägt (ohne Doppelte, in Reihenfolge). */
export function unrenderableChars(text: string): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    if (!isPdfGlyph(char)) {
      missing.add(char);
    }
  }
  return [...missing];
}

/** Lädt beide Schnitte und registriert sie unter `PDF_FONT.family`. Vor dem ersten `setFont` aufrufen. */
export async function registerPdfFonts(doc: jsPDF): Promise<void> {
  const [normal, bold] = await Promise.all([PDF_FONT.load.normal(), PDF_FONT.load.bold()]);
  doc.addFileToVFS(PDF_FONT.files.normal, normal.default);
  doc.addFont(PDF_FONT.files.normal, PDF_FONT.family, 'normal');
  doc.addFileToVFS(PDF_FONT.files.bold, bold.default);
  doc.addFont(PDF_FONT.files.bold, PDF_FONT.family, 'bold');
}
