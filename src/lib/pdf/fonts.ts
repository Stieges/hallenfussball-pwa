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

/** Registrierter Name der eingebetteten Schrift in jsPDF und Name der Standardschrift für den Rückfall (B6). */
const EMBEDDED_FAMILY = 'pdfSans';
const FALLBACK_FAMILY = 'helvetica';
/** Schrift je Dokument (B6, F1): kein Modulzustand, parallele Bauten stören sich nicht. */
const familyOf = new WeakMap<object, string>();

export const PDF_FONT = {
  /** Registrierter Schriftname der eingebetteten Schrift in jsPDF. Render-Code liest `fontOf(doc)`, im Rückfall `helvetica`. */
  family: EMBEDDED_FAMILY,
  /** Dateinamen im virtuellen Dateisystem von jsPDF, je Schnitt. */
  files: { normal: 'pdfSans-normal.ttf', bold: 'pdfSans-bold.ttf' },
  /** Lazy geladene Schriftdaten (base64), je Schnitt. Eigener Chunk, nicht im Haupt-Chunk. */
  load: {
    normal: () => import('./fontData/regular'),
    bold: () => import('./fontData/bold'),
  },
  /**
   * Abdeckung der eingebetteten Teilmenge: ASCII, Latin-1, Latin Extended-A/B, Griechisch (U+0370–03FF) und
   * Kyrillisch (U+0400–04FF), je nur die Codepunkte, die die Schrift trägt (Lücken ausgenommen). Ausgenommen sind
   * außerdem U+00AD (weiches Trennzeichen), U+0149 (ŉ) und U+01C4 (Ǆ), die Inter-Teilmenge trägt sie nicht.
   * Steuerzeichen fehlen ebenfalls. Die Gleichheit mit der cmap der Schrift prüft `fontCmap.test.ts` (B10e).
   */
  coverage: [
    [0x0020, 0x007e],
    [0x00a0, 0x00ac],
    [0x00ae, 0x0148],
    [0x014a, 0x01c3],
    [0x01c5, 0x024f],
    [0x0374, 0x0376],
    [0x037a, 0x037f],
    [0x0384, 0x038a],
    [0x038c, 0x038c],
    [0x038e, 0x03a1],
    [0x03a3, 0x03d7],
    [0x03dc, 0x03dd],
    [0x03f0, 0x03f6],
    [0x03f9, 0x03fa],
    [0x03fc, 0x0479],
    [0x0480, 0x049d],
    [0x04a0, 0x04ff],
    [0x2013, 0x2014],
    [0x2018, 0x201a],
    [0x201c, 0x201e],
    [0x2022, 0x2022],
    [0x2026, 0x2026],
    [0x20ac, 0x20ac],
  ] satisfies readonly CodepointRange[],
} as const;

/** Prüft, ob die Schrift ein Zeichen trägt. */
export type GlyphCheck = (char: string) => boolean;

/** Trägt die eingebettete Schrift dieses Zeichen? */
export function isPdfGlyph(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return PDF_FONT.coverage.some(([from, to]) => code >= from && code <= to);
}

/** Abdeckung der Standardschrift (WinAnsi): ASCII, Latin-1 und die Satzzeichen aus 0x2013 bis 0x20ac, die Windows-1252 trägt. */
const STANDARD_COVERAGE: readonly CodepointRange[] = [
  [0x0020, 0x007e],
  [0x00a0, 0x00ff],
  [0x2013, 0x2014],
  [0x2018, 0x201a],
  [0x201c, 0x201e],
  [0x2022, 0x2022],
  [0x2026, 0x2026],
  [0x20ac, 0x20ac],
];

/** Trägt die Standardschrift (Rückfall) dieses Zeichen? */
export function isStandardGlyph(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return STANDARD_COVERAGE.some(([from, to]) => code >= from && code <= to);
}

/** Zeichen eines Textes, die die Schrift nicht trägt (ohne Doppelte, in Reihenfolge). */
export function unrenderableChars(text: string, covers: GlyphCheck = isPdfGlyph): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    if (!covers(char)) {
      missing.add(char);
    }
  }
  return [...missing];
}

/** Schriftname dieses Dokuments: die eingebettete Schrift, im Rückfall `helvetica` (gesetzt von `registerPdfFonts`). */
export function fontOf(doc: jsPDF): string {
  return familyOf.get(doc) ?? EMBEDDED_FAMILY;
}

/** Ergebnis der Schriftwahl: ob der Rückfall gilt und welche Zeichen die gewählte Schrift trägt. */
export interface PdfFontMode {
  fallback: boolean;
  covers: GlyphCheck;
}

/**
 * Lädt beide Schnitte und registriert sie unter `PDF_FONT.family`. Vor dem ersten `setFont` aufrufen.
 * Scheitert das Laden (veralteter Service Worker, Chunk nicht im Cache, B6), gilt die Standardschrift: besser ein PDF
 * mit evtl. „?“ als gar keins (@DR-013). Der Aufrufer meldet `fallback` an den Nutzer.
 */
export async function registerPdfFonts(doc: jsPDF): Promise<PdfFontMode> {
  try {
    const [normal, bold] = await Promise.all([PDF_FONT.load.normal(), PDF_FONT.load.bold()]);
    doc.addFileToVFS(PDF_FONT.files.normal, normal.default);
    doc.addFont(PDF_FONT.files.normal, EMBEDDED_FAMILY, 'normal');
    doc.addFileToVFS(PDF_FONT.files.bold, bold.default);
    doc.addFont(PDF_FONT.files.bold, EMBEDDED_FAMILY, 'bold');
    familyOf.set(doc, EMBEDDED_FAMILY);
    return { fallback: false, covers: isPdfGlyph };
  } catch {
    familyOf.set(doc, FALLBACK_FAMILY);
    return { fallback: true, covers: isStandardGlyph };
  }
}
