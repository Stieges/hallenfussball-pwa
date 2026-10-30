/**
 * Testdaten zu @ZM-180 „Ein beendetes Spiel bleibt auf jeder Anzeige beendet, auch wenn ein älterer Stand nachkommt“:
 * Spiel 7 (Feld 1) FC Nord – SV Süd aus `monitorFixture`, Engine-Kopien dieses Browsers mit Verlauf bis 1:1 (läuft) bzw.
 * bis 2:1 (beendet). Reine Testdaten.
 */
import type { MatchCopy } from '../../../core/match/client';
import type { EngineEvent, MatchRules } from '../../../core/match/types';
import { B07_RULES, KICKOFF_AT } from '../../../core/match/client/__tests__/commandHarness';

/** Ein Abschnitt zu 10 Minuten, damit „Abpfiff“ ohne Halbzeit gilt. */
const RULES: MatchRules = { ...B07_RULES, sections: 1, breakSeconds: 0 };

export const NORD = 'team-nord';
export const SUED = 'team-sued';

function ev(n: number, type: EngineEvent['type'], extra: Partial<EngineEvent> = {}): EngineEvent {
  return {
    id: `zm180-${n}`, type, actor: 'helper', at: KICKOFF_AT + n * 1000, section: 1, clockMs: n * 1000,
    teamId: null, targetId: null, payload: {}, ...extra,
  };
}

/** Anpfiff, Tor Nord, Tor Süd → 1:1, läuft. */
export const BIS_1_1: EngineEvent[] = [
  ev(1, 'MATCH_START', { payload: { rules: RULES } }),
  ev(2, 'GOAL', { teamId: NORD }),
  ev(3, 'GOAL', { teamId: SUED }),
];

/** Danach Tor Nord zum 2:1 und Abpfiff. */
export const ZUM_2_1_BEENDET: EngineEvent[] = [ev(4, 'GOAL', { teamId: NORD }), ev(5, 'MATCH_END', { clockMs: 600_000 })];

/** Engine-Kopie von Spiel 7 eines Kontos. `pending` = wartende Einträge (noch nicht vom Server bestätigt). */
export function kopie(
  accountId: string,
  confirmed: EngineEvent[],
  options: { pending?: EngineEvent[]; updatedAt?: number } = {},
): MatchCopy {
  return {
    formatVersion: 2, accountId, matchId: 'match-7', ctx: { matchId: 'match-7', teamAId: NORD, teamBId: SUED },
    confirmed: confirmed.map((event, index) => ({ ...event, seq: index + 1 })), watermarkSeq: confirmed.length, acked: [], pending: options.pending ?? [], rejected: [], review: [],
    updatedAt: options.updatedAt ?? 1,
  };
}
