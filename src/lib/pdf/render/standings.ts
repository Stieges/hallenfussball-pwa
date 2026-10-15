/**
 * Tabellen: Gruppentabellen (nur bei `includeStandings`) und Gesamt-Platzierung (immer). Sortiert nach Punkten,
 * Tordifferenz, Toren. Teamnamen mindestens 12 pt (@DR-001), Umbruch innerhalb der Zelle. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type UserOptions } from 'jspdf-autotable';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing } from '../../../types/tournament';
import { printColors, printType, printMetrics, printGap, printStroke, printColumns, printLimits } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ensureSpace, tableMargins, type PageGeometry } from '../layout';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

/** Standings aus dem Aufruf, sonst die Startwerte des Plans. */
function resolveStandings(schedule: GeneratedSchedule, standings: Standing[] | undefined): Standing[] {
  return standings ?? schedule.initialStandings;
}

/** Rangfolge: Punkte, dann Tordifferenz, dann Tore. */
function compareRanking(a: Standing, b: Standing): number {
  return b.points - a.points || b.goalDifference - a.goalDifference || b.goalsFor - a.goalsFor;
}

function standingsHeader(t: PdfTexts): RowInput[] {
  return [[t.pos, t.team, t.played, t.won, t.drawn, t.lost, t.goals, t.diff, t.points]];
}

/**
 * Eine Zeile der Tabelle. Null-Werte bleiben leer. Die Platz-Spalte ist nur gefüllt, wenn in der Tabelle gespielte
 * Spiele stehen (B-28a3-4b Punkt 1, Controller 15.10.): ohne Ergebnisse wirkt die Nummer sonst wie eine Rangfolge.
 */
function standingRow(standing: Standing, index: number, gespielt: boolean): CellInput[] {
  return [
    gespielt ? (index + 1).toString() : '',
    standing.team.name,
    standing.played > 0 ? standing.played.toString() : '',
    standing.won > 0 ? standing.won.toString() : '',
    standing.drawn > 0 ? standing.drawn.toString() : '',
    standing.lost > 0 ? standing.lost.toString() : '',
    standing.goalsFor > 0 || standing.goalsAgainst > 0
      ? `${standing.goalsFor}:${standing.goalsAgainst}`
      : '',
    standing.goalDifference !== 0
      ? standing.goalDifference > 0
        ? `+${standing.goalDifference}`
        : standing.goalDifference.toString()
      : '',
    standing.points > 0 ? standing.points.toString() : '',
  ];
}

/** Gemeinsame Tabelle für Gruppentabellen und Platzierung. */
function drawStandingsTable(
  doc: jsPDF,
  geo: PageGeometry,
  t: PdfTexts,
  startY: number,
  standings: Standing[]
): number {
  const gespielt = standings.some(standing => standing.played > 0);
  const data: RowInput[] = standings.map((standing, index): CellInput[] => standingRow(standing, index, gespielt));

  const options: UserOptions = {
    startY,
    head: standingsHeader(t),
    body: data,
    margin: tableMargins(geo),
    tableLineColor: [...printColors.ink],
    alternateRowStyles: { fillColor: [...printColors.paper], textColor: [...printColors.ink] },
    styles: {
      font: PDF_FONT.family,
      fontSize: printType.tableSBody,
      textColor: [...printColors.ink],
      cellPadding: printGap.compactPad,
      lineColor: [...printColors.ink],
      lineWidth: printStroke.row,
    },
    headStyles: {
      fontSize: printType.tableSHead,
      fillColor: [...printColors.tint],
      textColor: [...printColors.ink],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: printColumns.standings.pos },
      1: { halign: 'left', fontSize: printLimits.teamPt }, // Team: Rest der Breite, mindestens 12 pt
      2: { halign: 'center', cellWidth: printColumns.standings.played },
      3: { halign: 'center', cellWidth: printColumns.standings.won },
      4: { halign: 'center', cellWidth: printColumns.standings.drawn },
      5: { halign: 'center', cellWidth: printColumns.standings.lost },
      6: { halign: 'center', cellWidth: printColumns.standings.goals },
      7: { halign: 'center', cellWidth: printColumns.standings.diff },
      8: { halign: 'center', cellWidth: printColumns.standings.points },
    },
  };
  autoTable(doc, options);
  return tableEndY(doc);
}

/** Gruppentabellen, eine je Gruppe. Ohne Gruppen nichts. */
export function renderGroupStandings(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  t: PdfTexts,
  geo: PageGeometry,
  yPos: number
): number {
  // Gruppen des Plans, sortiert
  const groups = Array.from(new Set(schedule.teams.map(team => team.group).filter((g): g is string => Boolean(g)))).sort();
  if (groups.length === 0) {return yPos;}

  const currentStandings = resolveStandings(schedule, standings);

  groups.forEach(group => {
    yPos = ensureSpace(doc, yPos, printMetrics.sectionTableMinSpace, geo);

    // Titel „Tabelle – Gruppe X“
    doc.setFontSize(printType.caption);
    doc.setTextColor(...printColors.ink);
    doc.setFont(PDF_FONT.family, 'bold');
    doc.text(t.standingsOfGroup(t.groupLabel(group, getGroupDisplayName(group, schedule.tournament))), geo.left, yPos);
    yPos += printMetrics.sectionTitleUnderline;

    const groupTeams = schedule.teams.filter(team => team.group === group);
    const groupStandings = currentStandings
      .filter(s => groupTeams.some(team => team.id === s.team.id))
      .sort(compareRanking);

    const end = drawStandingsTable(doc, geo, t, yPos, groupStandings);
    yPos = end + printGap.sectionGap + printMetrics.standingsGroupAdvance;
  });

  yPos += printGap.sectionGap;
  return yPos;
}

/** Platzierung über alle Teams, immer am Ende des Dokuments. */
export function renderFinalRanking(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  standings: Standing[] | undefined,
  t: PdfTexts,
  geo: PageGeometry,
  yPos: number
): number {
  yPos = ensureSpace(doc, yPos, printMetrics.sectionTableMinSpace, geo);

  // Abschnittstitel
  doc.setFontSize(printType.h2);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(t.finalRanking, geo.left, yPos);
  yPos += printMetrics.sectionTitleUnderline;

  const finalStandings = [...resolveStandings(schedule, standings)].sort(compareRanking);

  const end = drawStandingsTable(doc, geo, t, yPos, finalStandings);
  yPos = end + printGap.sectionGap;

  return yPos;
}
