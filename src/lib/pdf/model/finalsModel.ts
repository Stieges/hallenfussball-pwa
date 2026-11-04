/**
 * Finalrunde (@DR-006, @DR-015, @DR-019, @DR-037): K.-o.-Zeilen („K.-o.: bei Gleichstand …“) über der Tabelle, darunter Spaltenkopf und
 * je Runde eine Zeile mit dem Rundennamen (Akzentlinie darüber, außer vor der ersten Runde) und ihre Spiele. Rein, fertig vermessen.
 * Die Zebra-Zeilen zählen über alle Runden durch. Passt die Finalrunde nicht auf eine Seite, bricht sie zwischen zwei Runden um und
 * der Spaltenkopf wiederholt sich.
 */
import { printMetrics, printType } from '../../../design-tokens/print';
import { printFinals, printMatchTable, printRule, printZebra } from '../../../design-tokens/print-sheet';
import { koLines } from '../rules';
import { printState, resultMarkText } from '../matchResult';
import { sideInfo } from '../matchSides';
import type { StatefulMatch } from '../tournamentState';
import { finalRounds, roundTitle, smallKindsFor } from './finalRounds';
import { refereeWidthOf, type ModelEnv } from './env';
import { buildFinalsRow, finalsRowMetrics } from './finalsRows';
import { buildHead, layoutColumns, smallBeside, type RowSource } from './matchRows';
import { wrapName } from './nameLines';
import type { Placeable, Splittable } from './sectionFlow';
import { ascent, centeredBaseline, run } from './text';
import type { Block, ColumnKey, FinalsBlock, FinalsRoundModel, TextBlock } from './types';

function sourceOf(env: ModelEnv, match: StatefulMatch, small: RowSource['small']): RowSource {
  const { t, input } = env.source;
  const state = printState(match, { edition: input.edition, results: env.includeScores });
  const markText = resultMarkText(state, t);
  const home = sideInfo(match, 'A', env.sideCtx);
  const away = sideInfo(match, 'B', env.sideCtx);
  return {
    matchId: match.id,
    number: match.matchNumber,
    time: match.time,
    hour: 0,
    ...(input.schedule.numberOfFields > 1 ? { field: String(match.field) } : {}),
    home: 'team' in home ? home.team : '',
    away: 'team' in away ? away.team : '',
    ...('origin' in home ? { homeOrigin: home.origin } : {}),
    ...('origin' in away ? { awayOrigin: away.origin } : {}),
    state,
    ...(markText === undefined ? {} : { markText }),
    referee: env.refLabel(match),
    small,
  };
}

/** K.-o.-Zeilen über der Finalrunde, je Zeile umbrochen (@DR-015). */
function koBlock(env: ModelEnv, top: number): { block: TextBlock; height: number } {
  const { geo, t } = env.source;
  const lines = koLines(env.rules, t).flatMap(line => wrapName(line, geo.contentWidth, printType.note, env.measure));
  const runs = lines.map((text, i) => run(text, geo.left, top + ascent(printType.note) + i * printMetrics.koLineAdvance, printType.note, 'normal'));
  const height = lines.length * printMetrics.koLineAdvance;
  return { block: { kind: 'text', top, height, runs }, height };
}

/** Finalrunde als Teile; `undefined`, wenn es keine Finalspiele gibt. */
export function finalsParts(env: ModelEnv): Splittable | undefined {
  const { source, measure } = env;
  const { input, t, geo } = source;
  const finals = input.schedule.phases.filter(p => p.name !== 'groupStage').flatMap(p => p.matches) as StatefulMatch[];
  if (finals.length === 0) { return undefined; }
  const rounds = finalRounds(finals).map(round => ({
    key: round.key,
    sources: round.matches.map(match => sourceOf(env, match, smallKindsFor(round.key, env.rules.finalsConfig))),
  }));
  const all = rounds.flatMap(round => round.sources);
  const refereeWidth = refereeWidthOf(all.map(src => src.referee), t.referee, measure, printFinals.refInset);
  const flags = {
    finals: true,
    field: input.schedule.numberOfFields > 1,
    group: false,
    referee: all.some(src => src.referee !== ''),
    smallPairs: 1,
    ...(refereeWidth === undefined ? {} : { refereeWidth }),
  };
  // Reicht der Platz neben dem Ergebnis nicht für eine Namenslinie von 50 mm (Spalte „SR“ oder „Feld“), stehen die kleinen Linien darunter (@DR-037)
  const cols = layoutColumns(geo.left, geo.contentWidth, { ...flags, smallBelow: !smallBeside(geo.contentWidth, flags) });
  const labels: Partial<Record<ColumnKey, string>> = { nr: t.nr, time: t.timeHeader, field: t.field, home: t.home, result: t.result, away: t.away, referee: t.referee };
  const heights = rounds.map(round => printFinals.roundHeight + round.sources.reduce((sum, src) => sum + finalsRowMetrics(src, cols, measure).height, 0));
  const koHeight = koBlock(env, 0).height;
  const koTotal = koHeight > 0 ? koHeight + printFinals.koGap : 0;
  const headH = printMatchTable.headHeight;
  const upper = (text: string): string => text.toLocaleUpperCase(input.locale);

  const chunk = (from: number, to: number, withKo: boolean): Placeable => ({
    height: (withKo ? koTotal : 0) + headH + heights.slice(from, to).reduce((sum, h) => sum + h, 0),
    build: (top): Block[] => {
      const blocks: Block[] = [];
      let y = top;
      if (withKo && koHeight > 0) {
        blocks.push(koBlock(env, y).block);
        y += koTotal;
      }
      const head = buildHead(cols, y, labels);
      let cursor = y + headH;
      const models: FinalsRoundModel[] = rounds.slice(from, to).map((round, index) => {
        const roundTop = cursor;
        const base = centeredBaseline(roundTop + printFinals.roundHeight / 2 + printRule.round, printMatchTable.headPt);
        const title = [run(upper(roundTitle(round.key, t)), geo.left + printMatchTable.nameInner, base, printMatchTable.headPt, 'bold')];
        cursor += printFinals.roundHeight;
        const before = rounds.slice(0, from + index).reduce((sum, r) => sum + r.sources.length, 0);
        const rows = round.sources.map((src, i) => {
          const row = buildFinalsRow(src, cols, cursor, (before + i) % 2 === (printZebra.firstRowTinted ? 0 : 1), env.rowTexts, measure, { left: geo.left, width: geo.contentWidth });
          cursor += row.box.h;
          return row;
        });
        const model: FinalsRoundModel = { title, rows };
        if (from + index > 0) { model.rule = { kind: 'round', x1: geo.left, x2: geo.left + geo.contentWidth, y: roundTop + printRule.round / 2 }; }
        return model;
      });
      const block: FinalsBlock = { kind: 'finals', top: y, height: cursor - y, head, rounds: models };
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

