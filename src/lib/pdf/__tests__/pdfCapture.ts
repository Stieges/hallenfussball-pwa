/**
 * Mitschnitt für PDF-Tests (B-28a0, Spur C). Reine Test-Hilfe, kein Produktcode.
 *
 * jsPDF 4 legt `text` und `save` pro Instanz an (nicht am Prototyp). Deshalb umhüllt die Testdatei den
 * Konstruktor über `vi.mock('jspdf')` mit `capturingJsPdf`; jede Instanz schreibt beim Zeichnen mit.
 *
 * RÜCKFALL (im Report gekennzeichnet): pdfjs-dist ist nicht freigegeben (F2 offen). Gemessen wird die
 * Übergabe an `doc.text`, nicht das gedruckte Glyph. `doc.save` wird abgefangen, es wird nichts geschrieben.
 *
 * Bewusst ohne Laufzeit-Importe außer Typen: wird aus `vi.mock`-Factory geladen (keine Import-Schleife).
 */
import type { jsPDF } from 'jspdf';

type TextArgs = [text: string | string[], ...rest: unknown[]];

/** jsPDF führt `getCurrentPageInfo` zur Laufzeit aus, die Typen kennen es nicht. */
interface PageInternals {
  getCurrentPageInfo(): { pageNumber: number };
}

export interface CapturedDoc {
  filename: string;
  pageWidth: number;
  pageHeight: number;
  /** `pages[0]` = Seite 1; Textstücke je Seite in Zeichenreihenfolge. */
  pages: string[][];
}

let finished: CapturedDoc | undefined;

/** Setzt den Mitschnitt zurück (vor jedem Export aufrufen). */
export function resetCapture(): void {
  finished = undefined;
}

/** Der zuletzt gespeicherte Mitschnitt (`doc.save` wurde aufgerufen). */
export function lastCapture(): CapturedDoc | undefined {
  return finished;
}

function instrument(doc: jsPDF): void {
  const pages: string[][] = [];

  const rawText = doc.text as unknown as (...args: TextArgs) => jsPDF;
  const internals = doc.internal as unknown as PageInternals;
  doc.text = (...args: TextArgs): jsPDF => {
    const page = internals.getCurrentPageInfo().pageNumber;
    const bucket = pages[page - 1] ?? [];
    pages[page - 1] = bucket;
    const value = args[0];
    bucket.push(Array.isArray(value) ? value.join('\n') : String(value));
    return rawText.apply(doc, args);
  };

  doc.save = ((filename?: string): jsPDF => {
    finished = {
      filename: filename ?? '',
      pageWidth: doc.internal.pageSize.getWidth(),
      pageHeight: doc.internal.pageSize.getHeight(),
      pages: Array.from({ length: Math.max(1, pages.length) }, (_, i) => pages[i] ?? []),
    };
    return doc;
  }) as unknown as typeof doc.save;
}

/** Umhüllt eine jsPDF-Klasse so, dass jede neue Instanz mitschreibt. */
export function capturingJsPdf<T extends new (...args: never[]) => jsPDF>(Base: T): T {
  class Capturing extends (Base as new (...args: never[]) => jsPDF) {
    constructor(...args: never[]) {
      super(...args);
      instrument(this);
    }
  }
  return Capturing as unknown as T;
}
