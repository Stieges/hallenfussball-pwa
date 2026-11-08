/**
 * Seite „Siegerehrung“ im Endstand (@DR-052, Bild-OK Daniel 08.11.). Rein, fertig vermessen. Erst „Platzierung“: ALLE Plätze als eine
 * gleichförmige schlichte Liste (gleiche Schrift und Zeilenhöhe für jeden Platz, kein Treppchen, keine Kästen), Platznummer fett,
 * graue Linie unter jeder Zeile. Dann, wenn Tore mit Rückennummer erfasst sind, „Torschützen“: Rang | Verein | Nr. | Tore, ohne Namen
 * (@BM-035), Nr. fett mit Raute (@OB-075), Tore fett rechts, Rang nur bei der ersten Zeile seiner Gruppe (geteilter Rang wie in der
 * Bundesliga), Zeilen abwechselnd hinterlegt, darunter die Fußnote „Außerdem: 2 Tore ohne Rückennummer · 1 Eigentor“.
 * Ohne Torschützen mit Nummer gibt es weder Liste noch Überschrift noch Fußnote.
 *
 * Läuft die Seite über, bricht sie nur zwischen Zeilen um: Überschrift und Spaltenkopf bleiben bei ihrer ersten Zeile, die
 * Torschützenliste wiederholt auf der Folgeseite ihren Spaltenkopf.
 */
import type { ScorerRow } from '../../../core/standings/finalStandings/types';
import { printType } from '../../../design-tokens/print';
import { printCeremony } from '../../../design-tokens/print-endstand';
import { printMatchRow, printMatchTable } from '../../../design-tokens/print-sheet';
import type { RankEntry } from '../placement';
import type { ModelEnv } from './env';
import { wrapName } from './nameLines';
import type { Placeable, Splittable } from './sectionFlow';
import { advanceMm, ascent, centeredBaseline, run } from './text';
import type { Fill, Segment, StandingsTableBlock, TextRun } from './types';

type Player = Extract<ScorerRow, { kind: 'player' }>;

/** Ein unteilbares Stück der Seite. `keep`: bleibt mit dem nächsten Stück auf einer Seite (Überschrift, Spaltenkopf). */
type Piece =
  | { kind: 'title'; text: string; height: number; gap: number; keep: true }
  | { kind: 'place'; entry: RankEntry; lines: string[]; height: number; gap: 0 }
  | { kind: 'head'; height: number; gap: 0; keep: true }
  | { kind: 'scorer'; row: Player; lines: string[]; showRank: boolean; height: number; gap: 0 }
  | { kind: 'note'; lines: string[]; height: number; gap: number };

const rowHeight = (base: number, lines: number, adv: number): number => base + Math.max(0, lines - 1) * adv;

/** Torschützen mit Rückennummer und die Summen der Sammelzeilen. */
export function scorersOf(rows: readonly ScorerRow[]): { players: Player[]; noNumber: number; ownGoals: number } {
  const sum = (kind: 'noNumber' | 'ownGoals'): number => rows.filter(row => row.kind === kind).reduce((total, row) => total + row.goals, 0);
  return { players: rows.filter((row): row is Player => row.kind === 'player'), noNumber: sum('noNumber'), ownGoals: sum('ownGoals') };
}

/** Siegerehrung als Teile (eine oder mehrere Seiten); `scorers` aus dem gespeicherten Endstand. */
export function ceremonyParts(env: ModelEnv, ranking: readonly RankEntry[], scorers: readonly ScorerRow[]): Splittable {
  const { geo, t } = env.source;
  const c = printCeremony;
  const adv = advanceMm(printType.body, printMatchRow.lineHeight);
  const { players, noNumber, ownGoals } = scorersOf(scorers);
  const placeW = geo.contentWidth - c.placeNumberWidth;
  const clubX = geo.left + c.scorerCols.rank;
  const numberX = clubX + c.scorerCols.club;
  const goalsX = numberX + c.scorerCols.number;
  const clubW = c.scorerCols.club - c.scorerInsetLeft - c.scorerInsetRight / 2;

  const pieces: Piece[] = [{ kind: 'title', text: t.finalRanking, height: c.titleBand, gap: 0, keep: true }];
  for (const entry of ranking) {
    const lines = wrapName(entry.team.name, placeW, c.placePt, env.measure);
    pieces.push({ kind: 'place', entry, lines, height: rowHeight(c.placeRowHeight, lines.length, adv), gap: 0 });
  }
  if (players.length > 0) {
    pieces.push({ kind: 'title', text: t.ceremony.scorers, height: c.titleBand, gap: c.sectionGap, keep: true });
    pieces.push({ kind: 'head', height: c.scorerHeadHeight, gap: 0, keep: true });
    players.forEach((row, i) => {
      const lines = wrapName(row.teamName, clubW, c.scorerPt, env.measure);
      pieces.push({ kind: 'scorer', row, lines, showRank: i === 0 || players[i - 1].rank !== row.rank, height: rowHeight(c.scorerRowHeight, lines.length, adv), gap: 0 });
    });
    if (noNumber + ownGoals > 0) {
      const lines = wrapName(t.ceremony.also(noNumber, ownGoals), geo.contentWidth, c.notePt, env.measure);
      pieces.push({ kind: 'note', lines, height: lines.length * advanceMm(c.notePt, c.noteLineHeight), gap: c.noteGap });
    }
  }

  const used = (list: readonly Piece[]): number => list.reduce((sum, piece, i) => sum + (i > 0 ? piece.gap : 0) + piece.height, 0);
  const headPiece = pieces.find(piece => piece.kind === 'head') as Piece | undefined;

  /** Seiten: Stücke in Reihenfolge, bei Platzmangel auf die nächste Seite; angehängte Überschriften und Spaltenköpfe ziehen mit um. */
  const paginate = (capacity: number): Piece[][] => {
    const pages: Piece[][] = [[]];
    for (const piece of pieces) {
      const page = pages[pages.length - 1];
      if (page.length > 0 && used([...page, piece]) > capacity) {
        const carry: Piece[] = [];
        for (let last = page.at(-1); last !== undefined && 'keep' in last; last = page.at(-1)) { carry.unshift(last); page.pop(); }
        const next = carry.some(p => p.kind === 'head') || piece.kind !== 'scorer' || headPiece === undefined ? carry : [headPiece, ...carry];
        pages.push(next);
      }
      pages[pages.length - 1].push(piece);
    }
    return pages;
  };

  const build = (list: readonly Piece[]) => (top: number) => {
    const fills: Fill[] = [];
    const grid: Segment[] = [];
    const heavy: Segment[] = [];
    const runs: TextRun[] = [];
    const left = geo.left;
    const full = geo.contentWidth;
    let y = top;
    let placeRow = 0;
    let scorerRow = 0;
    let scorerEnd: number | undefined;
    list.forEach((piece, index) => {
      if (index > 0) { y += piece.gap; }
      const mid = y + piece.height / 2;
      const base = (lines: readonly string[], k: number, pt: number): number => centeredBaseline(mid + (k - (lines.length - 1) / 2) * adv, pt);
      switch (piece.kind) {
        case 'title':
          runs.push(run(piece.text, left, y + ascent(printType.h2), printType.h2, 'bold'));
          placeRow = 0;
          break;
        case 'place': {
          if (placeRow === 0) { grid.push({ x1: left, y1: y, x2: left + full, y2: y }); }
          runs.push(run(`${piece.entry.place}.`, left, base([''], 0, c.placePt), c.placePt, 'bold'));
          piece.lines.forEach((line, k) => runs.push(run(line, left + c.placeNumberWidth, base(piece.lines, k, c.placePt), c.placePt, 'normal')));
          grid.push({ x1: left, y1: y + piece.height, x2: left + full, y2: y + piece.height });
          placeRow += 1;
          break;
        }
        case 'head': {
          const headBase = centeredBaseline(mid, printMatchTable.headPt);
          fills.push({ kind: 'tableHead', x: left, y, w: c.scorerWidth, h: piece.height });
          runs.push(
            run(t.ceremony.rank, left + c.scorerCols.rank / 2, headBase, printMatchTable.headPt, 'bold', 'center'),
            run(t.ceremony.club, clubX + c.scorerInsetLeft, headBase, printMatchTable.headPt, 'bold'),
            run(t.nr, numberX + c.scorerInsetLeft, headBase, printMatchTable.headPt, 'bold'),
            run(t.goals, goalsX + c.scorerCols.goals - c.scorerInsetRight, headBase, printMatchTable.headPt, 'bold', 'right'),
          );
          heavy.push({ x1: left, y1: y + piece.height, x2: left + c.scorerWidth, y2: y + piece.height });
          scorerRow = 0;
          break;
        }
        case 'scorer': {
          if (scorerRow % 2 === 1) { fills.push({ kind: 'zebra', x: left, y, w: c.scorerWidth, h: piece.height }); }
          if (piece.showRank) { runs.push(run(`${piece.row.rank}.`, left + c.scorerCols.rank / 2, base([''], 0, c.scorerPt), c.scorerPt, 'bold', 'center')); }
          piece.lines.forEach((line, k) => runs.push(run(line, clubX + c.scorerInsetLeft, base(piece.lines, k, c.scorerPt), c.scorerPt, 'normal')));
          runs.push(
            run(`#${piece.row.number}`, numberX + c.scorerInsetLeft, base([''], 0, c.scorerPt), c.scorerPt, 'bold'),
            run(String(piece.row.goals), goalsX + c.scorerCols.goals - c.scorerInsetRight, base([''], 0, c.scorerPt), c.scorerPt, 'bold', 'right'),
          );
          scorerRow += 1;
          scorerEnd = y + piece.height;
          break;
        }
        case 'note':
          if (scorerEnd !== undefined) { grid.push({ x1: left, y1: scorerEnd, x2: left + c.scorerWidth, y2: scorerEnd }); scorerEnd = undefined; }
          piece.lines.forEach((line, k) => runs.push(run(line, left, centeredBaseline(y + (k + 1 / 2) * advanceMm(c.notePt, c.noteLineHeight), c.notePt), c.notePt, 'normal')));
          break;
      }
      y += piece.height;
    });
    // Die Torschützenliste schließt mit einer grauen Linie, auch ohne Fußnote
    if (scorerEnd !== undefined) { grid.push({ x1: left, y1: scorerEnd, x2: left + c.scorerWidth, y2: scorerEnd }); }
    const block: StandingsTableBlock = { kind: 'standingsTable', top, height: y - top, fills, grid, heavy, runs };
    return [block];
  };

  const placeable = (list: readonly Piece[]): Placeable => ({ height: used(list), build: build(list) });
  return {
    height: used(pieces),
    chunks: capacity => paginate(capacity).map(placeable),
  };
}
