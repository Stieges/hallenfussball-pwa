/**
 * Seitenplanung der Gruppenspiele (@DR-002, @DR-033). Rein. Reserve-Regel bei Platzmangel auf Seite 1, in dieser
 * Reihenfolge und nie mit kleinerer Schrift: 1. Kurzname (Paket Kurznamen nach dem Turnier, @DR-033:teil), 2. Polster
 * über und unter dem Namen verringern (`printRowPad.tight`), 3. Folgeseite mit wiederholtem Spaltenkopf und mindestens
 * `printMatchRow.minRowsOnNextPage` Spielen. Passt alles, dürfen einzeilige Zeilen bis `maxHeight` wachsen.
 */
import { printMatchRow, printMatchTable, printRowPad, printZebra } from '../../../design-tokens/print-sheet';
import type { TextMeasure } from './measure';
import { buildHead, buildRow, layoutColumns, minRowHeight, naturalHeight, type ColumnFlags, type RowSource, type RowTexts } from './matchRows';
import type { ColumnKey, FitStep, MatchRowsBlock, MatchRowModel } from './types';

/** Satzspiegel, wie `pageGeometry` ihn liefert (nur die Maße, die die Planung braucht). */
export interface PlanFrame { left: number; width: number; bottom: number; continuationTop: number }

export interface RowsPlanInput {
  sources: RowSource[];
  flags: ColumnFlags;
  texts: RowTexts;
  labels: Partial<Record<ColumnKey, string>>;
  frame: PlanFrame;
  /** Oberkante des Spaltenkopfs auf Seite 1 (unter dem Kopf). */
  firstTop: number;
  measure: TextMeasure;
}

export interface RowsPlan { fit: FitStep; blocks: MatchRowsBlock[] }

const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0);

/** Zeilen auf Seiten verteilen (Greedy); die letzte Seite bekommt mindestens `minRows` Zeilen, wenn es mehr als eine gibt. */
export function splitRows(heights: number[], capacities: number[], minRows: number): number[][] {
  const pages: number[][] = [[]];
  let used = 0;
  heights.forEach((h, index) => {
    const cap = capacities[Math.min(pages.length - 1, capacities.length - 1)] ?? 0;
    if (used + h > cap && pages[pages.length - 1].length > 0) {
      pages.push([]);
      used = 0;
    }
    pages[pages.length - 1].push(index);
    used += h;
  });
  for (;;) {
    const last = pages[pages.length - 1];
    const before = pages[pages.length - 2];
    if (!before || last.length >= minRows || before.length <= 1) { break; }
    const moved = before.pop();
    if (moved === undefined) { break; }
    last.unshift(moved);
  }
  return pages;
}

/** Folgeseite (`nextPage`) wegen Platzmangel? Die Reserve-Regel in Zahlen: erst normal, dann eng, dann Folgeseite. */
export function planRows(input: RowsPlanInput): RowsPlan {
  const { sources, frame, measure } = input;
  const cols = layoutColumns(frame.left, frame.width, input.flags);
  const head = printMatchTable.headHeight;
  const firstBody = input.firstTop + head;
  const firstCap = frame.bottom - firstBody;
  const nextCap = frame.bottom - (frame.continuationTop + head);
  // Stundentrenner: vor der ersten Zeile einer neuen Stunde (auf einer Folgeseite zeichnet die erste Zeile keinen, braucht den Platz aber nicht)
  const hourStart = (i: number): boolean => i > 0 && sources[i - 1].hour !== sources[i].hour;
  const heights = (pad: number): number[] => sources.map((src, i) => naturalHeight(src, cols, pad, measure, hourStart(i)));

  let fit: FitStep = 'normal';
  let rowHeights = heights(printRowPad.normal);
  if (sum(rowHeights) > firstCap) {
    fit = 'tight';
    rowHeights = heights(printRowPad.tight);
  }
  let pages: number[][];
  if (sum(rowHeights) > firstCap) {
    fit = 'nextPage';
    rowHeights = heights(printRowPad.normal);
    pages = splitRows(rowHeights, [firstCap, nextCap], printMatchRow.minRowsOnNextPage);
  } else {
    pages = [sources.map((_, i) => i)];
    if (fit === 'normal') {
      const grow = Math.min((firstCap - sum(rowHeights)) / Math.max(1, sources.length), Math.max(0, printMatchRow.maxHeight - printMatchRow.minHeight));
      rowHeights = rowHeights.map((h, i) => (h === minRowHeight(hourStart(i)) ? Math.min(printMatchRow.maxHeight, h + grow) : h));
    }
  }

  const blocks = pages.map((indices, pageIndex): MatchRowsBlock => {
    const top = pageIndex === 0 ? input.firstTop : frame.continuationTop;
    let y = top + head;
    const rows: MatchRowModel[] = [];
    indices.forEach((sourceIndex, position) => {
      const src = sources[sourceIndex];
      const previous = position > 0 ? sources[indices[position - 1]] : undefined;
      const h = rowHeights[sourceIndex];
      rows.push(buildRow(src, cols, y, h, { zebra: position % 2 === (printZebra.firstRowTinted ? 0 : 1), hourRule: previous !== undefined && previous.hour !== src.hour }, input.texts, measure, { left: frame.left, width: frame.width }));
      y += h;
    });
    return { kind: 'matchRows', top, height: y - top, head: buildHead(cols, top, input.labels), rows };
  });
  return { fit, blocks };
}

/**
 * Folgen Finalrunde und Platzierung auf der Seite der Tabellen? Nur, wenn beide dort ganz Platz haben (@DR-002),
 * sonst beginnen sie auf einer neuen Seite. Die Zeichnung der Finalrunde folgt in T7b; die Entscheidung steht hier.
 */
export function finalsOnTablesPage(remaining: number, finalsHeight: number, rankingHeight: number, gap: number): boolean {
  return finalsHeight + (rankingHeight > 0 ? gap + rankingHeight : 0) <= remaining;
}
