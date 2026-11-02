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
import deShort from '../../../i18n/locales/de/short.json';
import enShort from '../../../i18n/locales/en/short.json';
import deSport from '../../../i18n/locales/de/sport.json';
import enSport from '../../../i18n/locales/en/sport.json';
import type { Tournament } from '../../../types/tournament';
import { hallencupTournament } from './pdfFixture';
import { lastCapture, resetCapture, type CapturedDoc } from './pdfCapture';

/** Optionen für Testaufrufe: ohne Turnier wird das „Hallencup Nord“ der Fixture genommen (Pflicht im Export). */
export type TestPdfOptions = Omit<PDFExportOptions, 'tournament'> & { tournament?: Tournament };

export type RenderedPdf = CapturedDoc;

type Resources = Record<string, Record<string, unknown>>;

/** Wert unter `a.b.c` in einer Ressource; bei Zählformen (`_one`/`_other`) nach den Plural-Regeln der Sprache. */
function lookup(resource: Record<string, unknown> | undefined, path: string, count: number | undefined, locale: PdfLocale): unknown {
  const find = (p: string): unknown => {
    let node: unknown = resource;
    for (const part of p.split('.')) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    return node;
  };
  if (count !== undefined) {
    const plural = find(`${path}_${new Intl.PluralRules(locale).select(count)}`);
    if (typeof plural === 'string') {
      return plural;
    }
  }
  return find(path);
}

/**
 * Echte Ressourcen statt Schlüssel: die globale i18next-Mock der Testumgebung gibt sonst `pdf.nr` zurück.
 * Kennt `Namensraum:Schlüssel`, Zählformen und Verschachtelungen `$t(sport:zeit.minuteCount, {"count": 5})` wie i18next.
 * Fehlt ein Schlüssel, wirft der Übersetzer, damit kein Text still leer bleibt.
 */
function resourceTranslator(locale: PdfLocale, namespaces: Resources): PdfTranslator {
  const translate: PdfTranslator = (key, values) => {
    const colon = key.indexOf(':');
    const ns = colon < 0 ? 'tournament' : key.slice(0, colon);
    const path = colon < 0 ? key : key.slice(colon + 1);
    const count = typeof values?.count === 'number' ? values.count : undefined;
    const node = lookup(namespaces[ns], path, count, locale);
    if (typeof node !== 'string') {
      throw new Error(`Übersetzung fehlt: ${ns}:${path}`);
    }
    return node
      .replace(/\$t\(([^,)]+)(?:,\s*(\{[^)]*\}))?\)/g, (_, ref: string, options: string | undefined) => {
        const nested = options === undefined ? {} : (JSON.parse(options.replace(/\{\{(\w+)\}\}/g, (__, name: string) => String(values?.[name] ?? 0))) as Record<string, string | number>);
        return translate(ref.trim(), nested);
      })
      .replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(values?.[name] ?? `{{${name}}}`));
  };
  return translate;
}

const RESOURCES: Record<PdfLocale, Resources> = {
  de: { tournament: deTournament, short: deShort, sport: deSport },
  en: { tournament: enTournament, short: enShort, sport: enSport },
};

/** Übersetzer mit der echten Ressource der Sprache (für Tests, die `exportScheduleToPDF` direkt aufrufen). */
export function translatorFor(locale: PdfLocale): PdfTranslator {
  return resourceTranslator(locale, RESOURCES[locale]);
}

/** Rendert den Export und gibt Dateiname, Seitenmaße und Text je Seite zurück. Vorgabe: Deutsch. */
export async function renderSchedulePdf(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: TestPdfOptions = {},
): Promise<RenderedPdf> {
  const locale = options.locale ?? 'de';
  const withTexts: PDFExportOptions = { locale, translate: translatorFor(locale), tournament: hallencupTournament(), ...options };
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
