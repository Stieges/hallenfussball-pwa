/**
 * Spielplan-PDF: baut das Dokument (`buildSchedulePdf`) und speichert es (`exportScheduleToPDF`).
 *
 * Aufbau in fester Reihenfolge (@DR-002): Seite 1 mit Kopf (Titel, Eckdaten, Regelzeile, QR) und Gruppenspielen
 * (Überlauf auf Folgeseiten mit wiederholtem Spaltenkopf), dann Gruppentabellen (neue Seite, optional), dann Finalrunde
 * mit K.-o.-Zeilen und Platzierung (neue Seite). Seite 1 und die Folgeseiten der Gruppenspiele baut das Seitenmodell
 * (`model/*`, T6) und zeichnet `render/pageHeader.ts` und `render/matchRowsDraw.ts` 1:1 (T7a); Tabellen, Finalrunde und
 * Platzierung zeichnet bis T7b der Bestand. Jede Folgeseite trägt den Kurzkopf, jede Seite die Fußzeile mit Stand,
 * Seitenzahl und Adresse. Immer A4 hoch (@DR-026), auch wenn quer angefordert wird. Maße aus `design-tokens/print*.ts`.
 *
 * Bauen und Speichern sind getrennt: `buildSchedulePdf` liefert das Dokument, den Dateinamen und die Hinweise
 * (Zeichen, die als „?“ erscheinen, Ersatzschrift) VOR dem Speichern (@DR-012).
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing } from '../../types/tournament';
import { getGroupDisplayName } from '../../utils/displayNames';
import { fontOf } from './fonts';
import { qrModules, shortViewerAddress } from '../qr/publicQr';
import { ascentMm, pageGeometry, startPage } from './layout';
import type { PDFExportOptions, PdfAccent } from './pdfOptions';
import { openDocument, toPdfInput, type SchedulePdfInput } from './pdfInput';
import { dayOf } from './headerFacts';
import { schedulePdfFilename } from './filename';
import { buildHints, hintNotes, type PdfHints } from './notes';
import { planSections, type SectionKey } from './sections';
import { closedLine, footerLine, standLine } from './standText';
import { groupPhaseOpen } from './tournamentState';
import { pdfContentRules } from './visibility';
import { countFooterLines, drawFooters, type FooterContent } from './render/footer';
import type { MatchTableContext } from './render/matchTable';
import { refereeLabelFor } from './refereeLabel';
import { renderFinalsSection } from './render/finalsTables';
import { renderGroupStandings } from './render/standings';
import { renderBlankStandings } from './render/blankStandings';
import { placementState } from './placement';
import { renderRanking } from './render/ranking';
import { drawMatchRows } from './render/matchRowsDraw';
import { drawPageHeader, type HeaderPictures } from './render/pageHeader';
import { drawLinks } from './render/links';
import { usableLogo } from './render/headerGraphics';
import { printGap, printType } from '../../design-tokens/print';
import { printHeader } from '../../design-tokens/print-header';
import { qrSide } from './render/qrCode';
import { drawShortHeads, shortHeadTitleLines, shortQrColumn } from './render/shortHeader';
import { jspdfMeasure } from './model/measure';
import { buildScheduleModel } from './model/scheduleModel';
import type { PageModel } from './model/types';
import { koLines, pdfRulesFrom, placementLine } from './rules';
import type { PdfTexts } from './translations';
import { ageClassText } from '../../core/view';

export type { PDFExportOptions } from './pdfOptions';

/** Ergebnis des Exports: das PDF ist immer erzeugt, `notes` sind sichtbare Hinweise an den Nutzer. */
export interface SchedulePdfResult {
  notes: string[];
}

export interface SchedulePdfBuild extends SchedulePdfResult {
  doc: jsPDF;
  /** Die Hinweise strukturiert (Original und Gedrucktes), für den Dialog vor dem Speichern (@DR-012, @DR-027). `notes` sind dieselben als Sätze. */
  hints: PdfHints;
  /** Dateiname mit Stand, z. B. `Hallencup_Nord_Spielplan_2026-11-14_1507.pdf`. */
  filename: string;
}

export type { SchedulePdfInput } from './pdfInput';

/** Zeile „Ansprechpartner: …“ nur bei übergebenem, nicht leerem Kontakt. */
function contactRow(contact: string | undefined, t: PdfTexts): string | undefined {
  const text = contact?.trim() ?? '';
  return text === '' ? undefined : t.contactLine(text);
}

/** Eine Seite des Seitenmodells zeichnen: Blöcke in Modellreihenfolge, dann ihre Links (@DR-038). */
function drawModelPage(doc: jsPDF, page: PageModel, pictures: HeaderPictures, qr: boolean[][] | undefined, accent: PdfAccent): void {
  for (const block of page.blocks) {
    if (block.kind === 'header') {
      drawPageHeader(doc, block, pictures, qr, accent);
    } else if (block.kind === 'matchRows') {
      drawMatchRows(doc, block, accent);
    }
  }
  drawLinks(doc, page.links);
}

/** Baut das Spielplan-PDF, ohne es zu speichern. */
export async function buildSchedulePdf(source: SchedulePdfInput): Promise<SchedulePdfBuild> {
  const { schedule, options } = source;
  // Immer A4 hoch (@DR-026, Lücke L3): Querformat ist MVP+, eine Anforderung „quer“ ändert nichts
  const input = { ...toPdfInput(source), orientation: 'portrait' as const };
  const { tournament, translate, edition, audience, now, online, orientation, contact, organizerName, hallName } = input;
  const { ranking, closed, closedAt, standings } = input.state;

  const rules = pdfRulesFrom(tournament, schedule);
  // Sichtbarkeit an einer Stelle (C5): die Schalter des Turniers begrenzen den Wunsch des Dialogs
  const content = pdfContentRules(tournament, audience, options.viewerBaseUrl);
  const includeStandings = input.wish.standings && content.tables;
  const includeScores = input.wish.scores && content.results;

  // Schrift zuerst: lädt sie nicht, gilt die Standardschrift (B6). Danach läuft der Bau ohne Warten.
  const { doc, t, mode } = await openDocument(input);
  // Kopfgrafiken: nur was sich lesen und zeichnen lässt; sonst fehlt die Grafik und ein Hinweis entsteht (@DR-023)
  const logoLeft = usableLogo(options.logoLeft);
  const logoRight = usableLogo(options.logoRight);
  const hints = buildHints({
    fields: [
      [t.tournamentTitle, schedule.tournament.title],
      [t.ageClass, ageClassText(schedule.tournament.ageClass)],
      [t.organizer, organizerName],
      [t.hall, hallName],
      [t.rules.label.rulebook, rules.rulebook ?? ''],
      [t.contact, contact?.trim() ?? ''],
    ],
    teamNames: schedule.teams.map(team => team.name),
    mode,
    logoFailures: [...(options.logoLeft && !logoLeft ? (['left'] as const) : []), ...(options.logoRight && !logoRight ? (['right'] as const) : [])],
  });
  const notes = hintNotes(hints, t);
  // Zuschauer-QR nur bei online geteiltem Turnier (@ZM-064)
  const qr = content.qrUrl === null ? undefined : { url: content.qrUrl, modules: qrModules(content.qrUrl) };

  // Fußzeile und Kurzkopf vor dem Seitenmaß messen: sie bestimmen, wo der Satzspiegel endet bzw. Folgeseiten beginnen
  const footer: FooterContent = {
    title: schedule.tournament.title,
    stand: edition === 'final' && closedAt ? closedLine(closedAt, translate) : standLine(now, online, translate),
    contact: contactRow(contact, t),
    line: (title, stand, page, total) => footerLine(title, stand, page, total, translate),
    ...(qr ? { link: { prefix: t.sheet.footerLink, address: shortViewerAddress(qr.url), url: qr.url } } : {}),
  };
  const contentWidth = pageGeometry('a4', orientation).contentWidth;
  const shortHeadTitle = shortHeadTitleLines(doc, schedule.tournament.title, contentWidth - shortQrColumn(qr?.modules));
  const geo = pageGeometry('a4', orientation, shortHeadTitle.length, countFooterLines(doc, footer, contentWidth), qr ? qrSide(qr.modules.length, printHeader.qrEdgeShort) : 0);

  // Abschnitte, die es in diesem Dokument gibt, in fester Reihenfolge; ihre Nummern zählen nur diese
  const groupPhase = schedule.phases.find(p => p.name === 'groupStage');
  const finalPhases = schedule.phases.filter(p => p.name !== 'groupStage');
  const placement = placementState({ edition, ranking, closed, teamCount: schedule.teams.length });
  // Jeder gegen jeden in einer Gruppe ohne Finalrunde, abgeschlossen (@DR-009): die Tabelle heißt „Abschlusstabelle“ und
  // ist die Platzierung, der Block „Platzierung“ entfällt. Vorher und in der Fassung zum Ausfüllen bleibt er.
  const singleGroup = new Set(schedule.teams.map(team => team.group).filter(Boolean)).size <= 1;
  const finalTable = includeStandings && placement === 'final' && finalPhases.length === 0 && singleGroup;
  const hasTables = includeStandings && (finalTable || schedule.teams.some(team => team.group));
  const present: SectionKey[] = [
    ...(hasTables ? (['tables'] as const) : []),
    ...(finalPhases.length > 0 ? (['finals'] as const) : []),
    ...(finalTable || !content.tables ? [] : (['ranking'] as const)),
  ];
  const sections = planSections(present, geo);
  // Jeder gegen jeden hat keine Gruppen: der Abschnitt heißt „Spiele“ (Controller, B-28a3-4)
  const groupStageName = rules.groupSystem === 'roundRobin' ? t.matches : t.groupStage;

  // Seitenmodell (T6): Seite 1 mit Kopf und Gruppenspielen, dazu ihre Folgeseiten; gezeichnet wird es 1:1 (T7a)
  const model = buildScheduleModel(
    {
      input,
      geo,
      t,
      graphicsAspect: { ...(logoLeft ? { left: logoLeft.w / logoLeft.h } : {}), ...(logoRight ? { right: logoRight.w / logoRight.h } : {}) },
      ...(qr ? { qr: { url: qr.url, modules: qr.modules.length } } : {}),
    },
    jspdfMeasure(doc, fontOf(doc))
  );
  // Titel und Sprache der Datei (@DR-039); die Sprache setzt `openDocument`
  doc.setDocumentProperties({ title: model.meta.title });
  model.pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
    }
    drawModelPage(doc, page, { left: logoLeft, right: logoRight }, qr?.modules, input.accent);
  });
  const lastBlock = model.pages.at(-1)?.blocks.at(-1);
  let yPos = lastBlock ? lastBlock.top + lastBlock.height + printGap.sectionGap + ascentMm(printType.h2) : geo.top;

  // Ergebnis je Spiel aus seinem Zustand (matchResult), Schiedsrichter aus dem Plan (@DR-025)
  const tableContext: MatchTableContext = {
    t,
    geo,
    result: { edition, results: includeScores },
    refereeLabel: refereeLabelFor(schedule),
    side: {
      t,
      isTeam: name => schedule.teams.some(team => team.name === name),
      groupName: id => t.groupLabel(id, getGroupDisplayName(id, schedule.tournament)),
      hidePendingOrigin: content.hidePendingOrigin,
      originOnly: edition === 'blank',
      matches: schedule.allMatches,
    },
  };

  // Gruppentabellen, eigene Seite (nur wenn es Gruppen gibt und sie gewünscht sind)
  if (hasTables) {
    const tablesTop = startPage(doc, 'tables', geo);
    yPos = edition === 'blank'
      ? renderBlankStandings(doc, schedule, t, geo, tablesTop, sections.handle('tables'), placementLine(rules, t))
      : renderGroupStandings(doc, schedule, standings, t, geo, tablesTop, sections.handle('tables'), finalTable ? { title: t.finalTable, order: ranking } : undefined);
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
  if (!finalTable && content.tables) {
    renderRanking(
      doc,
      { state: placement, teamCount: schedule.teams.length, ranking, hasFinalRound: finalPhases.length > 0 },
      t,
      geo,
      yPos,
      sections.handle('ranking')
    );
  }

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
    qr: qr?.modules,
    qrUrl: qr?.url,
    subtitleFor: page => {
      const key = page <= model.pages.length ? 'groupStage' : sections.keyAtTop(page);
      return [ageClassText(schedule.tournament.ageClass), dayOf(schedule, t), key ? sectionNames[key] : ''].filter(part => part !== '').join(t.rules.join);
    },
  });
  drawFooters(doc, geo, footer);

  return { doc, notes, hints, filename: schedulePdfFilename(schedule.tournament.title, now, edition) };
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
