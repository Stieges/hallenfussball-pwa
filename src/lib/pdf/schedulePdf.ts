/**
 * Spielplan-PDF: baut das Dokument (`buildSchedulePdf`) und speichert es (`exportScheduleToPDF`).
 *
 * Aufbau in fester Reihenfolge (B-28a3-2, B-28a3-3b): Seite 1 mit Kopf (Kicker, Titel, Angaben, Regelzeilen),
 * Teilnehmer und Gruppenspielen (Überlauf auf Folgeseiten), dann Gruppentabellen (neue Seite, optional), dann
 * Finalrunde mit K.-o.-Zeilen und Platzierung (neue Seite). Jede Folgeseite trägt den Kurzkopf. Leere Abschnitte
 * entfallen. A4 hoch, Vorgabe; quer über `orientation`. Die Geometrie kommt aus `layout.ts`, Farben und Maße aus
 * `design-tokens/print.ts`.
 */
import i18next from 'i18next';
import jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing, Tournament } from '../../types/tournament';
import { getLocationAddressLine, getLocationName } from '../../utils/locationHelpers';
import { registerPdfFonts, PDF_FONT, unrenderableChars } from './fonts';
import { drawPageNumbers, pageGeometry, startPage, type PdfOrientation } from './layout';
import { renderGroupStage } from './render/matchTables';
import { renderFinalsSection } from './render/finalsTables';
import { renderGroupStandings, renderFinalRanking } from './render/standings';
import { renderHeader, type HeaderFact } from './render/header';
import { drawShortHeads, shortHeadTitleLines } from './render/shortHeader';
import { renderParticipants } from './render/participants';
import { koLines, pdfRuleLines, pdfRulesFrom } from './rules';
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
  /**
   * Fassung (B-28a3-3b, @BM-052): `plan` = „Spielplan“ (Vorgabe), `blank` = „Spielplan zum Ausfüllen“. Nur der Wunsch
   * des Nutzers ergibt `blank`; ohne Ergebnisse allein bleibt es bei `plan`.
   */
  edition?: 'plan' | 'blank';
  /** Turnier für die Regelzeilen im Kopf und die K.-o.-Zeilen (B-28a3-3b, Fixrunde W6). Pflicht. */
  tournament: Tournament;
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
  options: PDFExportOptions;
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

/** Angaben im Kopf: Veranstalter (nur wenn angegeben), Halle mit Adresse, Spieltag, Zeit. */
function headerFacts(schedule: GeneratedSchedule, t: PdfTexts, organizerName: string, hallName: string): HeaderFact[] {
  const facts: HeaderFact[] = [];
  if (organizerName) {
    facts.push({ label: t.organizer, value: organizerName });
  }
  facts.push({ label: t.ageClass, value: schedule.tournament.ageClass });
  const address = getLocationAddressLine(schedule.tournament);
  facts.push({ label: t.hall, value: address ? `${hallName}, ${address}` : hallName });
  // Datum als TT.MM.JJJJ: bereits so gespeichert unverändert, sonst über Intl in der Sprache des Dokuments
  const date = schedule.tournament.date;
  const gameday = !date ? t.noDate : date.includes('.') ? date : t.formatDate(date);
  facts.push({ label: t.gameday, value: gameday });
  facts.push({ label: t.time, value: `${t.formatClock(schedule.startTime)} - ${t.formatClock(schedule.endTime)}` });
  return facts;
}

/** Regelzeilen aus `pdfRuleLines` („Bezeichnung: Wert“) als Zeilen der Angabentabelle (Daniel 15.10., v7.2). */
function ruleFacts(lines: string[]): HeaderFact[] {
  return lines.map(line => {
    const cut = line.indexOf(': ');
    return cut < 0 ? { label: line, value: '' } : { label: line.slice(0, cut), value: line.slice(cut + 2) };
  });
}

/** Baut das Spielplan-PDF, ohne es zu speichern. */
export async function buildSchedulePdf({ schedule, standings, options }: SchedulePdfInput): Promise<SchedulePdfBuild> {
  const {
    locale = resolvePdfLocale(i18next.language),
    translate = appTranslator(locale),
    includeStandings = true,
    includeScores = false,
    organizerName = schedule.tournament.organizer ?? '',
    hallName = getLocationName(schedule.tournament),
    orientation = 'portrait',
    edition = 'plan',
    tournament,
  } = options;

  const t = buildPdfTexts(translate, locale);
  const notes = unrenderableNotes(schedule, t, organizerName, hallName);
  const rules = pdfRulesFrom(tournament, schedule);

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  await registerPdfFonts(doc);
  doc.setLanguage(locale);
  doc.setFont(PDF_FONT.family);

  // Kurzkopf vor dem Seitenmaß messen: er bestimmt, wo Folgeseiten unter ihm beginnen
  const shortHead = {
    titleLines: shortHeadTitleLines(doc, schedule.tournament.title, pageGeometry('a4', orientation).contentWidth),
    subtitle: schedule.tournament.ageClass,
  };
  const geo = pageGeometry('a4', orientation, shortHead.titleLines.length);

  // Seite 1: Kopf mit Regelzeilen, Teilnehmer, Gruppenspiele (Folgeseiten bei Platzmangel)
  let yPos = renderHeader(
    doc,
    {
      kicker: edition === 'blank' ? t.kicker.blank : undefined,
      title: schedule.tournament.title,
      facts: [...headerFacts(schedule, t, organizerName, hallName), ...ruleFacts(pdfRuleLines(rules, t))],
    },
    geo
  );
  yPos = renderParticipants(doc, schedule, t, geo, yPos);

  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  if (groupPhase) {
    renderGroupStage(
      doc,
      groupPhase.matches,
      t,
      schedule.numberOfFields,
      includeScores,
      geo,
      yPos,
      schedule.tournament,
      // Jeder gegen jeden hat keine Gruppen: der Abschnitt heißt „Spiele“ (Controller, B-28a3-4)
      rules.groupSystem === 'roundRobin' ? t.matches : t.groupStage
    );
  }

  // Gruppentabellen, eigene Seite (nur wenn es Gruppen gibt und sie gewünscht sind)
  const hasGroups = schedule.teams.some(team => team.group);
  if (hasGroups && includeStandings) {
    yPos = startPage(doc, 'tables', geo);
    renderGroupStandings(doc, schedule, standings, t, geo, yPos);
  }

  // Finalrunde mit K.-o.-Zeilen, eigene Seite. Die Platzierung steht immer am Ende.
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  yPos = startPage(doc, 'finals', geo);
  if (finalPhases.length > 0) {
    yPos = renderFinalsSection(
      doc,
      finalPhases.flatMap(phase => phase.matches),
      t,
      schedule.numberOfFields,
      includeScores,
      geo,
      yPos,
      koLines(rules, t)
    );
  }
  renderFinalRanking(doc, schedule, standings, t, geo, yPos);

  // Kurzkopf auf jeder Folgeseite, dann die Seitenzahlen über alle Seiten
  drawShortHeads(doc, geo, shortHead);
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
  options: PDFExportOptions
): Promise<SchedulePdfResult> {
  const { doc, notes } = await buildSchedulePdf({ schedule, standings, options });
  doc.save(schedulePdfFilename(schedule));
  return { notes };
}
