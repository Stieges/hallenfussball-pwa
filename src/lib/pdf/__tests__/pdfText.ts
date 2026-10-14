/**
 * Rendert den Spielplan-Export über die echte Fassade und liefert den Mitschnitt (B-28a0, Spur C).
 *
 * Voraussetzung in der Testdatei: `vi.mock('jspdf', …)` mit `capturingJsPdf` aus `./pdfCapture`.
 * Ohne diese Umhüllung liefert `renderSchedulePdf` einen Fehler statt eines leeren Ergebnisses.
 */
import { exportScheduleToPDF, type PDFExportOptions } from '../../pdfExporter';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing } from '../../../types/tournament';
import type { PdfLocale, PdfTranslator } from '../translations';
import deTournament from '../../../i18n/locales/de/tournament.json';
import enTournament from '../../../i18n/locales/en/tournament.json';
import { lastCapture, resetCapture, type CapturedDoc } from './pdfCapture';

export type RenderedPdf = CapturedDoc;

/**
 * Echte Ressourcen statt Schlüssel: die globale i18next-Mock der Testumgebung gibt sonst `pdf.nr` zurück.
 * Fehlt ein Schlüssel, wirft der Übersetzer, damit kein Text still leer bleibt.
 */
function resourceTranslator(resource: Record<string, unknown>): PdfTranslator {
  return (key, values) => {
    let node: unknown = resource;
    for (const part of key.split('.')) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== 'string') {
      throw new Error(`Übersetzung fehlt: tournament:${key}`);
    }
    return node.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? `{{${name}}}`));
  };
}

const RESOURCES: Record<PdfLocale, Record<string, unknown>> = { de: deTournament, en: enTournament };

/** Rendert den Export und gibt Dateiname, Seitenmaße und Text je Seite zurück. Vorgabe: Deutsch. */
export async function renderSchedulePdf(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: PDFExportOptions = {},
): Promise<RenderedPdf> {
  const locale = options.locale ?? 'de';
  const withTexts: PDFExportOptions = { locale, translate: resourceTranslator(RESOURCES[locale]), ...options };
  resetCapture();
  await exportScheduleToPDF(schedule, standings, withTexts);
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
