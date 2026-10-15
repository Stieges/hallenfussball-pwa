/**
 * Spielplan-PDF: baut das Dokument (`buildSchedulePdf`) und speichert es (`exportScheduleToPDF`).
 *
 * Aufbau in fester Reihenfolge (B-28a3-2, B-28a3-3b): Seite 1 mit Kopf (Kicker, Titel, Angaben, Regelzeilen),
 * Teilnehmer und Gruppenspielen (Überlauf auf Folgeseiten), dann Gruppentabellen (neue Seite, optional), dann
 * Finalrunde mit K.-o.-Zeilen und Platzierung (neue Seite). Jede Folgeseite trägt den Kurzkopf, jede Seite die
 * Fußzeile mit Stand und Seitenzahl (B-28 C3). Abschnittstitel tragen laufende Nummern. Leere Abschnitte entfallen.
 * A4 hoch, Vorgabe; quer über `orientation`. Die Geometrie kommt aus `layout.ts`, Farben und Maße aus
 * `design-tokens/print.ts`.
 *
 * Bauen und Speichern sind getrennt: `buildSchedulePdf` liefert das Dokument, den Dateinamen und die Hinweise
 * (Zeichen, die als „?“ erscheinen, Ersatzschrift) VOR dem Speichern (@DR-012).
 */
import i18next from 'i18next';
import jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing } from '../../types/tournament';
import { getLocationName } from '../../utils/locationHelpers';
import { qrModules, viewerUrl } from '../qr/publicQr';
import { registerPdfFonts, fontOf } from './fonts';
import { pageGeometry, startPage } from './layout';
import type { PDFExportOptions } from './pdfOptions';
import { dayOf, headerFacts, ruleFacts } from './headerFacts';
import { schedulePdfFilename } from './filename';
import { buildNotes } from './notes';
import { guardDocText } from './printable';
import { planSections, type SectionKey } from './sections';
import { closedLine, footerLine, standLine } from './standText';
import { groupPhaseOpen } from './tournamentState';
import { countFooterLines, drawFooters, type FooterContent } from './render/footer';
import { renderGroupStage } from './render/groupTables';
import type { MatchTableContext } from './render/matchTable';
import { refereeLabelFor } from './refereeLabel';
import { renderFinalsSection } from './render/finalsTables';
import { renderGroupStandings } from './render/standings';
import { placementState } from './placement';
import { renderRanking } from './render/ranking';
import { renderHeader } from './render/header';
import { usableLogo } from './render/headerGraphics';
import { drawShortHeads, shortHeadTitleLines } from './render/shortHeader';
import { renderParticipants } from './render/participants';
import { koLines, pdfRuleLines, pdfRulesFrom } from './rules';
import { buildPdfTexts, resolvePdfLocale, type PdfLocale, type PdfTexts, type PdfTranslator } from './translations';

export type { PDFExportOptions } from './pdfOptions';

/** Ergebnis des Exports: das PDF ist immer erzeugt, `notes` sind sichtbare Hinweise an den Nutzer. */
export interface SchedulePdfResult {
  notes: string[];
}

export interface SchedulePdfBuild extends SchedulePdfResult {
  doc: jsPDF;
  /** Dateiname mit Stand, z. B. `spielplan-hallencup-nord-2026-11-14-1507.pdf`. */
  filename: string;
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

/** Zeile „Kontakt: …“ nur bei übergebenem, nicht leerem Kontakt. */
function contactRow(contact: string | undefined, t: PdfTexts): string | undefined {
  const text = contact?.trim() ?? '';
  return text === '' ? undefined : t.contactLine(text);
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
    ranking = [],
    closed,
    now = new Date(),
    online = true,
    closedAt,
    contact,
    tournament,
  } = options;

  const t = buildPdfTexts(translate, locale);
  const rules = pdfRulesFrom(tournament, schedule);

  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4',
  });

  // Schrift zuerst: lädt sie nicht, gilt die Standardschrift (B6). Danach läuft der Bau ohne Warten.
  const mode = await registerPdfFonts(doc);
  guardDocText(doc, mode.covers);
  doc.setLanguage(locale);
  doc.setFont(fontOf(doc));
  // Kopfgrafiken: nur was sich lesen und zeichnen lässt; sonst fehlt die Grafik und ein Hinweis entsteht (@DR-023)
  const logoLeft = usableLogo(options.logoLeft);
  const logoRight = usableLogo(options.logoRight);
  const notes = [
    ...buildNotes(
      schedule,
      t,
      { organizer: organizerName, hall: hallName, rulebook: rules.rulebook ?? '', contact: contact?.trim() ?? '' },
      mode
    ),
    ...(options.logoLeft && !logoLeft ? [t.logoUnusable('left')] : []),
    ...(options.logoRight && !logoRight ? [t.logoUnusable('right')] : []),
  ];
  // Zuschauer-QR nur bei online geteiltem Turnier (@ZM-064)
  const url = viewerUrl(tournament);
  const qr = url === null ? undefined : { modules: qrModules(url), caption: options.viewerResultsHidden ? t.qrCaption.plan : t.qrCaption.results };

  // Fußzeile und Kurzkopf vor dem Seitenmaß messen: sie bestimmen, wo der Satzspiegel endet bzw. Folgeseiten beginnen
  const footer: FooterContent = {
    title: schedule.tournament.title,
    stand: edition === 'final' && closedAt ? closedLine(closedAt, translate) : standLine(now, online, translate),
    contact: contactRow(contact, t),
    line: (title, stand, page, total) => footerLine(title, stand, page, total, translate),
  };
  const contentWidth = pageGeometry('a4', orientation).contentWidth;
  const shortHeadTitle = shortHeadTitleLines(doc, schedule.tournament.title, contentWidth);
  const geo = pageGeometry('a4', orientation, shortHeadTitle.length, countFooterLines(doc, footer, contentWidth));

  // Abschnitte, die es in diesem Dokument gibt, in fester Reihenfolge; ihre Nummern zählen nur diese
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  const hasTables = includeStandings && schedule.teams.some(team => team.group);
  const present: SectionKey[] = [
    'participants',
    ...(groupPhase ? (['groupStage'] as const) : []),
    ...(hasTables ? (['tables'] as const) : []),
    ...(finalPhases.length > 0 ? (['finals'] as const) : []),
    'ranking',
  ];
  const sections = planSections(present, geo);
  // Jeder gegen jeden hat keine Gruppen: der Abschnitt heißt „Spiele“ (Controller, B-28a3-4)
  const groupStageName = rules.groupSystem === 'roundRobin' ? t.matches : t.groupStage;

  // Seite 1: Kopf mit Regelzeilen, Teilnehmer, Gruppenspiele (Folgeseiten bei Platzmangel)
  let yPos = renderHeader(
    doc,
    {
      kicker: edition === 'blank' ? t.kicker.blank : undefined,
      title: schedule.tournament.title,
      facts: [...headerFacts(schedule, t, organizerName, hallName), ...ruleFacts(pdfRuleLines(rules, t))],
      separator: t.rules.join,
      logoLeft,
      logoRight,
      qr,
    },
    geo
  );
  yPos = renderParticipants(doc, schedule, t, geo, yPos, sections.handle('participants'));

  // Ergebnis je Spiel aus seinem Zustand (matchResult), Schiedsrichter aus dem Plan (@DR-025)
  const tableContext: MatchTableContext = {
    t,
    geo,
    result: { edition, results: includeScores },
    refereeLabel: refereeLabelFor(schedule),
  };

  if (groupPhase) {
    yPos = renderGroupStage(doc, groupPhase.matches, tableContext, schedule.numberOfFields, geo, yPos, schedule.tournament, groupStageName, sections.handle('groupStage'));
  }

  // Gruppentabellen, eigene Seite (nur wenn es Gruppen gibt und sie gewünscht sind)
  if (hasTables) {
    yPos = renderGroupStandings(doc, schedule, standings, t, geo, startPage(doc, 'tables', geo), sections.handle('tables'));
  }

  // Finalrunde mit K.-o.-Zeilen, eigene Seite. Die Platzierung steht am Ende: mit Finalrunde auf deren Seite, ohne
  // Finalrunde (Jeder gegen jeden) direkt unter der Tabelle, wenn sie passt (Daniel 15.10.)
  if (finalPhases.length > 0) {
    yPos = renderFinalsSection(
      doc,
      finalPhases.flatMap(phase => phase.matches),
      tableContext,
      schedule.numberOfFields,
      rules.finalsConfig,
      geo,
      startPage(doc, 'finals', geo),
      koLines(rules, t),
      // Uhrzeiten der Finalrunde stehen unter Vorbehalt, solange die Gruppenphase läuft (W7)
      { section: sections.handle('finals'), tentativeNote: edition !== 'final' && closed !== true && groupPhase && groupPhaseOpen(groupPhase.matches) ? t.timesTentative : undefined }
    );
  }
  renderRanking(
    doc,
    {
      state: placementState({ edition, ranking, closed, teamCount: schedule.teams.length }),
      teamCount: schedule.teams.length,
      ranking,
      hasFinalRound: finalPhases.length > 0,
    },
    t,
    geo,
    yPos,
    sections.handle('ranking')
  );

  // Kurzkopf auf jeder Folgeseite (Altersklasse · Datum · Abschnitt oben auf der Seite), dann die Fußzeile über alle Seiten
  const sectionNames: Record<SectionKey, string> = {
    participants: t.participants,
    groupStage: groupStageName,
    tables: t.sectionTables,
    finals: t.sectionFinals,
    ranking: t.finalRanking,
  };
  drawShortHeads(doc, geo, {
    titleLines: shortHeadTitle,
    subtitleFor: page => {
      const key = sections.keyAtTop(page);
      return [schedule.tournament.ageClass, dayOf(schedule, t), key ? sectionNames[key] : ''].filter(part => part !== '').join(t.rules.join);
    },
  });
  drawFooters(doc, geo, footer);

  return { doc, notes, filename: schedulePdfFilename(schedule.tournament.title, now) };
}

/** Baut das Spielplan-PDF und speichert es. Rückgabe: Hinweise für den Nutzer (leer, wenn keine). */
export async function exportScheduleToPDF(
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  options: PDFExportOptions
): Promise<SchedulePdfResult> {
  const { doc, notes, filename } = await buildSchedulePdf({ schedule, standings, options });
  doc.save(filename);
  return { notes };
}
