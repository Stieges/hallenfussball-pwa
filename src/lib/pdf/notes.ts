/**
 * Hinweise an den Nutzer, die beim Bauen des PDFs entstehen und VOR dem Speichern vorliegen (B-28 C3, C8, @DR-012,
 * @DR-027, @DR-024): Felder und Teamnamen mit Zeichen, die als „?“ erscheinen, der Schrift-Rückfall (B6) und eine
 * unbrauchbare Kopfgrafik. `PdfHints` hält sie strukturiert (der Dialog zeigt Original und Gedrucktes nebeneinander),
 * `hintNotes` macht daraus die Sätze (Wizard-Hinweis und Tests).
 */
import { printMetrics } from '../../design-tokens/print';
import { unrenderableChars, type GlyphCheck } from './fonts';
import { printable } from './printable';
import type { PdfTexts } from './translations';

/** Ein Text, wie er eingegeben wurde, und wie er gedruckt wird (nicht druckbare Zeichen als „?“). */
export interface PrintedText {
  original: string;
  printed: string;
}

/** Strukturierte Hinweise eines Baus. Leer (alles `false`/`[]`), wenn nichts zu melden ist. */
export interface PdfHints {
  /** Die Schrift konnte nicht geladen werden: das PDF entsteht in einer Ersatzschrift (@DR-027). */
  fontFallback: boolean;
  /** Gedruckte Freitextfelder (Turniername, Altersklasse, Veranstalter, Halle, Regelwerk, Ansprechpartner) mit nicht druckbaren Zeichen. */
  fields: Array<PrintedText & { label: string }>;
  /** Teamnamen mit nicht druckbaren Zeichen, in der Reihenfolge der Teams. */
  names: PrintedText[];
  /** Unbrauchbare Kopfgrafik (@DR-024). */
  logos: Array<'left' | 'right'>;
}

/** Was `buildHints` braucht. */
export interface HintInput {
  /** Gedruckte Freitextfelder mit ihrer Bezeichnung; leere Felder werden übersprungen. */
  fields: Array<[label: string, text: string]>;
  teamNames: string[];
  mode: { fallback: boolean; covers: GlyphCheck };
  /** Seiten, deren hinterlegte Grafik sich nicht verwenden ließ. */
  logoFailures: Array<'left' | 'right'>;
}

/** Langer Freitext (Regelwerk) im Hinweis nur als Anfang. */
function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > printMetrics.noteExcerptMax ? `${flat.slice(0, printMetrics.noteExcerptMax).trimEnd()}…` : flat;
}

/** Keine Hinweise. */
export const NO_HINTS: PdfHints = { fontFallback: false, fields: [], names: [], logos: [] };

/** Ohne Hinweise? */
export function hasHints(hints: PdfHints): boolean {
  return hints.fontFallback || hints.fields.length > 0 || hints.names.length > 0 || hints.logos.length > 0;
}

/**
 * Hinweise auf Zeichen, die die gewählte Schrift nicht trägt: gedruckte Freitexte und Teamnamen (Daniel 14.10./15.10.;
 * Fixrunde F8), dazu der Schrift-Rückfall und unbrauchbare Grafiken.
 */
export function buildHints({ fields, teamNames, mode, logoFailures }: HintInput): PdfHints {
  const problem = (text: string): boolean => text !== '' && unrenderableChars(text, mode.covers).length > 0;
  return {
    fontFallback: mode.fallback,
    fields: fields
      .filter(([, text]) => problem(text))
      .map(([label, text]) => ({ label, original: excerpt(text), printed: printable(excerpt(text), mode.covers) })),
    names: teamNames.filter(problem).map(name => ({ original: name, printed: printable(name, mode.covers) })),
    logos: logoFailures,
  };
}

/** Die Hinweise als Sätze in der Sprache des Dokuments: Schrift, Felder, Teamnamen, Grafiken. */
export function hintNotes(hints: PdfHints, t: PdfTexts): string[] {
  return [
    ...(hints.fontFallback ? [t.fontFallbackNote] : []),
    ...hints.fields.map(({ label, original }) => t.unrenderableField(label, original)),
    ...hints.names.map(({ original }) => t.unrenderableName(original)),
    ...hints.logos.map(side => t.logoUnusable(side)),
  ];
}
