/**
 * Teilnehmer als Blöcke (B-28a3-4b Punkt 8, Daniel 15.10.): je Gruppe ein Kasten mit „Gruppe A“ und den Kennungen
 * A1… fett, Teamnamen 12 pt. Kästen nebeneinander, bei mehr Gruppen umbrechend. Namen brechen um (bis drei Zeilen),
 * nie gekürzt. Alle Namen eines Kastens bündig (B-28a3-4G Punkt 2). Ohne Gruppen ein Kasten über die volle Breite, Kennungen ebenfalls A1… Unter dem Abschnittstitel eine
 * Linie (v7.2). Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printFont, printGap, printLimits, printMetrics, printStroke, printType, printUnit } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import type { PdfTexts } from '../translations';
import { fontOf } from '../fonts';
import type { SectionHandle } from '../sections';

type Team = GeneratedSchedule['teams'][number];

/** Ein Kasten: Gruppentitel (ohne Gruppen keiner) und die Teams mit Kennung. */
interface Block {
  title?: string;
  entries: Array<{ id: string; name: string }>;
}

/** Ein Textstück im Kasten, Position relativ zur Oberkante des Kastens. */
interface Placed {
  text: string;
  dx: number;
  baseline: number;
  bold: boolean;
  size: number;
}

/** Abstand Grundlinie → Oberkante einer Schrift in mm (Ascender der Schrift). */
function ascent(size: number): number {
  return size * printUnit.mmPerPt * printFont.ascentEm;
}

function setFace(doc: jsPDF, size: number, bold: boolean): void {
  doc.setFontSize(size);
  doc.setTextColor(...printColors.ink);
  doc.setFont(fontOf(doc), bold ? 'bold' : 'normal');
}

function groupTitle(group: string, schedule: GeneratedSchedule, t: PdfTexts): string {
  return t.groupLabel(group, getGroupDisplayName(group, schedule.tournament));
}

/** Blöcke je Gruppe in sortierter Reihenfolge. Kennungen A1… je Gruppe, ohne Gruppen ebenfalls A1… (Zuteilungsreihenfolge, B-28 C1). */
function buildBlocks(schedule: GeneratedSchedule, t: PdfTexts): Block[] {
  const teamsByGroup = new Map<string, Team[]>();
  schedule.teams.forEach(team => {
    const groupKey = team.group ?? 'Alle';
    teamsByGroup.set(groupKey, [...(teamsByGroup.get(groupKey) ?? []), team]);
  });
  const groups = Array.from(teamsByGroup.keys()).sort();
  const onlyOneGroup = groups.length === 1;
  return groups.map(group => {
    const teams = teamsByGroup.get(group) ?? [];
    // Kennung immer Buchstabe + Nummer (B-28 C1): ohne Gruppen (Jeder gegen jeden) ist es eine Gruppe „A“
    const entries = teams.map((team, index) => ({
      id: `${group === 'Alle' ? 'A' : group}${index + 1}`,
      name: team.name,
    }));
    return { title: onlyOneGroup || group === 'Alle' ? undefined : groupTitle(group, schedule, t), entries };
  });
}

/**
 * Textstücke eines Kastens und seine Höhe. Namen brechen innerhalb der Kastenbreite um; die Zeilen eines Teams
 * rücken unter seine Kennung.
 */
function placeBlock(doc: jsPDF, block: Block, boxWidth: number): { height: number; items: Placed[] } {
  const inset = printMetrics.participantBoxInset;
  const nameSize = printLimits.teamPt;
  const items: Placed[] = [];
  // Namen beginnen überall an derselben x-Position: Innenrand + breiteste Kennung des Kastens + Abstand (B-28a3-4G Punkt 2)
  setFace(doc, nameSize, true);
  const widestId = Math.max(0, ...block.entries.map(entry => doc.getTextWidth(entry.id)));
  const nameX = inset + widestId + printMetrics.participantLabelGap;
  let baseline = inset + ascent(printType.caption);
  if (block.title !== undefined) {
    items.push({ text: block.title, dx: inset, baseline, bold: true, size: printType.caption });
    baseline += printMetrics.participantBoxTitleAdvance;
  } else {
    baseline = inset + ascent(nameSize);
  }
  for (const entry of block.entries) {
    setFace(doc, nameSize, false);
    const lines = doc.splitTextToSize(entry.name, boxWidth - nameX - inset) as string[];
    items.push({ text: entry.id, dx: inset, baseline, bold: true, size: nameSize });
    lines.forEach((line, index) => {
      items.push({ text: line, dx: nameX, baseline: baseline + index * printMetrics.participantAdvance, bold: false, size: nameSize });
    });
    baseline += lines.length * printMetrics.participantAdvance;
  }
  const lastBaseline = baseline - printMetrics.participantAdvance;
  return { height: lastBaseline + printMetrics.participantBoxBottom, items };
}

/** Kästen nebeneinander: so viele, wie die Breite mit Mindestbreite zulässt, höchstens eine Zeile je Gruppe. */
function blocksPerRow(count: number, width: number): number {
  const gap = printMetrics.participantBoxGap;
  return Math.max(1, Math.min(count, Math.floor((width + gap) / (printMetrics.participantBoxMinWidth + gap))));
}

/** Eine Zeile aus Kästen gleicher Höhe, Rahmen und Inhalt. */
function drawRow(doc: jsPDF, row: Block[], geo: PageGeometry, top: number, boxWidth: number, rowHeight: number): void {
  row.forEach((block, index) => {
    const x = geo.left + index * (boxWidth + printMetrics.participantBoxGap);
    doc.setFillColor(...printColors.paper);
    doc.setDrawColor(...printColors.ink);
    doc.setLineWidth(printStroke.row);
    doc.rect(x, top, boxWidth, rowHeight, 'FD');
    for (const item of placeBlock(doc, block, boxWidth).items) {
      setFace(doc, item.size, item.bold);
      doc.text(item.text, x + item.dx, top + item.baseline);
    }
  });
}

export function renderParticipants(
  doc: jsPDF,
  schedule: GeneratedSchedule,
  t: PdfTexts,
  geo: PageGeometry,
  yPos: number,
  section: SectionHandle
): number {
  yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);

  // Abschnittstitel mit Linie darunter
  doc.setFontSize(printType.h2);
  doc.setTextColor(...printColors.ink);
  doc.setFont(fontOf(doc), 'bold');
  doc.text(section.heading(doc, yPos, t.participants), geo.left, yPos);
  const ruleY = yPos + printMetrics.sectionTitleUnderline;
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.thead);
  doc.line(geo.left, ruleY, geo.left + geo.contentWidth, ruleY);
  yPos += printMetrics.sectionTitleAdvance;

  const blocks = buildBlocks(schedule, t);
  // Rückgabe: Grundlinie des nächsten Abschnittstitels. Der Titel steht mit seiner Grundlinie an dieser Stelle,
  // seine Oberkante liegt also um die Oberlänge darüber (B-28a3-4F F3, Review M4).
  if (blocks.length === 0) {
    return yPos + printGap.sectionGap + ascent(printType.h2);
  }
  const perRow = blocksPerRow(blocks.length, geo.contentWidth);
  const gap = printMetrics.participantBoxGap;
  const boxWidth = (geo.contentWidth - (perRow - 1) * gap) / perRow;

  for (let start = 0; start < blocks.length; start += perRow) {
    const row = blocks.slice(start, start + perRow);
    const rowHeight = Math.max(...row.map(block => placeBlock(doc, block, boxWidth).height));
    yPos = ensureSpace(doc, yPos, rowHeight, geo);
    drawRow(doc, row, geo, yPos, boxWidth, rowHeight);
    yPos += rowHeight + printMetrics.participantBoxRowGap;
  }
  return yPos - printMetrics.participantBoxRowGap + printGap.sectionGap + ascent(printType.h2);
}
