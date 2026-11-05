/**
 * Fertige Handzettel-PDFs für die Zeichentests (T7a): ein Fall der Mockup-Runde 2 (`fixtures/handzettelFaelle.ts`) geht
 * durch `buildSchedulePdf`, gelesen wird über pdfjs (`pdfjsLayout`). Feste Zeit, feste Schrift: die Erwartungen rechnen
 * sich von Hand nach. Nur für Tests.
 */
import type { Standing, Tournament } from '../../../types/tournament';
import { buildSchedulePdf } from '../schedulePdf';
import type { PDFExportOptions } from '../pdfOptions';
import { withTournamentState } from '../tournamentState';
import type { PdfLocale } from '../translations';
import { FALL_NOW, type HandzettelFall } from './fixtures/handzettelFaelle';
import { fallSchedule, fallTournament } from './fixtures/handzettelTurnier';
import { readLayout, readMetadata, type LayoutMeta, type LayoutPage } from './pdfjsLayout';
import { translatorFor } from './pdfText';

export const BASE_URL = 'https://hallenfussball-pwa.vercel.app';

export interface HandzettelOptions {
  locale?: PdfLocale;
  tournament?: Partial<Tournament>;
  options?: Partial<PDFExportOptions>;
  /** Tabellenstand wie im Dialog (`calculateStandingsPerGroup`); ohne Angabe der Anfangsstand. */
  standings?: Standing[];
}

export interface HandzettelPdf {
  bytes: Uint8Array;
  pages: LayoutPage[];
  meta: LayoutMeta;
  /** Dateiname, Hinweise und Seitenzahl des Dokuments. */
  notes: string[];
}

/** Baut den Fall als PDF und liest ihn zurück. */
export async function handzettelPdf(fall: HandzettelFall, opts: HandzettelOptions = {}): Promise<HandzettelPdf> {
  const locale = opts.locale ?? 'de';
  const tournament = fallTournament(fall, opts.tournament ?? {});
  const schedule = withTournamentState(fallSchedule(fall, locale, opts.tournament ?? {}), tournament);
  const { doc, notes } = await buildSchedulePdf({
    schedule,
    standings: opts.standings,
    options: {
      tournament, locale, translate: translatorFor(locale), now: FALL_NOW, viewerBaseUrl: BASE_URL,
      hallName: fall.halle, organizerName: fall.veranstalter, ...(fall.kontakt === undefined ? {} : { contact: fall.kontakt }), ...opts.options,
    },
  });
  const bytes = new Uint8Array(doc.output('arraybuffer'));
  return { bytes, pages: await readLayout(bytes), meta: await readMetadata(bytes), notes };
}
