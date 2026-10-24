/**
 * Ein Eingang und ein Kontext für jedes PDF (B-28 C7, Fable B10a/b): `PdfInput` bündelt, was Spielplan, Aushang und
 * später Endstand brauchen (Turnier, Plan, Zustand, Fassung, Zielgruppe, Zeit, Netz, Sprache, Grafiken). `RenderContext`
 * reicht Dokument, Seitenmaß, Texte und Schrift an die Zeichenfunktionen weiter, statt acht Positionsparameter.
 * Die Vorgaben stehen hier an einer Stelle (`toPdfInput`).
 */
import i18next from 'i18next';
import jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing, Tournament } from '../../types/tournament';
import { getLocationName } from '../../utils/locationHelpers';
import type { LogoImage } from '../images/logoBytes';
import { fontOf, registerPdfFonts, type PdfFontMode } from './fonts';
import type { PageGeometry, PdfFormat, PdfOrientation } from './layout';
import type { PDFExportOptions } from './pdfOptions';
import type { RankEntry } from './placement';
import { appTranslator } from './appTranslator';
import { guardDocText } from './printable';
import { buildPdfTexts, resolvePdfLocale, type PdfLocale, type PdfTexts, type PdfTranslator } from './translations';
import type { PdfAudience } from './visibility';

/** Eingang des Spielplan-PDFs (`schedulePdf.ts`): Plan, Tabellenstand und die Optionen des Aufrufers. */
export interface SchedulePdfInput {
  schedule: GeneratedSchedule;
  standings: Standing[] | undefined;
  options: PDFExportOptions;
}

/** Eingang aller PDFs, Vorgaben aufgelöst. */
export interface PdfInput {
  tournament: Tournament;
  schedule: GeneratedSchedule;
  /** Zustand: Tabellenstand, gespeicherter Endstand, Abschluss. */
  state: { standings: Standing[] | undefined; ranking: RankEntry[]; closed: boolean | undefined; closedAt: Date | undefined };
  edition: 'plan' | 'blank' | 'final';
  audience: PdfAudience;
  now: Date;
  online: boolean;
  locale: PdfLocale;
  /** Übersetzer der Sprache `locale`. */
  translate: PdfTranslator;
  graphics: { left: LogoImage | undefined; right: LogoImage | undefined };
  orientation: PdfOrientation;
  viewerBaseUrl: string | undefined;
  /** Wünsche des Dialogs und Angaben des Veranstalters (nur Spielplan). */
  wish: { standings: boolean; scores: boolean; viewerResultsHidden: boolean };
  organizerName: string;
  hallName: string;
  contact: string | undefined;
}

/** Löst die Vorgaben des Aufrufers auf: ein Ort für jede Vorgabe, gleich für jedes Dokument. */
export function toPdfInput({ schedule, standings, options }: SchedulePdfInput): PdfInput {
  // Einzige Stelle, an der die App-Sprache einfließt (nur wenn der Aufrufer keine Sprache wählt); danach gilt nur `input.locale`
  const locale = options.locale ?? resolvePdfLocale(i18next.language);
  return {
    tournament: options.tournament,
    schedule,
    state: { standings, ranking: options.ranking ?? [], closed: options.closed, closedAt: options.closedAt },
    edition: options.edition ?? 'plan',
    audience: options.audience ?? 'organizer',
    now: options.now ?? new Date(),
    online: options.online ?? true,
    locale,
    translate: options.translate ?? appTranslator(locale),
    graphics: { left: options.logoLeft, right: options.logoRight },
    orientation: options.orientation ?? 'portrait',
    viewerBaseUrl: options.viewerBaseUrl,
    wish: { standings: options.includeStandings ?? true, scores: options.includeScores ?? false, viewerResultsHidden: options.viewerResultsHidden === true },
    organizerName: options.organizerName ?? schedule.tournament.organizer ?? '',
    hallName: options.hallName ?? getLocationName(schedule.tournament),
    contact: options.contact,
  };
}

/** Das geöffnete Dokument mit Schrift und Texten, vor dem Seitenmaß. */
export interface OpenedDocument {
  doc: jsPDF;
  t: PdfTexts;
  font: string;
  mode: PdfFontMode;
}

/** Was jede Zeichenfunktion braucht: Dokument, Seitenmaß, Texte, Schrift. */
export interface RenderContext {
  doc: jsPDF;
  geo: PageGeometry;
  t: PdfTexts;
  font: string;
}

/** Öffnet ein Dokument im Format: Schrift zuerst (lädt sie nicht, gilt die Standardschrift), Zeichenschutz, Sprache. */
export async function openDocument(input: PdfInput, format: PdfFormat = 'a4'): Promise<OpenedDocument> {
  const doc = new jsPDF({ orientation: input.orientation, unit: 'mm', format });
  const mode = await registerPdfFonts(doc);
  guardDocText(doc, mode.covers);
  doc.setLanguage(input.locale);
  doc.setFont(fontOf(doc));
  return { doc, t: buildPdfTexts(input.translate, input.locale), font: fontOf(doc), mode };
}

/** Kontext aus dem geöffneten Dokument und dem Seitenmaß. */
export function renderContext(opened: OpenedDocument, geo: PageGeometry): RenderContext {
  return { doc: opened.doc, geo, t: opened.t, font: opened.font };
}
