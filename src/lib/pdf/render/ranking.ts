/**
 * Platzierung (B-28 C2, @DR-009, @DR-005): nummerierte Liste 1. bis n. am Ende des Dokuments, zweispaltig (Plätze
 * 1 bis ⌈n/2⌉ links, der Rest rechts, gleiche Zeilen nebeneinander).
 * Offen: Satz „Die Platzierung steht nach dem Finale (letzten Spiel) fest“ und je Team eine Schreiblinie, ohne Teamnamen
 * und ohne Punkte. Abgeschlossen: alle Plätze mit Teamnamen laut gespeichertem Endstand. Teamnamen 12 pt (@DR-001),
 * der Seitenumbruch fällt nur zwischen zwei Zeilen. Nur Zeichnen; Maße aus `design-tokens/print.ts`.
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

/** Ein Platz in einer Spalte: Nummer rechtsbündig, Schreiblinie bis zum Spaltenende, im Endstand der Name darauf. */
function drawSlot(doc: jsPDF, left: number, width: number, top: number, slot: Slot): void {
  const bottom = top + printMetrics.placeRowHeight;
  const baseline = bottom - printMetrics.placeTextLift;
  const lineStart = left + printMetrics.placeNumberWidth + printMetrics.placeNumberGap;

  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.setFontSize(printLimits.teamPt);
  doc.text(`${slot.place}.`, left + printMetrics.placeNumberWidth, baseline, { align: 'right' });
  if (slot.name !== undefined) {
    doc.setFont(PDF_FONT.family, 'normal');
    const room = left + width - lineStart;
    // Ein zu langer Name wird auf die erste Zeile gekürzt, damit er nicht in die Nachbarspalte läuft
    const lines = doc.splitTextToSize(slot.name, room) as string[];
    doc.text(lines[0] ?? slot.name, lineStart, baseline);
  }
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.box);
  doc.line(lineStart, bottom, left + width, bottom);
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
    if (top + printMetrics.placeRowHeight > geo.bottom) {
      doc.addPage();
      top = continuationTop(geo);
    }
    drawSlot(doc, geo.left, columnWidth, top, slots[row]);
    const right = slots[row + rowCount];
    if (right !== undefined) {
      drawSlot(doc, rightLeft, columnWidth, top, right);
    }
    top += printMetrics.placeRowHeight;
  }
  return top;
}
