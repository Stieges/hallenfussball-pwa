/**
 * Spielplan-PDF: baut das Dokument (`buildSchedulePdf`) und speichert es (`exportScheduleToPDF`).
 *
 * Aufbau: Kopf, Meta-Box, Hinweis, Teilnehmer, Gruppenphase, Gruppentabellen (optional), Finalrunde,
 * Platzierung. A4 hoch. Die Geometrie kommt aus `layout.ts`, Farben und Maße aus `design-tokens/print.ts`.
 */
import i18next from 'i18next';
import jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing } from '../../types/tournament';
import { getLocationName } from '../../utils/locationHelpers';
import { pageGeometry } from './layout';
import { renderGroupStage, renderFinalsSection } from './render/matchTables';
import { renderGroupStandings, renderFinalRanking } from './render/standings';
import { renderHeader } from './render/header';
import { renderHints } from './render/hints';
import { renderMetaBox } from './render/metaBox';
import { renderParticipants } from './render/participants';
import {
  buildPdfTexts,
  resolvePdfLocale,
  type PdfLocale,
  type PdfTranslator,
} from './translations';

export interface PDFExportOptions {
  /** Sprache des Dokuments. Vorgabe: Sprache der App. */
  locale?: PdfLocale;
  /** Übersetzer für `pdf.*`. Vorgabe: i18next der App; Tests reichen die Ressource durch. */
  translate?: PdfTranslator;
  includeStandings?: boolean;
  includeScores?: boolean;
  organizerName?: string;
  hallName?: string;
}

export interface SchedulePdfInput {
  schedule: GeneratedSchedule;
  standings: Standing[] | undefined;
  options?: PDFExportOptions;
}

/** Übersetzer der App: i18next, Namespace `tournament`, Sprache des Dokuments. */
function appTranslator(locale: PdfLocale): PdfTranslator {
  // Fehlt ein Schlüssel, erscheint der Schlüssel selbst (sichtbar statt still leer).
  return (key, values) => i18next.t(key, key, { ns: 'tournament', lng: locale, ...values });
}

/** Baut das Spielplan-PDF, ohne es zu speichern. */
export async function buildSchedulePdf({ schedule, standings, options = {} }: SchedulePdfInput): Promise<jsPDF> {
  const {
    locale = resolvePdfLocale(i18next.language),
    translate = appTranslator(locale),
    includeStandings = true,
    includeScores = false,
    organizerName = schedule.tournament.organizer ?? '',
    hallName = getLocationName(schedule.tournament),
  } = options;

  const t = buildPdfTexts(translate, locale);
  const geo = pageGeometry('a4', 'portrait');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  doc.setLanguage(locale);
  doc.setFont('helvetica');

  let yPos = geo.top;

  // 1. Kopf
  yPos = renderHeader(doc, schedule, geo, yPos);

  // 2. Meta-Box
  yPos = renderMetaBox(doc, schedule, t, organizerName, hallName, geo, yPos);

  // 3. Hinweis
  yPos = renderHints(doc, t, geo, yPos);

  // 4. Teilnehmer
  const hasGroups = schedule.teams.some(team => team.group);
  yPos = renderParticipants(doc, schedule, t, geo, yPos);

  // 5. Gruppenphase
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  if (groupPhase) {
    yPos = renderGroupStage(
      doc,
      groupPhase.matches,
      t,
      schedule.refereeConfig,
      schedule.numberOfFields,
      includeScores,
      geo,
      yPos,
      schedule.tournament
    );
  }

  // 6. Gruppentabellen
  if (hasGroups && includeStandings) {
    yPos = renderGroupStandings(doc, schedule, standings, t, geo, yPos);
  }

  // 7. Finalrunde, eine Tabelle je Phase
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  if (finalPhases.length > 0) {
    yPos = renderFinalsSection(
      doc,
      finalPhases,
      t,
      schedule.refereeConfig,
      schedule.numberOfFields,
      includeScores,
      geo,
      yPos
    );
  }

  // 8. Platzierung ganz am Ende
  renderFinalRanking(doc, schedule, standings, t, geo, yPos);

  return doc;
}

/** Dateiname `<Titel>_Spielplan.pdf`, Leerzeichen durch Unterstriche. */
export function schedulePdfFilename(schedule: GeneratedSchedule): string {
  return `${schedule.tournament.title.replace(/\s+/g, '_')}_Spielplan.pdf`;
}

/** Baut das Spielplan-PDF und speichert es. */
export async function exportScheduleToPDF(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: PDFExportOptions = {}
): Promise<void> {
  const doc = await buildSchedulePdf({ schedule, standings, options });
  doc.save(schedulePdfFilename(schedule));
}
