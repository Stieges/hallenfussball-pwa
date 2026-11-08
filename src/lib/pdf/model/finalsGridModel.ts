/**
 * Finalrunde im Endstand als Raster (@DR-054, Muster A, Bild-OK Daniel 08.11.). Rein, fertig vermessen: dünne graue Linien um jede
 * Zelle (wie die Tabellen), jede Spielzeile gleich hoch, Spalte „Ergebnis“ hinterlegt, Spaltenköpfe mittig, unter dem Ergebnis in derselben
 * Zelle die Zusatzzeile „Strafstoßschießen 4 : 3“ bzw. „Verlängerung 1 : 0“ (Wort klein, Zahl fett und mindestens 12 pt), Rundenname
 * fett über seinen Spielen, ab der zweiten Runde mit einer Linie in der Akzentfarbe darüber, keine abwechselnd hinterlegten Zeilen.
 *
 * Formeln (Tokens in `print-endstand.ts`): Zeilenhöhe = max(`rowHeight`, `rowTop` + Hauptzeile + Zusatzzeilen + `rowBottomPad`), für ALLE Zeilen gleich
 * (die Zeile mit den meisten Zusatzzeilen bzw. Namenszeilen bestimmt sie). Die Hauptzeile (Nr., Zeit, Namen, Ziffern) sitzt mittig im Block
 * `rowTop` bis `rowTop` + Hauptzeile; darunter folgen die Zusatzzeilen. Die Schreiblinien-Fassung bleibt `finalsModel.ts` (@DR-034).
 */
import { printType } from '../../../design-tokens/print';
import { printFinalsGrid } from '../../../design-tokens/print-endstand';
import { printMatchRow, printMatchTable } from '../../../design-tokens/print-sheet';
import type { ModelEnv } from './env';
import { finalRounds, roundTitle } from './finalRounds';
import { koBlock, sourceOf } from './finalsSource';
import type { RowSource } from './matchRows';
import { wrapName } from './nameLines';
import type { Placeable, Splittable } from './sectionFlow';
import { advanceMm, centeredBaseline, run } from './text';
import type { StatefulMatch } from '../tournamentState';
import type { Block, Fill, Segment, StandingsTableBlock, TextRun } from './types';

type ColumnKey = 'nr' | 'time' | 'field' | 'home' | 'result' | 'away';
interface Col { key: ColumnKey; x: number; w: number }
/** Eine Zeile der Zusatzzeile: Wort (klein) und, wenn vorhanden, Zahl (fett, mindestens 12 pt) oder nur ein Kennzeichen. */
interface Extra { word: string; value?: string }

const NAME_LINE = (): number => advanceMm(printType.body, printMatchRow.lineHeight);

/** Senkrechte Linien einer Zeile (`printFinalsGrid.verticals`, geparkt: „Mischung aus A und D“): `all` immer, `parallel` nur bei gleichzeitigen Spielen. */
export function verticalsVisible(mode: 'all' | 'parallel', parallel: boolean): boolean {
  return mode === 'all' || parallel;
}

/** Höhe des Blocks der Hauptzeile: eine Zeile `mainLine`, mehr Namenszeilen machen ihn höher. */
const mainHeight = (nameLines: number): number => Math.max(printFinalsGrid.mainLine, nameLines * NAME_LINE());

/** Höhe jeder Spielzeile bei höchstens `nameLines` Namenszeilen und `extraLines` Zusatzzeilen in einer Zeile. */
export function gridRowHeight(nameLines: number, extraLines: number): number {
  const extra = extraLines > 0 ? printFinalsGrid.extraGap + extraLines * printFinalsGrid.extraLine : 0;
  return Math.max(printFinalsGrid.rowHeight, printFinalsGrid.rowTop + mainHeight(nameLines) + extra + printFinalsGrid.rowBottomPad);
}

/** Spalten: feste Breiten aus `printFinalsGrid.cols`, Heim und Gast teilen den Rest; „Feld“ nur bei mehr als einem Feld. */
function columnsOf(left: number, width: number, field: boolean): Col[] {
  const c = printFinalsGrid.cols;
  const side = (width - c.nr - c.time - c.result - (field ? c.field : 0)) / 2;
  const plan: Array<[ColumnKey, number]> = [['nr', c.nr], ['time', c.time]];
  if (field) { plan.push(['field', c.field]); }
  plan.push(['home', side], ['result', c.result], ['away', side]);
  let x = left;
  return plan.map(([key, w]) => {
    const col = { key, x, w };
    x += w;
    return col;
  });
}

/** Zusatzzeilen eines Spiels in zeitlicher Folge: Verlängerung, Strafstoßschießen, dann ein Kennzeichen („gewertet“, „korrigiert 14:52“). */
function extrasOf(src: RowSource, t: { overtimeWord: string; shootout: string }): Extra[] {
  if (src.state.kind !== 'final') { return []; }
  const { overtime, penalty } = src.state;
  return [
    ...(overtime ? [{ word: t.overtimeWord, value: `${overtime.a} : ${overtime.b}` }] : []),
    ...(penalty ? [{ word: t.shootout, value: `${penalty.a} : ${penalty.b}` }] : []),
    ...(src.markText === undefined ? [] : [{ word: src.markText }]),
  ];
}

/** Finalrunde des Endstands als Teile; `undefined`, wenn es keine Finalspiele gibt. */
export function finalsGridParts(env: ModelEnv): Splittable | undefined {
  const { source, measure } = env;
  const { input, t, geo } = source;
  const finals = input.schedule.phases.filter(p => p.name !== 'groupStage').flatMap(p => p.matches) as StatefulMatch[];
  if (finals.length === 0) { return undefined; }
  const g = printFinalsGrid;
  const cols = columnsOf(geo.left, geo.contentWidth, input.schedule.numberOfFields > 1);
  const col = (key: ColumnKey): Col => cols.find(c => c.key === key) ?? { key, x: geo.left, w: 0 };
  const right = geo.left + geo.contentWidth;
  const edges = [...cols.map(c => c.x), right];
  const rounds = finalRounds(finals).map(round => ({
    key: round.key,
    rows: round.matches.map(match => ({
      src: sourceOf(env, match, []),
      parallel: round.matches.some(other => other !== match && other.time === match.time),
    })),
  }));
  const all = rounds.flatMap(round => round.rows);
  const nameW = (key: 'home' | 'away'): number => col(key).w - 2 * g.nameInset;
  const nameLines = (text: string, key: 'home' | 'away'): string[] => wrapName(text, nameW(key), printType.body, measure);
  const shownHome = (src: RowSource): string => src.home === '' ? (src.homeOrigin ?? '') : src.home;
  const shownAway = (src: RowSource): string => src.away === '' ? (src.awayOrigin ?? '') : src.away;
  const names = Math.max(1, ...all.map(({ src }) => Math.max(nameLines(shownHome(src), 'home').length, nameLines(shownAway(src), 'away').length)));
  const extras = Math.max(0, ...all.map(({ src }) => extrasOf(src, t).length));
  const rowH = gridRowHeight(names, extras);
  const mainH = mainHeight(names);
  const headH = g.headHeight;
  const koHeight = koBlock(env, 0).height;
  const koTotal = koHeight > 0 ? koHeight + g.koGap : 0;
  const heights = rounds.map(round => g.roundHeight + round.rows.length * rowH);
  const adv = NAME_LINE();
  const labels: Record<ColumnKey, string> = { nr: t.nr, time: t.timeHeader, field: t.field, home: t.home, result: t.result, away: t.away };

  const chunk = (from: number, to: number, withKo: boolean): Placeable => ({
    height: (withKo ? koTotal : 0) + headH + heights.slice(from, to).reduce((sum, h) => sum + h, 0),
    build: (top): Block[] => {
      const blocks: Block[] = [];
      let y = top;
      if (withKo && koHeight > 0) {
        blocks.push(koBlock(env, y).block);
        y += koTotal;
      }
      const start = y;
      const fills: Fill[] = [{ kind: 'tableHead', x: geo.left, y, w: geo.contentWidth, h: headH }];
      const grid: Segment[] = [];
      const accent: Segment[] = [];
      const runs: TextRun[] = cols.map(c => run(labels[c.key], c.x + c.w / 2, centeredBaseline(y + headH / 2, printMatchTable.headPt), printMatchTable.headPt, 'bold', 'center'));
      const horizontal = (at: number): void => { grid.push({ x1: geo.left, y1: at, x2: right, y2: at }); };
      const vertical = (x: number, fromY: number, toY: number): void => { grid.push({ x1: x, y1: fromY, x2: x, y2: toY }); };
      horizontal(y);
      edges.forEach(x => vertical(x, y, y + headH));
      y += headH;
      horizontal(y);
      rounds.slice(from, to).forEach((round, index) => {
        const roundTop = y;
        const first = from + index === 0;
        // Rundenname fett über den Spielen; ab der zweiten Runde eine Akzentlinie auf der Grenze zur Runde davor (statt der grauen Linie)
        runs.push(run(roundTitle(round.key, t), geo.left + g.roundInset, centeredBaseline(roundTop + g.roundTextTop + advanceMm(g.roundPt, 1) / 2, g.roundPt), g.roundPt, 'bold'));
        if (!first) { accent.push({ x1: geo.left, y1: roundTop, x2: right, y2: roundTop }); }
        y += g.roundHeight;
        horizontal(y);
        round.rows.forEach(({ src, parallel }, i) => {
          const rowTop = y;
          const mid = rowTop + g.rowTop + mainH / 2;
          fills.push({ kind: 'column', x: col('result').x, y: rowTop, w: col('result').w, h: rowH });
          runs.push(run(String(src.number), col('nr').x + col('nr').w / 2, centeredBaseline(mid, g.smallPt), g.smallPt, 'normal', 'center'));
          runs.push(run(src.time, col('time').x + g.timeInset, centeredBaseline(mid, printType.time), printType.time, 'bold'));
          if (input.schedule.numberOfFields > 1) {
            runs.push(run(src.field ?? '', col('field').x + col('field').w / 2, centeredBaseline(mid, g.smallPt), g.smallPt, 'normal', 'center'));
          }
          const side = (text: string, key: 'home' | 'away'): void => {
            const lines = nameLines(text, key);
            const x = key === 'home' ? col(key).x + col(key).w - g.nameInset : col(key).x + g.nameInset;
            lines.forEach((line, k) => runs.push(run(line, x, centeredBaseline(mid + (k - (lines.length - 1) / 2) * adv, printType.body), printType.body, 'normal', key === 'home' ? 'right' : 'left')));
          };
          side(shownHome(src), 'home');
          runs.push(...resultRuns(env, src, col('result'), mid));
          extrasOf(src, t).forEach((extra, k) => runs.push(...extraRuns(env, extra, col('result'), rowTop + g.rowTop + mainH + g.extraGap + (k + 1 / 2) * g.extraLine)));
          side(shownAway(src), 'away');
          y += rowH;
          // Die letzte Zeile vor einer weiteren Runde schließt die Akzentlinie der nächsten Runde ab
          const nextRound = from + index + 1 < to;
          if (!(i === round.rows.length - 1 && nextRound)) { horizontal(y); }
          if (verticalsVisible(g.verticals, parallel)) { edges.forEach(x => vertical(x, rowTop, y)); }
        });
      });
      const block: StandingsTableBlock = { kind: 'standingsTable', top: start, height: y - start, fills, grid, accent, runs };
      return [...blocks, block];
    },
  });

  return {
    height: chunk(0, rounds.length, true).height,
    chunks: capacity => {
      const parts: Placeable[] = [];
      let from = 0;
      let used = koTotal + headH;
      rounds.forEach((_, i) => {
        if (i > from && used + heights[i] > capacity) {
          parts.push(chunk(from, i, from === 0));
          from = i;
          used = headH;
        }
        used += heights[i];
      });
      parts.push(chunk(from, rounds.length, from === 0));
      return parts;
    },
  };
}

/** Ergebnis der Zelle: Ziffern 18 pt fett um den Doppelpunkt, „ausgefallen“ bzw. Striche ohne Ergebnis. */
function resultRuns(env: ModelEnv, src: RowSource, col: Col, mid: number): TextRun[] {
  const { t } = env.source;
  const cx = col.x + col.w / 2;
  const colon = (): TextRun => run(':', cx, centeredBaseline(mid, printType.resultColon), printType.resultColon, 'bold', 'center');
  const digits = (a: string, b: string): TextRun[] => [
    run(a, cx - printFinalsGrid.scoreGap, centeredBaseline(mid, printType.result), printType.result, 'bold', 'right'),
    colon(),
    run(b, cx + printFinalsGrid.scoreGap, centeredBaseline(mid, printType.result), printType.result, 'bold', 'left'),
  ];
  if (src.state.kind === 'final') { return digits(String(src.state.scoreA), String(src.state.scoreB)); }
  if (src.state.kind === 'skipped') {
    const pt = env.rowTexts.skippedPt(col.w - 2 * printFinalsGrid.nameInset);
    return [run(t.skipped, cx, centeredBaseline(mid, pt), pt, 'bold', 'center')];
  }
  return digits('–', '–');
}

/** Zusatzzeile: Wort (9 pt) und Zahl (12 pt fett) nebeneinander auf einer Grundlinie, zusammen mittig in der Zelle. */
function extraRuns(env: ModelEnv, extra: Extra, col: Col, center: number): TextRun[] {
  const g = printFinalsGrid;
  const cx = col.x + col.w / 2;
  const base = centeredBaseline(center, g.extraValuePt);
  if (extra.value === undefined) { return [run(extra.word, cx, base, g.extraWordPt, 'normal', 'center')]; }
  const wordW = env.measure.width(extra.word, g.extraWordPt, 'normal');
  const gap = env.measure.width(' ', g.extraWordPt, 'normal');
  const valueW = env.measure.width(extra.value, g.extraValuePt, 'bold');
  const x = cx - (wordW + gap + valueW) / 2;
  return [run(extra.word, x, base, g.extraWordPt, 'normal'), run(extra.value, x + wordW + gap, base, g.extraValuePt, 'bold')];
}
