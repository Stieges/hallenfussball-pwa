/**
 * Seiten der Endstand- und der Torschützen-Folie am Monitor (R3-7; @ZM-129, @ZM-121 Z. 1): reine Aufteilung ohne React.
 *
 * Dichte Folien blättern, statt die Schrift zu verkleinern oder Namen zu kürzen: Jede Zeile steht auf genau einer Seite, die
 * Reihenfolge bleibt. Eine Zeile kostet so viele „Zeilen“, wie ihr Name voraussichtlich umbricht (lange Namen belegen mehr
 * Platz, im Grenzfall 50 Zeichen nur 2 Teams je Seite, Mockup `mon-end-lang-1`). Gruppen gleichen Rangs (geteilte Plätze,
 * Torschützen mit gleicher Zahl Tore) bleiben auf einer Seite, solange sie auf eine passen; nur eine Gruppe, die allein zu
 * groß ist, wird geteilt.
 */
import type { FinalStandingRow, ScorerRow } from '../../core/standings/finalStandings';

/** Zeichen je Zeile des Namens bei der Schrift der Folie (Schätzung, bewusst vorsichtig: lieber eine Seite mehr als abgeschnitten). */
export const FINAL_CHARS_PER_LINE = 20;
/** Zeilen, die eine Seite fasst (Mockup: 6 Teams mit kurzem Namen je Seite). */
export const FINAL_LINES_PER_PAGE = 6;

/** Zeilen, die ein Text voraussichtlich belegt (mindestens eine). */
export function linesFor(text: string): number {
  return Math.max(1, Math.ceil([...text].length / FINAL_CHARS_PER_LINE));
}

interface Item<T> { row: T; weight: number; group: string }

function pack<T>(items: readonly Item<T>[]): T[][] {
  // Gruppen gleichen Rangs bilden (aufeinanderfolgende Zeilen mit demselben Schlüssel)
  const groups: Item<T>[][] = [];
  for (const item of items) {
    const last = groups.at(-1);
    if (last?.[0].group === item.group) { last.push(item); } else { groups.push([item]); }
  }
  const pages: Item<T>[][] = [[]];
  const load = (page: readonly Item<T>[]): number => page.reduce((sum, item) => sum + item.weight, 0);
  for (const group of groups) {
    const groupLoad = load(group);
    let current = pages[pages.length - 1];
    if (current.length > 0 && load(current) + groupLoad > FINAL_LINES_PER_PAGE && groupLoad <= FINAL_LINES_PER_PAGE) {
      current = [];
      pages.push(current);
    }
    for (const item of group) {
      if (current.length > 0 && load(current) + item.weight > FINAL_LINES_PER_PAGE) {
        current = [];
        pages.push(current);
      }
      current.push(item);
    }
  }
  return pages.map((page) => page.map((item) => item.row));
}

/** Seiten des Endstands: je Platz eine Zeile; geteilte Plätze (2, 2, 2, 5) bleiben zusammen. Mindestens eine Seite. */
export function rankingPages(ranking: readonly FinalStandingRow[]): FinalStandingRow[][] {
  return pack(ranking.map((row) => ({ row, weight: linesFor(row.teamName), group: String(row.place) })));
}

/** Text einer Torschützen-Zeile, soweit er die Seitenaufteilung bestimmt (Nummer und Teamname bzw. Sammelzeile). */
export function scorerLabelLength(row: ScorerRow): number {
  return row.kind === 'player' ? `#${String(row.number)} ${row.teamName}`.length : row.teamName.length + 16;
}

/** Seiten der Torschützenliste: gleicher Rang bleibt zusammen; Sammelzeilen ohne Rang stehen am Ende. Mindestens eine Seite. */
export function scorerPages(scorers: readonly ScorerRow[]): ScorerRow[][] {
  return pack(scorers.map((row) => ({
    row,
    weight: Math.max(1, Math.ceil(scorerLabelLength(row) / FINAL_CHARS_PER_LINE)),
    group: row.rank === null ? 'ohne-rang' : String(row.rank),
  })));
}
