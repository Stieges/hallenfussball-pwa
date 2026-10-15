/**
 * Gruppentabellen der Fassung zum Ausfüllen (B-28 C6, @DR-005, @DR-018): je Gruppe die Teamnamen und leere Spalten zum
 * Eintragen (senkrechte Linien, „:“ in „Tore“), darunter einmal die Zeile „Platzierung: …“ aus den Regeln. Nie Werte aus
 * dem Turnierstand, auch wenn welche vorliegen. Kein Ausfüllhinweis (Daniel 15.10.). Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type UserOptions } from 'jspdf-autotable';
import type { GeneratedSchedule } from '../../../core/generators';
import { printBox, printColors, printColumns, printGap, printLimits, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ascentMm, ensureSpace, tableMargins, type PageGeometry } from '../layout';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';
import { fontOf } from '../fonts';
import type { SectionHandle } from '../sections';

const COLON = ':';

/** Spalten der Tabelle in ihrer Reihenfolge; „team“ bekommt den Rest der Breite, mindestens 12 pt. */
const COLUMNS = ['pos', 'team', 'played', 'won', 'drawn', 'lost', 'goals', 'diff', 'points'] as const;

/** Alle vier Seiten einer Zelle: senkrechte Linien zum Trennen der Spalten, anders als die Zeilenlinien der Spieltabellen. */
const grid = { top: printStroke.row, bottom: printStroke.row, left: printStroke.row, right: printStroke.row };

function head(t: PdfTexts): RowInput[] {
  return [[t.pos, t.team, t.played, t.won, t.drawn, t.lost, t.goals, t.diff, t.points]];
}

/** Eine leere Zeile: nur der Teamname und der Doppelpunkt in „Tore“. */
function row(name: string): CellInput[] {
  return ['', name, '', '', '', '', COLON, '', ''];
}

function tableOptions(doc: jsPDF, geo: PageGeometry, t: PdfTexts, startY: number, names: string[]): UserOptions {
  const columns = printColumns.standings;
  return {
    startY,
    head: head(t),
    body: names.map(row),
    margin: tableMargins(geo),
    tableLineColor: [...printColors.ink],
    // Keine Streifen: leere Felder sind weiß, nur der Kopf trägt das Raster
    alternateRowStyles: { fillColor: false },
    styles: {
      fillColor: false,
      font: fontOf(doc),
      fontSize: printType.tableSBody,
      textColor: [...printColors.ink],
      cellPadding: printGap.compactPad,
      lineColor: [...printColors.ink],
      lineWidth: grid,
      valign: 'middle',
      minCellHeight: printBox.blankRow,
    },
    headStyles: { fontSize: printType.tableSHead, fillColor: [...printColors.tint], textColor: [...printColors.ink], fontStyle: 'bold', halign: 'center', minCellHeight: 0 },
    columnStyles: Object.fromEntries(
      COLUMNS.map((key, index) => [index, key === 'team' ? { halign: 'left', fontSize: printLimits.teamPt } : { halign: 'center', cellWidth: columns[key] }])
    ),
  };
}

/** Gruppen des Plans, sortiert. */
function groupsOf(schedule: GeneratedSchedule): string[] {
  return Array.from(new Set(schedule.teams.map(team => team.group).filter((g): g is string => Boolean(g)))).sort();
}

/**
 * Leere Gruppentabellen. `placementLine` ist die Zeile „Platzierung: …“ (leer: keine Zeile). Rückgabe: nächste freie Grundlinie.
 */
export function renderBlankStandings(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: PdfTexts,
  geo: PageGeometry,
  yPos: number,
  section: SectionHandle,
  placementLine: string
): number {
  const groups = groupsOf(schedule);
  if (groups.length === 0) {
    return yPos;
  }
  groups.forEach(group => {
    yPos = ensureSpace(doc, yPos, printMetrics.sectionTableMinSpace, geo);
    doc.setFontSize(printType.caption);
    doc.setTextColor(...printColors.ink);
    doc.setFont(fontOf(doc), 'bold');
    doc.text(section.heading(doc, yPos, t.standingsOfGroup(t.groupLabel(group, getGroupDisplayName(group, schedule.tournament)))), geo.left, yPos);
    yPos += printMetrics.sectionTitleUnderline;
    autoTable(doc, tableOptions(doc, geo, t, yPos, schedule.teams.filter(team => team.group === group).map(team => team.name)));
    yPos = tableEndY(doc) + printGap.sectionGap + printMetrics.standingsGroupAdvance;
  });
  if (placementLine !== '') {
    doc.setFont(fontOf(doc), 'normal');
    doc.setFontSize(printType.note);
    const lines = doc.splitTextToSize(placementLine, geo.contentWidth) as string[];
    // Oberkante der Zeile: unter der letzten Tabelle (ohne den Gruppenabstand), bei Seitenwechsel oben auf der neuen Seite
    const top = ensureSpace(doc, yPos - printMetrics.standingsGroupAdvance, lines.length * printMetrics.koLineAdvance, geo);
    doc.setFont(fontOf(doc), 'normal');
    doc.setFontSize(printType.note);
    lines.forEach((text, index) => doc.text(text, geo.left, top + ascentMm(printType.note) + index * printMetrics.koLineAdvance));
    yPos = top + lines.length * printMetrics.koLineAdvance;
  }
  return yPos + printGap.sectionGap;
}
