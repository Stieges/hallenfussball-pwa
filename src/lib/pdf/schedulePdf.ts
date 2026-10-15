/**
 * Spielplan-PDF: baut das Dokument (`buildSchedulePdf`) und speichert es (`exportScheduleToPDF`).
 *
 * Aufbau in fester Reihenfolge (B-28a3-2): Seite 1 mit Kopf, Meta-Box, Hinweis, Teilnehmer und Gruppenspielen
 * (Überlauf auf Folgeseiten), dann Gruppentabellen (neue Seite, optional), dann Finalrunde mit Platzierung (neue Seite).
 * Leere Abschnitte entfallen. A4 hoch, Vorgabe; quer über `orientation`. Die Geometrie kommt aus `layout.ts`,
 * Farben und Maße aus `design-tokens/print.ts`.
 */
import i18next from 'i18next';
import jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing } from '../../types/tournament';
import { getLocationName } from '../../utils/locationHelpers';
import { registerPdfFonts, PDF_FONT, unrenderableChars } from './fonts';
import { drawPageNumbers, pageGeometry, startPage, type PdfOrientation } from './layout';
import { renderGroupStage } from './render/matchTables';
import { renderFinalsSection } from './render/finalsTables';
import { renderGroupStandings, renderFinalRanking } from './render/standings';
import { renderHeader } from './render/header';
import { renderHints } from './render/hints';
import { renderMetaBox } from './render/metaBox';
import { renderParticipants } from './render/participants';
import {
  buildPdfTexts,
  resolvePdfLocale,
  type PdfLocale,
  type PdfTexts,
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
  /** Ausrichtung des A4-Blatts. Vorgabe: hoch. */
  orientation?: PdfOrientation;
}

/** Ergebnis des Exports: das PDF ist immer erzeugt, `notes` sind sichtbare Hinweise an den Nutzer. */
export interface SchedulePdfResult {
  notes: string[];
}

export interface SchedulePdfBuild extends SchedulePdfResult {
  doc: jsPDF;
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

/**
 * Hinweise auf Zeichen, die die eingebettete Schrift nicht trägt: gedruckte Freitexte (Turniername, Altersklasse,
 * Veranstalter, Halle) und Teamnamen (B-28a2, Daniel 14.10.; Fixrunde F8).
 */
export function unrenderableNotes(
  schedule: GeneratedSchedule,
  t: PdfTexts,
  organizerName: string,
  hallName: string
): string[] {
  const fields: Array<[label: string, text: string]> = [
    [t.tournamentTitle, schedule.tournament.title],
    [t.ageClass, schedule.tournament.ageClass],
    [t.organizer, organizerName],
    [t.hall, hallName],
  ];
  const notes = fields
    .filter(([, text]) => text !== '' && unrenderableChars(text).length > 0)
    .map(([label, text]) => t.unrenderableField(label, text));
  const teamNotes = schedule.teams
    .filter(team => unrenderableChars(team.name).length > 0)
    .map(team => t.unrenderableName(team.name));
  return [...notes, ...teamNotes];
}

/** Baut das Spielplan-PDF, ohne es zu speichern. */
export async function buildSchedulePdf({ schedule, standings, options = {} }: SchedulePdfInput): Promise<SchedulePdfBuild> {
  const {
    locale = resolvePdfLocale(i18next.language),
    translate = appTranslator(locale),
    includeStandings = true,
    includeScores = false,
    organizerName = schedule.tournament.organizer ?? '',
    hallName = getLocationName(schedule.tournament),
    orientation = 'portrait',
  } = options;

  const t = buildPdfTexts(translate, locale);
  const notes = unrenderableNotes(schedule, t, organizerName, hallName);
  const geo = pageGeometry('a4', orientation);
  const shortHead = { title: schedule.tournament.title, subtitle: schedule.tournament.ageClass };

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  await registerPdfFonts(doc);
  doc.setLanguage(locale);
  doc.setFont(PDF_FONT.family);

  // Seite 1: Kopf, Meta-Box, Hinweis, Teilnehmer, Gruppenspiele (Folgeseiten bei Platzmangel)
  let yPos = startPage(doc, 'participantsAndGroups', geo);
  yPos = renderHeader(doc, schedule, geo, yPos);
  yPos = renderMetaBox(doc, schedule, t, organizerName, hallName, geo, yPos);
  yPos = renderHints(doc, t, geo, yPos);

  const hasGroups = schedule.teams.some(team => team.group);
  yPos = renderParticipants(doc, schedule, t, geo, yPos);

  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  if (groupPhase) {
    renderGroupStage(
      doc,
      groupPhase.matches,
      t,
      schedule.refereeConfig,
      schedule.numberOfFields,
      includeScores,
      geo,
      yPos,
      schedule.tournament,
      shortHead
    );
  }

  // Gruppentabellen, eigene Seite (nur wenn es Gruppen gibt und sie gewünscht sind)
  if (hasGroups && includeStandings) {
    yPos = startPage(doc, 'tables', geo);
    renderGroupStandings(doc, schedule, standings, t, geo, yPos);
  }

  // Finalrunde und Platzierung, eigene Seite. Die Platzierung steht immer am Ende.
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  yPos = startPage(doc, 'finals', geo);
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
  renderFinalRanking(doc, schedule, standings, t, geo, yPos);

  drawPageNumbers(doc, geo, t.pageOf);

  return { doc, notes };
}

/** Dateiname `<Titel>_Spielplan.pdf`, Leerzeichen durch Unterstriche. */
export function schedulePdfFilename(schedule: GeneratedSchedule): string {
  return `${schedule.tournament.title.replace(/\s+/g, '_')}_Spielplan.pdf`;
}

/** Baut das Spielplan-PDF und speichert es. Rückgabe: Hinweise für den Nutzer (leer, wenn keine). */
export async function exportScheduleToPDF(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: PDFExportOptions = {}
): Promise<SchedulePdfResult> {
  const { doc, notes } = await buildSchedulePdf({ schedule, standings, options });
  doc.save(schedulePdfFilename(schedule));
  return { notes };
}
