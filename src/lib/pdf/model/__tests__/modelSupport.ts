/**
 * Gemeinsame Bausteine der Modelltests (T6): Seitenmodell eines Handzettel-Falls mit fester Fake-Messfunktion oder mit der
 * echten Schrift. Der Eingang ist der echte aufgelöste `PdfInput` (`toPdfInput`), nur die Messung ist ersetzbar.
 */
import type { GeneratedSchedule } from '../../../../core/generators';
import type { Tournament } from '../../../../types/tournament';
import { printHeader } from '../../../../design-tokens/print-header';
import { qrModules } from '../../../qr/publicQr';
import { pageGeometry, type PageGeometry } from '../../layout';
import { toPdfInput } from '../../pdfInput';
import { withTournamentState } from '../../tournamentState';
import type { PDFExportOptions } from '../../pdfOptions';
import { buildPdfTexts, type PdfLocale, type PdfTexts } from '../../translations';
import { FALL_NOW, type HandzettelFall } from '../../__tests__/fixtures/handzettelFaelle';
import { FAKE_MEASURE } from '../../__tests__/fixtures/fakeMeasure';
import { fallSchedule, fallTournament } from '../../__tests__/fixtures/handzettelTurnier';
import { translatorFor } from '../../__tests__/pdfText';
import { qrBoxSide } from '../headerModel';
import type { TextMeasure } from '../measure';
import { buildScheduleModel } from '../scheduleModel';
import type { ScheduleModel } from '../types';

export const BASE_URL = 'https://hallenfussball-pwa.vercel.app';

export interface ModelCase {
  model: ScheduleModel;
  geo: PageGeometry;
  schedule: GeneratedSchedule;
  tournament: Tournament;
  t: PdfTexts;
}

export interface ModelOptions {
  measure?: TextMeasure;
  locale?: PdfLocale;
  tournament?: Partial<Tournament>;
  options?: Partial<PDFExportOptions>;
  graphicsAspect?: { left?: number; right?: number };
  /** Geometrie-Eingriff, z. B. weniger Platz auf der Seite. */
  geo?: (geo: PageGeometry) => PageGeometry;
}

/** Seiten der Gruppenspiele (Seite 1 und ihre Folgeseiten); danach folgen Tabellen, Finalrunde und Platzierung (T7b). */
export const matchPages = (model: ScheduleModel): ScheduleModel['pages'] => model.pages.filter(page => page.section === 'matches');

export function modelOf(fall: HandzettelFall, opts: ModelOptions = {}): ModelCase {
  const locale = opts.locale ?? 'de';
  const tournament = fallTournament(fall, opts.tournament ?? {});
  const schedule = withTournamentState(fallSchedule(fall, locale, opts.tournament ?? {}), tournament);
  const options: PDFExportOptions = {
    tournament, locale, translate: translatorFor(locale), now: FALL_NOW, viewerBaseUrl: BASE_URL,
    hallName: fall.halle, organizerName: fall.veranstalter, ...opts.options,
  };
  const input = toPdfInput({ schedule, standings: undefined, options });
  const t = buildPdfTexts(input.translate, locale);
  const url = tournament.isPublic === true && tournament.shareCode ? `${BASE_URL}/#/live/${tournament.shareCode}` : undefined;
  const modules = url ? qrModules(url).length : 0;
  const base = pageGeometry('a4', 'portrait', 1, url ? 2 : 1, url ? qrBoxSide(modules, printHeader.qrEdgeShort) : 0);
  const geo = opts.geo ? opts.geo(base) : base;
  const model = buildScheduleModel(
    { input, geo, t, graphicsAspect: opts.graphicsAspect ?? {}, ...(url ? { qr: { url, modules } } : {}) },
    opts.measure ?? FAKE_MEASURE
  );
  return { model, geo, schedule, tournament, t };
}
