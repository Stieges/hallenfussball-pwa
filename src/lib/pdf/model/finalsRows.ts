/**
 * Zeilen der Finalrunde (@DR-019, @DR-034, @DR-037). Rein. Anders als bei den Gruppenspielen sitzt der Inhalt einer Zeile auf der
 * Schreiblinie: Nummer, Zeit, Name und die Ziffern eines Ergebnisses teilen eine Grundlinie knapp über ihr. Darunter steht
 * klein (7,5 pt) die Herkunft eines offenen Platzes („Sieger Spiel 25“) bzw. die Beschriftung kleiner Linien.
 *
 * Formeln (Tokens in `print-sheet.ts`): Linie = Oberkante + `above`, `above` = max(`minWriteSpace`, Namenszeilen über der Grundlinie);
 * darunter `below` (Herkunft samt Abstand). Stehen zwei kleine Paare (Verlängerung, Strafstoßschießen), liegt das zweite eine
 * Stufe tiefer, damit über jeder Linie 5 mm frei bleiben und die Beschriftungen sich nicht berühren.
 */
import { printType } from '../../../design-tokens/print';
import { printFinals, printMatchRow, printMatchTable, printWriteLine } from '../../../design-tokens/print-sheet';
import {
  cellOf, column, nameLinesIn, refereeLinesIn,
  type RowSource, type RowTexts,
} from './matchRows';
import type { TextMeasure } from './measure';
import { advanceMm, ascent, centeredBaseline, descent, run } from './text';
import type { ColumnModel, MatchRowModel, SideModel, TextRun, WriteLine } from './types';

/** Höhe von Herkunft bzw. Beschriftung unter einer Linie: Abstand, Schrift, Luft zum Zeilenboden. */
const textBelow = (): number => printFinals.textGap + ascent(printFinals.smallPt) + descent(printFinals.smallPt);
const below = (): number => textBelow() + printFinals.bottomPad;
/** Abstand der Linien zweier kleiner Paare: Beschriftung des ersten plus Schreibraum über dem zweiten. */
const pairStep = (): number => textBelow() + printWriteLine.minWriteSpace;

/** Zeilenzahl eines Teamnamens in seiner Spalte; 0 bei offenem Platz (Herkunft statt Name). */
function nameCount(name: string, origin: string | undefined, col: ColumnModel | undefined, measure: TextMeasure): number {
  return origin !== undefined || col === undefined ? 0 : nameLinesIn(name, col, measure).length;
}

/** Abstand Oberkante → Schreiblinie und Höhe der Zeile. */
export function finalsRowMetrics(src: RowSource, cols: ColumnModel[], measure: TextMeasure): { above: number; height: number } {
  const referee = column(cols, 'referee');
  const lines = Math.max(
    nameCount(src.home, src.homeOrigin, column(cols, 'home'), measure),
    nameCount(src.away, src.awayOrigin, column(cols, 'away'), measure),
    referee ? refereeLinesIn(src.referee, referee, measure).length : 0,
    1
  );
  const adv = advanceMm(printType.body, printMatchRow.lineHeight);
  const above = Math.max(printWriteLine.minWriteSpace, printFinals.baselineRise + (lines - 1) * adv + ascent(printType.body) + printFinals.bottomPad);
  return { above, height: above + below() + Math.max(0, src.small.length - 1) * pairStep() };
}

function sideOf(name: string, origin: string | undefined, col: ColumnModel, key: 'home' | 'away', lineY: number, measure: TextMeasure): { side: SideModel; line?: WriteLine } {
  const right = key === 'home';
  if (origin !== undefined) {
    const x1 = right ? col.x + printFinals.nameOuter : col.x + printWriteLine.nameInset;
    const x2 = right ? col.x + col.w - printWriteLine.nameInset : col.x + col.w - printFinals.nameOuter;
    const text = run(origin, x1, lineY + printFinals.textGap + ascent(printFinals.smallPt), printFinals.smallPt, 'normal');
    return { side: { name: [], origin, runs: [text] }, line: { kind: 'name', x1, x2, y: lineY } };
  }
  const lines = nameLinesIn(name, col, measure);
  const adv = advanceMm(printType.body, printMatchRow.lineHeight);
  const x = right ? col.x + col.w - printMatchTable.nameInner : col.x + printMatchTable.nameInner;
  const runs = lines.map((text, i) => run(text, x, lineY - printFinals.baselineRise - (lines.length - 1 - i) * adv, printType.body, 'normal', right ? 'right' : 'left'));
  return { side: { name: lines, runs } };
}

/** Kleine Paare in der Spalte `shootout`: je Art eine Stufe; bei einem beendeten Spiel steht der Wert statt der Linien. */
function smallOf(src: RowSource, col: ColumnModel | undefined, lineY: number, texts: RowTexts): { lines: WriteLine[]; runs: TextRun[] } {
  const lines: WriteLine[] = [];
  const runs: TextRun[] = [];
  if (!col || src.state.kind === 'skipped') { return { lines, runs }; }
  const done = src.state.kind === 'final' ? src.state : undefined;
  const mid = col.x + col.w / 2;
  const half = printWriteLine.small + printWriteLine.smallColon / 2;
  src.small.forEach((kind, i) => {
    const value = kind === 'overtime' ? done?.overtime : done?.penalty;
    if (done && !value) { return; }
    const y = lineY + i * pairStep();
    const label = kind === 'overtime' ? texts.overtime : texts.shootout;
    if (value) {
      runs.push(run(`${value.a} : ${value.b}`, mid, y - printFinals.baselineRise, printType.body, 'bold', 'center'));
    } else {
      lines.push({ kind: 'small', x1: mid - half, x2: mid - half + printWriteLine.small, y }, { kind: 'small', x1: mid + half - printWriteLine.small, x2: mid + half, y });
      runs.push(run(':', mid, y - printMatchTable.colonLift, printType.mark, 'bold', 'center'));
    }
    runs.push(run(label, mid, y + printFinals.textGap + ascent(printFinals.smallPt), printFinals.smallPt, 'normal', 'center'));
  });
  return { lines, runs };
}

/** Baut eine Zeile der Finalrunde an `top`; die Höhe kommt aus `finalsRowMetrics`. */
export function buildFinalsRow(
  src: RowSource, cols: ColumnModel[], top: number, zebra: boolean, texts: RowTexts, measure: TextMeasure, bounds: { left: number; width: number }
): MatchRowModel {
  const { above, height } = finalsRowMetrics(src, cols, measure);
  const lineY = top + above;
  const base = lineY - printFinals.baselineRise;
  const get = (key: ColumnModel['key']): ColumnModel => column(cols, key) ?? { key, x: 0, w: 0 };
  const nr = get('nr');
  const time = get('time');
  const home = sideOf(src.home, src.homeOrigin, get('home'), 'home', lineY, measure);
  const away = sideOf(src.away, src.awayOrigin, get('away'), 'away', lineY, measure);
  const { cell, lines } = cellOf(src, cols, top, height, texts, { lineY, centerY: base - capHalf() });
  const small = smallOf(src, column(cols, 'shootout'), lineY, texts);
  const refCol = column(cols, 'referee');
  const refLines = refCol ? refereeLinesIn(src.referee, refCol, measure) : [];
  const refAdv = advanceMm(printMatchTable.refPt, printMatchRow.lineHeight);
  const referee = refCol && refLines.length > 0
    ? refLines.map((text, i) => run(text, refCol.x + printMatchTable.refInset, base - (refLines.length - 1 - i) * refAdv, printMatchTable.refPt, 'normal'))
    : undefined;
  const fieldCol = column(cols, 'field');
  const model: MatchRowModel = {
    matchId: src.matchId,
    number: src.number,
    box: { x: bounds.left, y: top, w: bounds.width, h: height },
    zebra,
    nr: run(String(src.number), nr.x + nr.w / 2, base, printType.nr, 'normal', 'center'),
    time: run(src.time, time.x + printMatchTable.timeInset, base, printType.time, 'bold', 'left'),
    home: home.side,
    cell: { ...cell, runs: [...cell.runs, ...small.runs] },
    away: away.side,
    lines: [...(home.line ? [home.line] : []), ...lines, ...small.lines, ...(away.line ? [away.line] : [])],
  };
  if (referee) { model.referee = referee; }
  if (fieldCol && src.field !== undefined) {
    model.field = run(src.field, fieldCol.x + fieldCol.w / 2, base, printType.nr, 'normal', 'center');
  }
  return model;
}

/** Halbe Versalhöhe der Ergebnisziffern: so weit liegt ihre Mitte über der Grundlinie. */
function capHalf(): number {
  return centeredBaseline(0, printType.result);
}
