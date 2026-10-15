/**
 * Platzierung (B-28 C2, @DR-009, @DR-005): nummerierte Liste 1. bis n. am Ende des Dokuments, zweispaltig (Plätze
 * 1 bis ⌈n/2⌉ links, der Rest rechts, gleiche Zeilen nebeneinander).
 * Offen: Satz „Die Platzierung steht nach dem Finale (letzten Spiel) fest“ und je Team eine Schreiblinie, ohne Teamnamen
 * und ohne Punkte. Abgeschlossen: alle Plätze mit Teamnamen laut gespeichertem Endstand. Teamnamen 12 pt (@DR-001),
 * lange Namen laufen auf bis zu drei Zeilen und werden nie gekürzt (@BM-021), die Zeile wächst für beide Spalten; der Seitenumbruch fällt nur zwischen zwei Zeilen. Nur Zeichnen; Maße aus `design-tokens/print.ts`.
 */
import type jsPDF from 'jspdf';
import { printColors, printLimits, printMetrics, printStroke, printType } from '../../../design-tokens/print';
import { ascentMm, continuationTop, ensureSpace, type PageGeometry } from '../layout';
import { PDF_FONT } from '../fonts';
import type { PlacementState, RankEntry } from '../placement';
import type { PdfTexts } from '../translations';

export interface RankingInput {
  state: PlacementState;
  /** Zahl der Teams: so viele Schreiblinien stehen im offenen Zustand. */
  teamCount: number;
  /** Endstand; nur im Zustand `final` gezeichnet. */
  ranking: RankEntry[];
  /** Es gibt eine Finalrunde: bestimmt den Satz („nach dem Finale“ oder „nach dem letzten Spiel“). */
  hasFinalRound: boolean;
}

interface Slot {
  place: number;
  name: string | undefined;
}

/** Zeilen eines Namens in der Breite `room` (12 pt). Nie gekürzt: lange Namen laufen auf weitere Zeilen (@BM-021). */
function nameLines(doc: jsPDF, name: string | undefined, room: number): string[] {
  if (name === undefined) {
    return [];
  }
  doc.setFont(PDF_FONT.family, 'normal');
  doc.setFontSize(printLimits.teamPt);
  return doc.splitTextToSize(name, room) as string[];
}

/** Breite für Namen in einer Spalte: Spaltenbreite ohne Nummer. */
const nameRoom = (width: number): number => width - printMetrics.placeNumberWidth - printMetrics.placeNumberGap;

/**
 * Ein Platz in einer Spalte: Nummer rechtsbündig, im Endstand der Name (mehrzeilig) darauf, Schreiblinie unter der
 * letzten Zeile. `height` ist die gemeinsame Zeilenhöhe des Paares.
 */
function drawSlot(doc: jsPDF, left: number, width: number, top: number, height: number, slot: Slot): void {
  const bottom = top + height;
  const baseline = top + printMetrics.placeRowHeight - printMetrics.placeTextLift;
  const lineStart = left + printMetrics.placeNumberWidth + printMetrics.placeNumberGap;

  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.setFontSize(printLimits.teamPt);
  doc.text(`${slot.place}.`, left + printMetrics.placeNumberWidth, baseline, { align: 'right' });
  const lines = nameLines(doc, slot.name, nameRoom(width));
  doc.setFont(PDF_FONT.family, 'normal');
  lines.forEach((line, i) => doc.text(line, lineStart, baseline + i * printMetrics.participantAdvance));
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.box);
  doc.line(lineStart, bottom, left + width, bottom);
}

/** Höhe eines Zeilenpaares: Grundhöhe, je weitere Namenszeile (links oder rechts, die längere zählt) ein Zeilenabstand mehr. */
function pairHeight(doc: jsPDF, width: number, pair: Array<Slot | undefined>): number {
  const most = Math.max(1, ...pair.map(slot => nameLines(doc, slot?.name, nameRoom(width)).length));
  return printMetrics.placeRowHeight + (most - 1) * printMetrics.participantAdvance;
}

/** Platzierung zeichnen. Rückgabe: y unter der letzten Zeile. */
export function renderRanking(doc: jsPDF, input: RankingInput, t: PdfTexts, geo: PageGeometry, yPos: number): number {
  const { state, teamCount, ranking, hasFinalRound } = input;
  const pending = state === 'open';

  const slots: Slot[] = pending
    ? Array.from({ length: teamCount }, (_, i) => ({ place: i + 1, name: undefined }))
    : ranking.map(entry => ({ place: entry.place, name: entry.team.name }));
  const rowCount = Math.ceil(slots.length / 2);

  // Die Liste bleibt zusammen, wenn sie auf eine Seite passt; sonst beginnt sie hier und bricht zwischen Zeilen um
  const sentence = pending ? printMetrics.placeSentenceAdvance : 0;
  const wholeList = printMetrics.sectionTitleUnderline + sentence + rowCount * printMetrics.placeRowHeight;
  const firstRows = printMetrics.sectionTableMinSpace + sentence + printMetrics.placeRowHeight;
  const pageRoom = geo.bottom - continuationTop(geo) - ascentMm(printType.h2);
  yPos = ensureSpace(doc, yPos, Math.max(firstRows, Math.min(wholeList, pageRoom)), geo);

  doc.setFontSize(printType.h2);
  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.text(t.finalRanking, geo.left, yPos);
  yPos += printMetrics.sectionTitleUnderline;

  if (pending) {
    doc.setFont(PDF_FONT.family, 'normal');
    doc.setFontSize(printType.body);
    doc.text(hasFinalRound ? t.placementPending.afterFinal : t.placementPending.afterLast, geo.left, yPos + ascentMm(printType.body));
    yPos += printMetrics.placeSentenceAdvance;
  }

  const columnWidth = (geo.contentWidth - printMetrics.placeColumnGap) / 2;
  const rightLeft = geo.left + columnWidth + printMetrics.placeColumnGap;
  let top = yPos;
  for (let row = 0; row < rowCount; row++) {
    const right = slots[row + rowCount];
    const height = pairHeight(doc, columnWidth, [slots[row], right]);
    if (top + height > geo.bottom) {
      doc.addPage();
      top = continuationTop(geo);
    }
    drawSlot(doc, geo.left, columnWidth, top, height, slots[row]);
    if (right !== undefined) {
      drawSlot(doc, rightLeft, columnWidth, top, height, right);
    }
    top += height;
  }
  return top;
}
