/**
 * Gemeinsame Ausgangslage für die Verlängerungs-Tests (C-VERLAENGERUNG-ENDET-SOFORT) aus dem Gherkin von
 * @SL-145, @SL-081, @SL-082 und @TM-052: Halbfinale 1 „FC Nord gegen DJK Berg“ steht nach der regulären
 * Spielzeit 1:1, die Verlängerung dauert 3 Minuten (@SL-081). Echte Engine (`reduceMatch`) und echter
 * Adapter (`toLiveMatchView`) – nichts davon ist nachgebaut.
 */
import { reduceMatch, type EngineEvent, type MatchContext, type MatchRules, type MatchState, type TiebreakMode } from '../../';
import { toLiveMatchView, type LiveMatchMeta } from '../viewAdapters';
import type { LiveMatch } from '../../../models/LiveMatch';

export const NORD = 'fc-nord';
export const BERG = 'djk-berg';
export const HF_CTX: MatchContext = { matchId: 'hf1', teamAId: NORD, teamBId: BERG };

export const HF_META: LiveMatchMeta = {
  id: 'hf1',
  number: 21,
  phaseLabel: 'Halbfinale 1',
  tournamentPhase: 'semifinal',
  fieldId: 'f1',
  scheduledKickoff: '2026-11-07T15:00:00.000Z',
  homeTeam: { id: NORD, name: 'FC Nord' },
  awayTeam: { id: BERG, name: 'DJK Berg' },
  version: 1,
};

/** Reguläre Spielzeit 2 × 5 Minuten, Verlängerung 3 Minuten (@SL-081). */
export const SECTION_S = 300;
export const REGULAR_S = 2 * SECTION_S;
export const OVERTIME_S = 180;

export function hfRules(tiebreak: TiebreakMode): MatchRules {
  return {
    sections: 2,
    sectionSeconds: SECTION_S,
    breakSeconds: 60,
    knockout: true,
    tiebreak,
    overtimeSeconds: OVERTIME_S,
    shootersPerTeam: 5,
    suddenDeathAfter: 6,
    penaltySeconds: 120,
  };
}

export const T0 = 1_790_000_000_000;
/** Wanduhr des Anpfiffs der Verlängerung. */
export const OT_KICKOFF_AT = T0 + 720_000;

let seq = 0;
export function hfEvent(
  type: EngineEvent['type'],
  atMs: number,
  section: number,
  clockMs: number | null,
  extra: Partial<EngineEvent> = {},
): EngineEvent {
  seq += 1;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    type,
    actor: 'helper',
    at: atMs,
    section,
    clockMs,
    payload: {},
    ...extra,
  };
}

/**
 * Halbfinale 1 bis zum Ablauf der regulären Spielzeit bei 1:1 (Abpfiff = automatisches Ende der Regelzeit).
 * `overrunMs`: Abpfiff von Hand erst so viele ms nach Ablauf (Auto-Ende aus).
 */
export function regularTimeDrawLog(tiebreak: TiebreakMode, overrunMs = 0): EngineEvent[] {
  return [
    hfEvent('MATCH_START', T0, 1, null, { payload: { rules: hfRules(tiebreak) } }),
    hfEvent('GOAL', T0 + 100_000, 1, 100_000, { teamId: NORD }),
    hfEvent('SECTION_END', T0 + 300_000, 1, 300_000),
    hfEvent('SECTION_START', T0 + 360_000, 2, 300_000),
    hfEvent('GOAL', T0 + 500_000, 2, 440_000, { teamId: BERG }),
    hfEvent('MATCH_END', T0 + 660_000 + overrunMs, 2, 600_000 + overrunMs),
  ];
}

/** … und die Verlängerung ist angepfiffen. */
export function overtimeRunningLog(tiebreak: TiebreakMode, overrunMs = 0): EngineEvent[] {
  return [...regularTimeDrawLog(tiebreak, overrunMs), hfEvent('SECTION_START', OT_KICKOFF_AT + overrunMs, 3, null)];
}

export function stateOf(log: EngineEvent[]): MatchState {
  return reduceMatch(log, HF_CTX).state;
}

export function viewAt(log: EngineEvent[], serverNow: number): LiveMatch {
  return toLiveMatchView(stateOf(log), HF_META, { serverNow, offsetMs: 0 }, log);
}

/** Gespielte Sekunden so, wie `useMatchTimerExtended` sie aus der Ansicht rechnet (Basis + Laufzeit). */
export function hookElapsed(view: LiveMatch, deviceNow: number): number {
  if (view.status !== 'RUNNING' || !view.timerStartTime) {
    return view.timerElapsedSeconds ?? 0;
  }
  return (view.timerElapsedSeconds ?? 0) + Math.floor((deviceNow - Date.parse(view.timerStartTime)) / 1000);
}
