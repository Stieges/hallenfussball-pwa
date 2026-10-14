/**
 * Tabellen: Gruppentabellen (nur bei `includeStandings`) und Gesamt-Platzierung (immer). Sortiert nach Punkten,
 * Tordifferenz, Toren. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import autoTable, { type CellInput, type RowInput, type UserOptions } from 'jspdf-autotable';
import type { GeneratedSchedule } from '../../../core/generators';
import type { Standing } from '../../../types/tournament';
import { printColors, printFonts, printMetrics, printSpacing, printStandingsColumns } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import { tableEndY } from '../jspdfTypes';
import type { PdfTexts } from '../translations';

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

/** Eine Zeile der Tabelle. Null-Werte bleiben leer. */
function standingRow(standing: Standing, index: number): CellInput[] {
  return [
    (index + 1).toString(),
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
  const data: RowInput[] = standings.map((standing, index): CellInput[] => standingRow(standing, index));

  const options: UserOptions = {
    startY,
    head: standingsHeader(t),
    body: data,
    margin: {
      left: geo.left,
      right: geo.right,
    },
    styles: {
      fontSize: printFonts.tableSmall,
      cellPadding: printMetrics.tableCellPaddingCompact,
      lineColor: [...printColors.border],
      lineWidth: printMetrics.tableLineWidth,
    },
    headStyles: {
      fillColor: [...printColors.headBg],
      textColor: [...printColors.textMain],
      fontStyle: 'bold',
      halign: 'center',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: printStandingsColumns.pos },
      1: { halign: 'left', cellWidth: printStandingsColumns.team },
      2: { halign: 'center', cellWidth: printStandingsColumns.played },
      3: { halign: 'center', cellWidth: printStandingsColumns.won },
      4: { halign: 'center', cellWidth: printStandingsColumns.drawn },
      5: { halign: 'center', cellWidth: printStandingsColumns.lost },
      6: { halign: 'center', cellWidth: printStandingsColumns.goals },
      7: { halign: 'center', cellWidth: printStandingsColumns.diff },
      8: { halign: 'center', cellWidth: printStandingsColumns.points },
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
    doc.setFontSize(printFonts.groupTitle);
    doc.setTextColor(...printColors.textMain);
    doc.setFont('helvetica', 'bold');
    doc.text(`${t.standings} – ${getGroupDisplayName(group, schedule.tournament)}`, geo.left, yPos);
    yPos += printMetrics.sectionTitleUnderline;

    const groupTeams = schedule.teams.filter(team => team.group === group);
    const groupStandings = currentStandings
      .filter(s => groupTeams.some(team => team.id === s.team.id))
      .sort(compareRanking);

    const end = drawStandingsTable(doc, geo, t, yPos, groupStandings);
    yPos = end + printSpacing.sectionGap + printMetrics.standingsGroupAdvance;
  });

  yPos += printSpacing.sectionGap;
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
  doc.setFontSize(printFonts.sectionTitle);
  doc.setTextColor(...printColors.textMain);
  doc.setFont('helvetica', 'bold');
  doc.text(t.finalRanking, geo.left, yPos);
  yPos += printMetrics.sectionTitleUnderline;

  const finalStandings = [...resolveStandings(schedule, standings)].sort(compareRanking);

  const end = drawStandingsTable(doc, geo, t, yPos, finalStandings);
  yPos = end + printSpacing.sectionGap;

  return yPos;
}
