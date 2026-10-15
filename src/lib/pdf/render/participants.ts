/**
 * Teilnehmer: abgerundete Kästen je Gruppe, zwei Gruppen nebeneinander. Bei einer Gruppe ein Kasten über die
 * volle Breite ohne Titel. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printType, printMetrics, printGap, printStroke } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

type Team = GeneratedSchedule['teams'][number];

/** Zeilen „n. Teamname“ untereinander, Start bei `firstNumber`. Rückgabe: nächste Nummer. */
function teamLines(doc: jsPDF, teams: Team[], x: number, startY: number, firstNumber: number): number {
  let currentY = startY;
  let counter = firstNumber;
  doc.setFontSize(printType.teams);
  doc.setFont(PDF_FONT.family, 'normal');
  teams.forEach(team => {
    doc.text(`${counter}. ${team.name}`, x + printMetrics.boxPadding, currentY);
    currentY += printMetrics.teamLineHeight;
    counter++;
  });
  return counter;
}

/** Gruppentitel in einem Kasten. */
function boxTitle(doc: jsPDF, text: string, x: number, boxTop: number): void {
  doc.setFontSize(printType.body);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(text, x + printMetrics.boxPadding, boxTop + printMetrics.boxPadding + printMetrics.boxTextOffset);
}

function groupTitle(group: string, schedule: GeneratedSchedule, t: PdfTexts): string {
  return group !== 'Alle' ? t.groupLabel(group, getGroupDisplayName(group, schedule.tournament)) : t.participants;
}

export function renderParticipants(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: PdfTexts,
  geo: PageGeometry,
  yPos: number
): number {
  yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);

  // Abschnittstitel
  doc.setFontSize(printType.h2);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(t.participants, geo.left, yPos);
  yPos += printMetrics.sectionTitleAdvance;

  // Teams nach Gruppe sortieren
  const teamsByGroup = new Map<string, typeof schedule.teams>();
  schedule.teams.forEach(team => {
    const groupKey = team.group ?? 'Alle';
    let groupTeams = teamsByGroup.get(groupKey);
    if (!groupTeams) {
      groupTeams = [];
      teamsByGroup.set(groupKey, groupTeams);
    }
    groupTeams.push(team);
  });

  // Teams in jeder Gruppe alphabetisch
  teamsByGroup.forEach(teams => teams.sort((a, b) => a.name.localeCompare(b.name)));

  const groups = Array.from(teamsByGroup.keys()).sort();
  const { participantsColGap: colGap, boxPadding, boxTitleHeight: titleHeight, teamLineHeight } = printMetrics;
  const colWidth = (geo.contentWidth - colGap) / 2;

  // Nur eine Gruppe: alle Teams in einem Kasten ohne Titel
  if (groups.length === 1) {
    const allTeams = teamsByGroup.get(groups[0]) ?? [];
    const boxHeight = allTeams.length * teamLineHeight + boxPadding * 2;

    yPos = ensureSpace(doc, yPos, boxHeight + printMetrics.boxMinSpace, geo);
    const rowStartY = yPos;

    const boxX = geo.left;
    doc.setDrawColor(...printColors.ink);
    doc.setLineWidth(printStroke.box);
    doc.roundedRect(boxX, rowStartY, geo.contentWidth, boxHeight, printMetrics.boxRadius, printMetrics.boxRadius);

    doc.setTextColor(...printColors.ink);
    teamLines(doc, allTeams, boxX, rowStartY + boxPadding + printMetrics.boxTextOffset, 1);

    yPos = rowStartY + boxHeight + printGap.sectionGap;
    return yPos;
  }

  // Gruppen zu zweit nebeneinander
  let teamCounter = 1;
  for (let i = 0; i < groups.length; i += 2) {
    const leftGroup = groups[i];
    const rightGroup = i + 1 < groups.length ? groups[i + 1] : null;

    const leftTeams = teamsByGroup.get(leftGroup) ?? [];
    const rightTeams = rightGroup ? (teamsByGroup.get(rightGroup) ?? []) : [];

    // Kastenhöhen
    const leftBoxHeight = titleHeight + leftTeams.length * teamLineHeight + boxPadding * 2;
    const rightBoxHeight = rightGroup ? titleHeight + rightTeams.length * teamLineHeight + boxPadding * 2 : 0;
    const rowHeight = Math.max(leftBoxHeight, rightBoxHeight);

    yPos = ensureSpace(doc, yPos, rowHeight + printMetrics.boxMinSpace, geo);
    const rowStartY = yPos;

    // Linker Kasten
    const leftX = geo.left;
    doc.setDrawColor(...printColors.ink);
    doc.setLineWidth(printStroke.box);
    doc.roundedRect(leftX, rowStartY, colWidth, leftBoxHeight, printMetrics.boxRadius, printMetrics.boxRadius);

    boxTitle(doc, groupTitle(leftGroup, schedule, t), leftX, rowStartY);
    teamCounter = teamLines(doc, leftTeams, leftX, rowStartY + boxPadding + printMetrics.boxTextOffset + printMetrics.boxTitleAdvance, teamCounter);

    // Rechter Kasten, falls vorhanden
    if (rightGroup) {
      const rightX = geo.left + colWidth + colGap;
      doc.setDrawColor(...printColors.ink);
      doc.setLineWidth(printStroke.box);
      doc.roundedRect(rightX, rowStartY, colWidth, rightBoxHeight, printMetrics.boxRadius, printMetrics.boxRadius);

      boxTitle(doc, groupTitle(rightGroup, schedule, t), rightX, rowStartY);
      teamCounter = teamLines(doc, rightTeams, rightX, rowStartY + boxPadding + printMetrics.boxTextOffset + printMetrics.boxTitleAdvance, teamCounter);
    }

    // Zur nächsten Zeile
    yPos = rowStartY + rowHeight + printMetrics.boxRowAdvance;
  }

  yPos += printGap.sectionGap;
  return yPos;
}
