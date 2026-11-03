/**
 * Spalten, Höhen und Zeilen der Spieltabelle (@DR-004, @DR-019, @DR-025, @DR-032, @DR-033, @DR-034). Rein: gemessen wird
 * über `TextMeasure`, gezeichnet wird in `render/matchRowsDraw.ts`. Alle Positionen in mm ab der Papierecke.
 *
 * Formeln (Tokens in `print-sheet.ts`):
 * - Namenszeile = Schrift `printType.body` × `printMatchRow.lineHeight`; Zeilenhöhe = max(`minHeight`, Zeilen × Namenszeile
 *   + 2 × Polster), die Spalte „SR“ zählt mit ihren Zeilen (Schrift `refPt`).
 * - Schreiblinie = Zeilenboden − `printWriteLine.aboveRowBottom`, in jeder Zeile gleich, auch bei mehrzeiligem Namen.
 * - Ergebnislinien liegen mittig in der Spalte „Ergebnis“: Linie, Doppelpunkt, Linie.
 */
import { printType } from '../../../design-tokens/print';
import { printFinals, printGroupMark, printHourRule, printMatchRow, printMatchTable, printWriteLine } from '../../../design-tokens/print-sheet';
import type { ResultState } from '../matchResult';
import type { TextMeasure } from './measure';
import { wrapName } from './nameLines';
import { advanceMm, centeredBaseline, run } from './text';
import type { ColumnKey, ColumnModel, GroupMark, MatchHeadModel, MatchRowModel, ResultCell, SideModel, SmallLineKind, TextRun, WriteLine } from './types';

/** Welche Spalten es gibt. `shootout` gibt es nur in der Finalrunde (T7b). */
export interface ColumnFlags {
  /** Finalrunde: schmalere feste Spalten (`printFinals.cols`), kleine Linien untereinander in einer Spalte (@DR-037). */
  finals?: boolean;
  field: boolean;
  group: boolean;
  referee: boolean;
  /** Zahl der kleinen Paare der Finalrunde; ab 1 gibt es die Spalte `shootout` (Paare stehen untereinander, @DR-019). */
  smallPairs: number;
  /** Breite der Spalte „SR“ aus ihrem Inhalt (gemessen, höchstens `printMatchTable.cols.referee`); ohne Angabe die volle Breite. */
  refereeWidth?: number;
}

/** Beschriftungen, die in der Zeile vorkommen (alle übersetzt). */
export interface RowTexts { skipped: string; overtime: string; shootout: string }

/** Eine Spielzeile, wie das Modell sie bekommt: fertig angezeigte Namen, Zustand, Schiedsrichter. */
export interface RowSource {
  matchId: string;
  number: number;
  time: string;
  hour: number;
  field?: string;
  group?: { code: string; shape: GroupMark['shape'] };
  home: string;
  away: string;
  /** Herkunft eines offenen Finalplatzes („Sieger Spiel 25“): der Platz hat eine Namenslinie, `home`/`away` bleibt leer (@DR-037). */
  homeOrigin?: string;
  awayOrigin?: string;
  state: ResultState;
  /** Kennzeichen unter dem Ergebnis eines korrigierten Spiels („korrigiert 14:52“). */
  markText?: string;
  /** Nur Nummer oder pfeifendes Team (@DR-025); leer = nichts eingetragen. */
  referee: string;
  /** Kleine Linien der Regel der Runde (@DR-019); nur in der Finalrunde. */
  small: SmallLineKind[];
}

/** Spalten in Reihenfolge, Heim und Gast teilen den Rest gleich; die Spalte „SR“ ist so breit wie ihr Inhalt (@DR-025: nur Nummer oder Teamname), nie breiter als der Token. */
export function layoutColumns(left: number, width: number, flags: ColumnFlags): ColumnModel[] {
  const c = flags.finals ? { ...printMatchTable.cols, ...printFinals.cols } : printMatchTable.cols;
  const refW = flags.referee ? Math.min(c.referee, flags.refereeWidth ?? c.referee) : 0;
  const shootoutW = flags.smallPairs === 0 ? 0 : printFinals.pairColumn;
  const fixed = c.nr + c.time + (flags.field ? c.field : 0) + (flags.group ? c.group : 0) + c.result + shootoutW + refW;
  const side = (width - fixed) / 2;
  const plan: Array<[ColumnKey, number]> = [['nr', c.nr], ['time', c.time]];
  if (flags.field) { plan.push(['field', c.field]); }
  if (flags.group) { plan.push(['group', c.group]); }
  plan.push(['home', side], ['result', c.result]);
  if (flags.smallPairs > 0) { plan.push(['shootout', shootoutW]); }
  plan.push(['away', side]);
  if (flags.referee) { plan.push(['referee', refW]); }
  let x = left;
  return plan.map(([key, w]) => {
    const column = { key, x, w };
    x += w;
    return column;
  });
}

export const column = (cols: ColumnModel[], key: ColumnKey): ColumnModel | undefined => cols.find(c => c.key === key);

/** Zeilen eines Namens in seiner Spalte. */
export function nameLinesIn(name: string, col: ColumnModel, measure: TextMeasure): string[] {
  return wrapName(name, col.w - printMatchTable.nameInner - printMatchTable.nameOuter, printType.body, measure);
}

/** Zeilen des Schiedsrichter-Eintrags in seiner Spalte. */
export function refereeLinesIn(label: string, col: ColumnModel, measure: TextMeasure): string[] {
  return label === '' ? [] : wrapName(label, col.w - printMatchTable.refInset, printMatchTable.refPt, measure);
}

/**
 * Kleinste Zeilenhöhe: `minHeight`; eine Zeile mit Stundentrenner braucht zusätzlich Platz für den Trenner, damit über der Linie bis
 * zur Unterkante des Trenners noch `minWriteSpace` frei bleiben (@DR-034).
 */
export function minRowHeight(hourRule: boolean): number {
  const withRule = printWriteLine.aboveRowBottom + printWriteLine.minWriteSpace + printHourRule.inset + printHourRule.stroke;
  return hourRule ? Math.max(printMatchRow.minHeight, withRule) : printMatchRow.minHeight;
}

/** Höhe einer Zeile ohne Dehnung bei Polster `pad`; `hourRule`: über der Zeile liegt ein Stundentrenner. */
export function naturalHeight(src: RowSource, cols: ColumnModel[], pad: number, measure: TextMeasure, hourRule = false): number {
  const home = column(cols, 'home');
  const away = column(cols, 'away');
  const referee = column(cols, 'referee');
  const names = Math.max(home ? nameLinesIn(src.home, home, measure).length : 1, away ? nameLinesIn(src.away, away, measure).length : 1, 1);
  const refLines = referee ? refereeLinesIn(src.referee, referee, measure).length : 0;
  const text = Math.max(names * advanceMm(printType.body, printMatchRow.lineHeight), refLines * advanceMm(printMatchTable.refPt, printMatchRow.lineHeight));
  return Math.max(minRowHeight(hourRule), text + 2 * pad);
}

/** Spaltenkopf: Beschriftungen fett, Linie darunter. `top` ist die Oberkante. */
export function buildHead(cols: ColumnModel[], top: number, labels: Partial<Record<ColumnKey, string>>): MatchHeadModel {
  const baseline = centeredBaseline(top + printMatchTable.headHeight / 2, printMatchTable.headPt);
  const runs: TextRun[] = [];
  for (const col of cols) {
    const text = labels[col.key];
    if (text === undefined || text === '') { continue; }
    const side = col.key === 'home' ? 'right' : col.key === 'away' ? 'left' : 'center';
    const x = side === 'right' ? col.x + col.w - printMatchTable.nameInner : side === 'left' ? col.x + printMatchTable.nameInner : col.x + col.w / 2;
    runs.push(run(text, x, baseline, printMatchTable.headPt, 'bold', side));
  }
  const last = cols[cols.length - 1];
  const first = cols[0];
  const y = top + printMatchTable.headHeight;
  return {
    columns: cols,
    labels: runs,
    rule: { kind: 'tableHead', x1: first?.x ?? 0, x2: (last?.x ?? 0) + (last?.w ?? 0), y },
  };
}

function sideOf(lines: string[], col: ColumnModel, top: number, height: number): SideModel {
  const adv = advanceMm(printType.body, printMatchRow.lineHeight);
  const right = col.key === 'home';
  const x = right ? col.x + col.w - printMatchTable.nameInner : col.x + printMatchTable.nameInner;
  const runs = lines.map((text, i) => run(text, x, centeredBaseline(top + height / 2 + printMatchRow.contentDrop + (i - (lines.length - 1) / 2) * adv, printType.body), printType.body, 'normal', right ? 'right' : 'left'));
  return { name: lines, runs };
}

/** Lage der Ergebniszelle in der Zeile: Höhe der Schreiblinien und Mitte des Inhalts (Ziffern, „ausgefallen“). */
export interface CellGeometry { lineY: number; centerY: number }

export function cellOf(src: RowSource, cols: ColumnModel[], top: number, height: number, texts: RowTexts, geometry?: CellGeometry): { cell: ResultCell; lines: WriteLine[] } {
  const col = column(cols, 'result');
  const cx = (col?.x ?? 0) + (col?.w ?? 0) / 2;
  const bottom = top + height;
  const lineY = geometry?.lineY ?? bottom - printWriteLine.aboveRowBottom;
  const middle = geometry?.centerY ?? top + height / 2 + printMatchRow.contentDrop;
  const narrow = column(cols, 'referee') !== undefined || column(cols, 'shootout') !== undefined || (col?.w ?? 0) < 2 * printWriteLine.result + printWriteLine.colon;
  const w = narrow ? printWriteLine.resultNarrow : printWriteLine.result;
  const colon = narrow ? printWriteLine.colonNarrow : printWriteLine.colon;
  const colonRun = run(':', cx, lineY - printMatchTable.colonLift, printWriteLine.colonPt, 'bold', 'center');
  const lines: WriteLine[] = [
    { kind: 'result', x1: cx - colon / 2 - w, x2: cx - colon / 2, y: lineY },
    { kind: 'result', x1: cx + colon / 2, x2: cx + colon / 2 + w, y: lineY },
  ];
  const state = src.state;
  if (state.kind === 'final') {
    const marks = src.markText === undefined ? [] : [src.markText];
    const centerY = middle - (marks.length > 0 ? printMatchTable.markGap + printMatchTable.liveInset : 0);
    const base = centeredBaseline(centerY, printType.result);
    const runs = [
      run(String(state.scoreA), cx - printMatchTable.scoreGap, base, printType.result, 'bold', 'right'),
      run(':', cx, centeredBaseline(centerY, printType.resultColon), printType.resultColon, 'bold', 'center'),
      run(String(state.scoreB), cx + printMatchTable.scoreGap, base, printType.result, 'bold', 'left'),
      ...marks.map(text => run(text, cx, bottom - printMatchTable.markGap, printType.mark, 'normal', 'center')),
    ];
    return { cell: { kind: 'score', a: String(state.scoreA), b: String(state.scoreB), marks, runs }, lines: [] };
  }
  if (state.kind === 'skipped') {
    const runs = [run(texts.skipped, cx, centeredBaseline(middle, printType.cancel), printType.cancel, 'normal', 'center')];
    return { cell: { kind: 'text', text: texts.skipped, runs }, lines: [] };
  }
  // Ein laufendes Spiel (auch in der Halbzeit) steht wie ein Spiel ohne Ergebnis da: leere Schreiblinien, kein Text, kein Zwischenstand (@DR-019)
  const runs = [colonRun];
  return { cell: { kind: 'lines', small: src.small, runs }, lines };
}

/** Baut eine Zeile an `top` mit `height`. */
export function buildRow(
  src: RowSource, cols: ColumnModel[], top: number, height: number, flags: { zebra: boolean; hourRule: boolean },
  texts: RowTexts, measure: TextMeasure, bounds: { left: number; width: number }
): MatchRowModel {
  const mid = top + height / 2 + printMatchRow.contentDrop;
  const get = (key: ColumnKey): ColumnModel => column(cols, key) ?? { key, x: 0, w: 0 };
  const homeCol = get('home');
  const awayCol = get('away');
  const nr = get('nr');
  const time = get('time');
  const { cell, lines } = cellOf(src, cols, top, height, texts);
  const groupCol = column(cols, 'group');
  const group: GroupMark | undefined = groupCol && src.group
    ? {
      text: run(src.group.code, groupCol.x + groupCol.w / 2, centeredBaseline(mid, printType.nr), printType.nr, 'bold', 'center'),
      frame: { x: groupCol.x + (groupCol.w - printGroupMark.size) / 2, y: mid - printGroupMark.size / 2, w: printGroupMark.size, h: printGroupMark.size },
      shape: src.group.shape,
    }
    : undefined;
  const refCol = column(cols, 'referee');
  const refLines = refCol ? refereeLinesIn(src.referee, refCol, measure) : [];
  const refAdv = advanceMm(printMatchTable.refPt, printMatchRow.lineHeight);
  const referee = refCol && refLines.length > 0
    ? refLines.map((text, i) => run(text, refCol.x + printMatchTable.refInset, centeredBaseline(mid + (i - (refLines.length - 1) / 2) * refAdv, printMatchTable.refPt), printMatchTable.refPt, 'normal'))
    : undefined;
  const rowRun = (text: string, x: number, pt: number, weight: 'normal' | 'bold', align: TextRun['align']): TextRun => run(text, x, centeredBaseline(mid, pt), pt, weight, align);
  const model: MatchRowModel = {
    matchId: src.matchId,
    number: src.number,
    box: { x: bounds.left, y: top, w: bounds.width, h: height },
    zebra: flags.zebra,
    nr: rowRun(String(src.number), nr.x + nr.w / 2, printType.nr, 'normal', 'center'),
    time: rowRun(src.time, time.x + printMatchTable.timeInset, printType.time, 'bold', 'left'),
    home: sideOf(nameLinesIn(src.home, homeCol, measure), homeCol, top, height),
    cell,
    away: sideOf(nameLinesIn(src.away, awayCol, measure), awayCol, top, height),
    lines,
  };
  if (flags.hourRule) {
    model.ruleAbove = { kind: 'hour', x1: bounds.left, x2: bounds.left + bounds.width, y: top + printHourRule.inset + printHourRule.stroke / 2 };
  }
  const fieldCol = column(cols, 'field');
  if (fieldCol && src.field !== undefined) { model.field = rowRun(src.field, fieldCol.x + fieldCol.w / 2, printType.nr, 'normal', 'center'); }
  if (group) { model.group = group; }
  if (referee) { model.referee = referee; }
  return model;
}
