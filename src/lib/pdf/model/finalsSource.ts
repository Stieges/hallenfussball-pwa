/**
 * Gemeinsame Bausteine der Finalrunde im Spielplan (`finalsModel.ts`) und im Endstand (`finalsGridModel.ts`): eine Spielzeile als
 * `RowSource` und die K.-o.-Zeilen über der Tabelle (@DR-015). Rein.
 */
import { printMetrics, printType } from '../../../design-tokens/print';
import { koLines } from '../rules';
import { printState, resultMarkText } from '../matchResult';
import { sideInfo } from '../matchSides';
import type { StatefulMatch } from '../tournamentState';
import type { ModelEnv } from './env';
import type { RowSource } from './matchRows';
import { wrapName } from './nameLines';
import { ascent, run } from './text';
import type { TextBlock } from './types';

export function sourceOf(env: ModelEnv, match: StatefulMatch, small: RowSource['small']): RowSource {
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
export function koBlock(env: ModelEnv, top: number): { block: TextBlock; height: number } {
  const { geo, t } = env.source;
  const lines = koLines(env.rules, t).flatMap(line => wrapName(line, geo.contentWidth, printType.note, env.measure));
  const runs = lines.map((text, i) => run(text, geo.left, top + ascent(printType.note) + i * printMetrics.koLineAdvance, printType.note, 'normal'));
  const height = lines.length * printMetrics.koLineAdvance;
  return { block: { kind: 'text', top, height, runs }, height };
}
