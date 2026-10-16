/**
 * Geometrie der Ergebniszelle (B-28 C1, a3-5 und a4-1; @DR-001, @DR-004, @DR-019, @BM-011/012/013/045). Rein: nimmt
 * ein Rechteck der Zelle und eine Beschreibung des Inhalts, liefert Kästchen und Textstücke in mm. Gezeichnet wird in
 * `render/scoreCell.ts`. Maße nur aus den Druck-Tokens.
 */
import { printBox, printFont, printType, printUnit } from '../../design-tokens/print';

export interface Rect { x: number; y: number; w: number; h: number }

/** Ein Textstück: `y` ist die Grundlinie, `x` bei `center` die Mitte. */
export interface Piece { text: string; x: number; y: number; size: number; bold: boolean }

/** Eine Zeile kleiner Felder (Verlängerung, Strafstoßschießen) mit Beschriftung; Werte nur bei beendetem Spiel. */
export interface SmallRow { label: string; a?: number; b?: number }

/** Inhalt der Zelle: `skipped` zeigt nur den Kasten mit `label`, alle anderen zwei Kästchen. */
export interface ScoreSpec {
  kind: 'final' | 'live' | 'empty' | 'skipped';
  scoreA?: number;
  scoreB?: number;
  /** Kennzeichen unter dem Kasten („läuft“, „korrigiert 14:52“) oder Text im Kasten „ausgefallen“. */
  label?: string;
  rows: SmallRow[];
}

export interface ScoreLayout { boxes: Rect[]; texts: Piece[] }

const mm = (pt: number): number => pt * printUnit.mmPerPt;
/** Grundlinie einer Zeile, deren Oberkante auf `top` liegt. */
const baselineFrom = (top: number, pt: number): number => top + mm(pt) * printFont.ascentEm;
/** Grundlinie, bei der die Versalhöhe (Ziffern) in `[top, top + height]` mittig steht. */
const centeredBaseline = (top: number, height: number, pt: number): number => top + height / 2 + (mm(pt) * printFont.capEm) / 2;
/** Grundlinie, bei der ein Doppelpunkt in `[top, top + height]` mittig steht. */
const colonBaseline = (top: number, height: number, pt: number): number => top + height / 2 + mm(pt) * printFont.colonMidEm;
const lineHeight = (pt: number): number => mm(pt) * printBox.smallLineEm;

/** Breite von zwei Kästchen mit Doppelpunkt. */
const blockWidth = (): number => 2 * printBox.scoreField.w + 2 * printBox.scoreGap + printBox.colonWidth;

function hasMark(spec: ScoreSpec): boolean {
  return spec.kind !== 'skipped' && spec.label !== undefined;
}

/** Höhe des Inhalts ohne Innenabstand der Zelle. */
export function scoreContentHeight(spec: ScoreSpec): number {
  const main = spec.kind === 'skipped' ? printBox.cancel.h : printBox.scoreField.h;
  const mark = hasMark(spec) ? printBox.markGap + lineHeight(printType.mark) : 0;
  const rows = spec.kind === 'skipped' ? 0 : spec.rows.length;
  const perRow = printBox.penGap + lineHeight(printType.penLabel) + printBox.penLabelGap + printBox.penField.h;
  return main + mark + rows * perRow;
}

/** Zeichnet-Schritte der Zelle: Inhalt mittig in `cell` (waagerecht und senkrecht). */
export function scoreCellLayout(cell: Rect, spec: ScoreSpec): ScoreLayout {
  const boxes: Rect[] = [];
  const texts: Piece[] = [];
  const cx = cell.x + cell.w / 2;
  let top = cell.y + (cell.h - scoreContentHeight(spec)) / 2;

  if (spec.kind === 'skipped') {
    boxes.push({ x: cx - printBox.cancel.w / 2, y: top, w: printBox.cancel.w, h: printBox.cancel.h });
    texts.push({ text: spec.label ?? '', x: cx, y: centeredBaseline(top, printBox.cancel.h, printType.cancel), size: printType.cancel, bold: true });
    return { boxes, texts };
  }

  const left = cx - blockWidth() / 2;
  const right = left + printBox.scoreField.w + 2 * printBox.scoreGap + printBox.colonWidth;
  const field = printBox.scoreField;
  boxes.push({ x: left, y: top, w: field.w, h: field.h }, { x: right, y: top, w: field.w, h: field.h });
  texts.push({ text: ':', x: cx, y: colonBaseline(top, field.h, printType.resultColon), size: printType.resultColon, bold: true });
  if (spec.kind === 'final') {
    const digit = (value: number | undefined, boxX: number): void => {
      if (value !== undefined) {
        texts.push({ text: String(value), x: boxX + field.w / 2, y: centeredBaseline(top, field.h, printType.result), size: printType.result, bold: true });
      }
    };
    digit(spec.scoreA, left);
    digit(spec.scoreB, right);
  }
  top += field.h;

  if (hasMark(spec)) {
    top += printBox.markGap;
    texts.push({ text: spec.label ?? '', x: cx, y: baselineFrom(top, printType.mark), size: printType.mark, bold: spec.kind === 'live' });
    top += lineHeight(printType.mark);
  }

  const pen = printBox.penField;
  for (const row of spec.rows) {
    top += printBox.penGap;
    texts.push({ text: row.label, x: cx, y: baselineFrom(top, printType.penLabel), size: printType.penLabel, bold: false });
    top += lineHeight(printType.penLabel) + printBox.penLabelGap;
    boxes.push({ x: left, y: top, w: pen.w, h: pen.h }, { x: right, y: top, w: pen.w, h: pen.h });
    texts.push({ text: ':', x: cx, y: colonBaseline(top, pen.h, printType.penField), size: printType.penField, bold: true });
    for (const [value, boxX] of [[row.a, left], [row.b, right]] as const) {
      if (value !== undefined) {
        texts.push({ text: String(value), x: boxX + pen.w / 2, y: centeredBaseline(top, pen.h, printType.penField), size: printType.penField, bold: true });
      }
    }
    top += pen.h;
  }
  return { boxes, texts };
}

/** Leeres Schreibfeld in der Spalte „SR“: so breit wie die Zelle abzüglich Innenabstand, mittig. */
export function refereeFieldRect(cell: Rect, padH: number): Rect {
  const h = printBox.refereeFieldH;
  return { x: cell.x + padH, y: cell.y + (cell.h - h) / 2, w: cell.w - 2 * padH, h };
}
