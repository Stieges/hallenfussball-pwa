/**
 * Teilnehmer als Zeilen je Gruppe (B-28a3-3b, v7.2-Empfehlung „Teilnehmer kompakt“): „Gruppe A“ und die nummerierten
 * Namen, durch „ · “ getrennt, Teamnamen 12 pt (@DR-001). Ohne Gruppen steht nur die Namenszeile. Umbruch innerhalb
 * der Zeile, nie abgeschnitten. Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printGap, printLimits, printMetrics, printType } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

type Team = GeneratedSchedule['teams'][number];

function groupTitle(group: string, schedule: GeneratedSchedule, t: PdfTexts): string {
  return group !== 'Alle' ? t.groupLabel(group, getGroupDisplayName(group, schedule.tournament)) : t.participants;
}

/**
 * Eine Zeile je Gruppe: optional „Gruppe A“ fett, dahinter die Namen. Rückgabe: Grundlinie der nächsten Zeile.
 */
function drawRow(doc: jsPDF, names: string, label: string | undefined, geo: PageGeometry, yPos: number): number {
  doc.setFontSize(printLimits.teamPt);
  doc.setTextColor(...printColors.ink);
  let labelWidth = 0;
  if (label !== undefined) {
    doc.setFont(PDF_FONT.family, 'bold');
    labelWidth = doc.getTextWidth(label) + printMetrics.participantLabelGap;
  }
  doc.setFont(PDF_FONT.family, 'normal');
  const lines = doc.splitTextToSize(names, geo.contentWidth - labelWidth) as string[];
  const height = lines.length * printMetrics.participantAdvance;

  yPos = ensureSpace(doc, yPos, height, geo);
  if (label !== undefined) {
    doc.setFont(PDF_FONT.family, 'bold');
    doc.text(label, geo.left, yPos);
    doc.setFont(PDF_FONT.family, 'normal');
  }
  lines.forEach((line, index) => {
    doc.text(line, geo.left + labelWidth, yPos + index * printMetrics.participantAdvance);
  });
  return yPos + height + printMetrics.participantRowGap;
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

  // Teams nach Gruppe sortieren, in jeder Gruppe alphabetisch
  const teamsByGroup = new Map<string, Team[]>();
  schedule.teams.forEach(team => {
    const groupKey = team.group ?? 'Alle';
    const groupTeams = teamsByGroup.get(groupKey) ?? [];
    groupTeams.push(team);
    teamsByGroup.set(groupKey, groupTeams);
  });
  teamsByGroup.forEach(teams => teams.sort((a, b) => a.name.localeCompare(b.name)));

  // Kennungen A1–B4 je Gruppe (v7.2, Daniel 15.10.); ohne Gruppen laufen die Nummern 1 bis n durch
  const groups = Array.from(teamsByGroup.keys()).sort();
  const onlyOneGroup = groups.length === 1;
  let counter = 1;
  for (const group of groups) {
    const teams = teamsByGroup.get(group) ?? [];
    const names = teams
      .map((team, index) => {
        const id = group === 'Alle' ? `${counter++}.` : `${group}${index + 1}`;
        return `${id} ${team.name}`;
      })
      .join(' · ');
    yPos = drawRow(doc, names, onlyOneGroup ? undefined : groupTitle(group, schedule, t), geo, yPos);
  }

  return yPos + printGap.sectionGap;
}
