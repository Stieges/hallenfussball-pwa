/**
 * Ergebniszelle zeichnen (B-28 C1, a3-5 und a4-1): Inhalt aus dem Zustand des Spiels (`matchResult.ts`) und der Regel
 * der Runde, Zeichnen im `didDrawCell`-Hook der Spieltabellen. Die Geometrie steht in `scoreLayout.ts`. Dazu der
 * Balken links an der Zeile eines laufenden Spiels und das Schreibfeld der Spalte „SR“. Nur Zeichnen, schwarz auf
 * weiß, Linien in `printStroke.box`.
 */
import type jsPDF from 'jspdf';
import { printBox, printColors, printStroke } from '../../../design-tokens/print';
import type { TiebreakerMode } from '../../../types/tournament';
import type { ResultState } from '../matchResult';
import { refereeFieldRect, scoreCellLayout, scoreContentHeight, type Rect, type ScoreSpec, type SmallRow } from '../scoreLayout';
import type { PdfTexts } from '../translations';
import { fontOf } from '../fonts';

/** Beschriftungen der kleinen Felder, die die Regel der Runde vorsieht (@DR-019). */
function ruleLabels(mode: TiebreakerMode | undefined, t: PdfTexts): string[] {
  if (mode === 'shootout') {
    return [t.shootout];
  }
  return mode === 'overtime-then-shootout' ? [t.afterOvertime, t.shootout] : [];
}

/** Zeilen kleiner Felder eines beendeten Spiels: nur, was das Turnier an Zahlen hat. */
function filledRows(state: Extract<ResultState, { kind: 'final' }>, t: PdfTexts): SmallRow[] {
  const rows: SmallRow[] = [];
  if (state.overtime) {
    rows.push({ label: t.afterOvertime, a: state.overtime.a, b: state.overtime.b });
  }
  if (state.penalty) {
    rows.push({ label: t.shootout, a: state.penalty.a, b: state.penalty.b });
  }
  return rows;
}

/** Inhalt der Ergebniszelle für den Zustand `state`; `mode` ist die Regel der Runde (nur K.-o.-Spiele). */
export function scoreSpecFor(state: ResultState, mode: TiebreakerMode | undefined, t: PdfTexts): ScoreSpec {
  const empty = ruleLabels(mode, t).map(label => ({ label }));
  switch (state.kind) {
    case 'skipped':
      return { kind: 'skipped', label: t.skipped, rows: [] };
    case 'live':
      return { kind: 'live', label: t.live, rows: empty };
    case 'final':
      return {
        kind: 'final',
        scoreA: state.scoreA,
        scoreB: state.scoreB,
        ...(state.mark ? { label: t.corrected(t.formatClock(state.mark.at)) } : {}),
        rows: filledRows(state, t),
      };
    default:
      return { kind: 'empty', rows: empty };
  }
}

/** Mindesthöhe der Zelle: Inhalt plus Innenabstand oben und unten. */
export function scoreCellMinHeight(spec: ScoreSpec, padV: number): number {
  return scoreContentHeight(spec) + 2 * padV;
}

function setInk(doc: jsPDF): void {
  doc.setDrawColor(...printColors.ink);
  doc.setFillColor(...printColors.ink);
  doc.setTextColor(...printColors.ink);
  doc.setLineWidth(printStroke.box);
}

/** Zeichnet Kästchen und Texte der Ergebniszelle in das Rechteck `cell`. */
export function drawScoreCell(doc: jsPDF, cell: Rect, spec: ScoreSpec): void {
  const { boxes, texts } = scoreCellLayout(cell, spec);
  setInk(doc);
  for (const box of boxes) {
    doc.rect(box.x, box.y, box.w, box.h, 'S');
  }
  for (const piece of texts) {
    doc.setFont(fontOf(doc), piece.bold ? 'bold' : 'normal');
    doc.setFontSize(piece.size);
    doc.text(piece.text, piece.x, piece.y, { align: 'center' });
  }
}

/** Balken links an der Zeile eines laufenden Spiels (ohne Farbe erkennbar). */
export function drawLiveBar(doc: jsPDF, cell: Rect): void {
  setInk(doc);
  doc.rect(cell.x, cell.y, printBox.liveBar, cell.h, 'F');
}

/** Leeres Schreibfeld in der Spalte „SR“. */
export function drawRefereeField(doc: jsPDF, cell: Rect, padH: number): void {
  setInk(doc);
  const box = refereeFieldRect(cell, padH);
  doc.rect(box.x, box.y, box.w, box.h, 'S');
}
