/**
 * Teilnehmer als Blöcke (B-28a3-4b Punkt 8, Daniel 15.10.): je Gruppe ein Kasten mit „Gruppe A“ und den Kennungen
 * A1… fett, Teamnamen 12 pt. Kästen nebeneinander, bei mehr Gruppen umbrechend. Namen brechen um (bis drei Zeilen),
 * nie gekürzt. Ohne Gruppen ein Kasten über die volle Breite mit nummerierten Namen. Unter dem Abschnittstitel eine
 * Linie (v7.2). Nur Zeichnen.
 */
import type jsPDF from 'jspdf';
import type { GeneratedSchedule } from '../../../core/generators';
import { printColors, printFont, printGap, printLimits, printMetrics, printStroke, printType, printUnit } from '../../../design-tokens/print';
import { getGroupDisplayName } from '../../../utils/displayNames';
import { ensureSpace, type PageGeometry } from '../layout';
import type { PdfTexts } from '../translations';
import { PDF_FONT } from '../fonts';

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
  doc.setFont(PDF_FONT.family, bold ? 'bold' : 'normal');
}

function groupTitle(group: string, schedule: GeneratedSchedule, t: PdfTexts): string {
  return t.groupLabel(group, getGroupDisplayName(group, schedule.tournament));
}

/** Blöcke je Gruppe in sortierter Reihenfolge. Kennungen A1… je Gruppe, ohne Gruppen 1., 2. … (Zuteilungsreihenfolge). */
function buildBlocks(schedule: GeneratedSchedule, t: PdfTexts): Block[] {
  const teamsByGroup = new Map<string, Team[]>();
  schedule.teams.forEach(team => {
    const groupKey = team.group ?? 'Alle';
    teamsByGroup.set(groupKey, [...(teamsByGroup.get(groupKey) ?? []), team]);
  });
  const groups = Array.from(teamsByGroup.keys()).sort();
  const onlyOneGroup = groups.length === 1;
  let counter = 1;
  return groups.map(group => {
    const teams = teamsByGroup.get(group) ?? [];
    const entries = teams.map((team, index) => ({
      id: group === 'Alle' ? `${counter++}.` : `${group}${index + 1}`,
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
  let baseline = inset + ascent(printType.caption);
  if (block.title !== undefined) {
    items.push({ text: block.title, dx: inset, baseline, bold: true, size: printType.caption });
    baseline += printMetrics.participantBoxTitleAdvance;
  } else {
    baseline = inset + ascent(nameSize);
  }
  for (const entry of block.entries) {
    setFace(doc, nameSize, true);
    const nameX = inset + doc.getTextWidth(entry.id) + printMetrics.participantLabelGap;
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
  yPos: number
): number {
  yPos = ensureSpace(doc, yPos, printMetrics.sectionTitleMinSpace, geo);

  // Abschnittstitel mit Linie darunter
  doc.setFontSize(printType.h2);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(t.participants, geo.left, yPos);
  const ruleY = yPos + printMetrics.sectionTitleUnderline;
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.thead);
  doc.line(geo.left, ruleY, geo.left + geo.contentWidth, ruleY);
  yPos += printMetrics.sectionTitleAdvance;

  const blocks = buildBlocks(schedule, t);
  if (blocks.length === 0) {
    return yPos + printGap.sectionGap;
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
  return yPos - printMetrics.participantBoxRowGap + printGap.sectionGap;
}
