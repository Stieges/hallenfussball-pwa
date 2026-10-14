/**
 * Rendert den Spielplan-Export über die echte Fassade und liefert den Mitschnitt (B-28a0, Spur C).
 *
 * Voraussetzung in der Testdatei: `vi.mock('jspdf', …)` mit `capturingJsPdf` aus `./pdfCapture`.
 * Ohne diese Umhüllung liefert `renderSchedulePdf` einen Fehler statt eines leeren Ergebnisses.
 */
import { exportScheduleToPDF, type PDFExportOptions } from '../../pdfExporter';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing } from '../../../types/tournament';
import { lastCapture, resetCapture, type CapturedDoc } from './pdfCapture';

export type RenderedPdf = CapturedDoc;

/** Rendert den Export und gibt Dateiname, Seitenmaße und Text je Seite zurück. */
export async function renderSchedulePdf(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: PDFExportOptions = {},
): Promise<RenderedPdf> {
  resetCapture();
  await exportScheduleToPDF(schedule, standings, options);
  const rendered = lastCapture();
  if (!rendered) {
    throw new Error('exportScheduleToPDF hat kein doc.save aufgerufen – vi.mock(jspdf) fehlt?');
  }
  return rendered;
}

/** Alle Textstücke über alle Seiten in Zeichenreihenfolge. */
export function flatText(pdf: RenderedPdf): string[] {
  return pdf.pages.flat();
}

/**
 * Die `width` Zellen einer Spielzeile ab der Spielnummer (Nr, Zeit, Feld, …). Wirft, wenn die Zeile fehlt:
 * ein fehlender Eintrag darf nie als „leer erfüllt“ durchgehen.
 */
export function rowFrom(text: string[], matchNumber: number, time: string, width: number): string[] {
  const i = text.findIndex((t, idx) => t === String(matchNumber) && text[idx + 1] === time);
  if (i < 0) {
    throw new Error(`Zeile Spiel ${matchNumber} (${time}) fehlt im PDF-Text`);
  }
  return text.slice(i, i + width);
}

/** Textstücke ohne leere Zellen (autoTable schreibt leere Zellen als ''). */
export function nonEmpty(text: string[]): string[] {
  return text.filter(t => t !== '');
}

/** Kommt die Folge `expected` zusammenhängend in `text` vor (leere Zellen zählen nicht)? */
export function containsSequence(text: string[], expected: string[]): boolean {
  const tokens = nonEmpty(text);
  return tokens.some((_, i) => expected.every((e, j) => tokens[i + j] === e));
}
