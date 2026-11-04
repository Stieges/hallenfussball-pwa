/**
 * Spielplan-PDF: baut das Dokument (`buildSchedulePdf`) und speichert es (`exportScheduleToPDF`).
 *
 * Aufbau in fester Reihenfolge (@DR-002): Seite 1 mit Kopf (Titel, Eckdaten, Regelzeile, QR) und Gruppenspielen
 * (Überlauf auf Folgeseiten mit wiederholtem Spaltenkopf), dann Gruppentabellen (neue Seite), Finalrunde und Platzierung. Alle
 * Seiten baut das Seitenmodell (`model/*`, T6, T7b) und zeichnet die Zeichenschicht (`render/*`, T7a, T7b) 1:1. Jede Folgeseite
 * beginnt mit dem Kurzkopf, jede Seite endet mit der Fußzeile (Stand, Seitenzahl, Adresse). Immer A4 hoch (@DR-026), auch wenn
 * quer angefordert wird. Maße aus `design-tokens/print*.ts`.
 *
 * Bauen und Speichern sind getrennt: `buildSchedulePdf` liefert das Dokument, den Dateinamen und die Hinweise
 * (Zeichen, die als „?“ erscheinen, Ersatzschrift) VOR dem Speichern (@DR-012).
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../core/generators';
import type { Standing } from '../../types/tournament';
import { fontOf } from './fonts';
import { pageGeometry } from './layout';
import { qrModules, shortViewerAddress } from '../qr/publicQr';
import type { PDFExportOptions, PdfAccent } from './pdfOptions';
import { openDocument, toPdfInput, type SchedulePdfInput } from './pdfInput';
import { dayOf } from './headerFacts';
import { schedulePdfFilename } from './filename';
import { buildHints, hintNotes, type PdfHints } from './notes';
import { closedLine, pageLabel, standLine } from './standText';
import { pdfContentRules } from './visibility';
import { countFooterLines, drawFooters, type FooterContent } from './render/footer';
import { drawMatchRows } from './render/matchRowsDraw';
import { drawPageHeader, type HeaderPictures } from './render/pageHeader';
import { drawLinks } from './render/links';
import { usableLogo } from './render/headerGraphics';
import { printHeader } from '../../design-tokens/print-header';
import { qrSide } from './render/qrCode';
import { drawShortHead, shortHeadTitleLines, shortQrColumn, type ShortHeadText } from './render/shortHeader';
import { drawFinals, drawText } from './render/finalsDraw';
import { drawRanking } from './render/rankingLines';
import { drawShootout } from './render/shootoutLine';
import { drawStandings } from './render/standingsDraw';
import { pdfRulesFrom } from './rules';
import { jspdfMeasure } from './model/measure';
import { buildScheduleModel } from './model/scheduleModel';
import type { PageModel, PageSection } from './model/types';
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

/** Eine Seite des Seitenmodells zeichnen: Kurzkopf (Folgeseiten) zuerst, dann die Blöcke in Modellreihenfolge, dann ihre Links (@DR-038). */
function drawModelPage(doc: jsPDF, page: PageModel, pictures: HeaderPictures, qr: boolean[][] | undefined, accent: PdfAccent): void {
  for (const block of page.blocks) {
    switch (block.kind) {
      case 'header': drawPageHeader(doc, block, pictures, qr, accent); break;
      case 'matchRows': drawMatchRows(doc, block, accent); break;
      case 'standingsTable': drawStandings(doc, block, accent); break;
      case 'shootout': drawShootout(doc, block); break;
      case 'text': drawText(doc, block); break;
      case 'finals': drawFinals(doc, block, accent); break;
      case 'ranking': drawRanking(doc, block); break;
      case 'shortHeader': break;
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
  const { closedAt } = input.state;

  const rules = pdfRulesFrom(tournament, schedule);
  // Sichtbarkeit an einer Stelle (C5): die Schalter des Turniers begrenzen den Wunsch des Dialogs
  const content = pdfContentRules(tournament, audience, options.viewerBaseUrl);

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
    join: t.rules.join,
    pageLabel: (page, total) => pageLabel(page, total, translate),
    ...(qr ? { link: { prefix: t.sheet.footerLink, address: shortViewerAddress(qr.url), url: qr.url } } : {}),
  };
  const contentWidth = pageGeometry('a4', orientation).contentWidth;
  const shortHeadTitle = shortHeadTitleLines(doc, schedule.tournament.title, contentWidth - shortQrColumn(qr?.modules));
  const geo = pageGeometry('a4', orientation, shortHeadTitle.length, countFooterLines(doc, footer, contentWidth), qr ? qrSide(qr.modules.length, printHeader.qrEdgeShort) : 0);

  // Jeder gegen jeden hat keine Gruppen: der Abschnitt heißt „Spiele“ (Controller, B-28a3-4)
  const groupStageName = rules.groupSystem === 'roundRobin' ? t.matches : t.groupStage;

  // Seitenmodell (T6, T7b): alle Seiten; gezeichnet wird es 1:1 (T7a, T7b)
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
  const sectionNames: Record<PageSection, string> = { matches: groupStageName, tables: t.sectionTables, finals: t.sectionFinals, ranking: t.finalRanking };
  const shortHead: ShortHeadText = { titleLines: shortHeadTitle, qr: qr?.modules, qrUrl: qr?.url };
  model.pages.forEach((page, index) => {
    if (index > 0) {
      doc.addPage();
      // Der Kurzkopf steht als Erstes auf der Seite (Lesereihenfolge, @DR-039); sein Untertitel nennt den Abschnitt oben auf der Seite
      drawShortHead(doc, shortHead, geo, [ageClassText(schedule.tournament.ageClass), dayOf(schedule, t), sectionNames[page.section]].filter(part => part !== '').join(t.rules.join));
    }
    drawModelPage(doc, page, { left: logoLeft, right: logoRight }, qr?.modules, input.accent);
  });
  // Die Fußzeile aller Seiten zuletzt: ein Vorlese-Programm liest sie nach dem Inhalt der Seite (@DR-039)
  drawFooters(doc, geo, footer);

  return { doc, notes, hints, filename: schedulePdfFilename(schedule.tournament.title, now, { plan: t.sheet.titleSuffix, withoutResults: t.sheet.fileWithoutResults }, edition) };
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
