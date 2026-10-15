/**
 * Platzierung (B-28 C2, @DR-009, @DR-005): nummerierte Liste 1. bis n. am Ende des Dokuments.
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

/** Eine Zeile: Platznummer rechtsbündig, Schreiblinie bis zum rechten Rand, im Endstand der Teamname darauf. */
function drawRow(doc: jsPDF, geo: PageGeometry, top: number, place: number, name: string | undefined): void {
  const bottom = top + printMetrics.placeRowHeight;
  const baseline = bottom - printMetrics.placeTextLift;
  const lineStart = geo.left + printMetrics.placeNumberWidth + printMetrics.placeNumberGap;

  doc.setTextColor(...printColors.ink);
  doc.setFont(PDF_FONT.family, 'bold');
  doc.setFontSize(printLimits.teamPt);
  doc.text(`${place}.`, geo.left + printMetrics.placeNumberWidth, baseline, { align: 'right' });
  if (name !== undefined) {
    doc.setFont(PDF_FONT.family, 'normal');
    doc.text(name, lineStart, baseline);
  }
  doc.setDrawColor(...printColors.ink);
  doc.setLineWidth(printStroke.box);
  doc.line(lineStart, bottom, geo.left + geo.contentWidth, bottom);
}

/** Platzierung zeichnen. Rückgabe: y unter der letzten Zeile. */
export function renderRanking(doc: jsPDF, input: RankingInput, t: PdfTexts, geo: PageGeometry, yPos: number): number {
  const { state, teamCount, ranking, hasFinalRound } = input;
  const pending = state === 'open';

  const rowCount = pending ? teamCount : ranking.length;
  // Die Liste bleibt zusammen, wenn sie auf eine Seite passt; sonst beginnt sie hier und bricht zwischen Zeilen um
  const wholeList =
    printMetrics.sectionTitleUnderline + (pending ? printMetrics.placeSentenceAdvance : 0) + rowCount * printMetrics.placeRowHeight;
  const firstRows =
    printMetrics.sectionTableMinSpace + (pending ? printMetrics.placeSentenceAdvance : 0) + printMetrics.placeRowHeight;
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

  const rows = pending
    ? Array.from({ length: teamCount }, (_, i): { place: number; name: string | undefined } => ({ place: i + 1, name: undefined }))
    : ranking.map(entry => ({ place: entry.place, name: entry.team.name }));

  let top = yPos;
  rows.forEach(row => {
    if (top + printMetrics.placeRowHeight > geo.bottom) {
      doc.addPage();
      top = continuationTop(geo);
    }
    drawRow(doc, geo, top, row.place, row.name);
    top += printMetrics.placeRowHeight;
  });
  return top;
}
