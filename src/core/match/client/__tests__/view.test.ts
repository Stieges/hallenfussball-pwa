import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  reduceMatch,
  type EngineEvent,
  type MatchContext,
  type MatchRules,
  type MatchState,
  ERROR_CODES,
} from '../../';
import { computeView } from '../view';

const hoisted = vi.hoisted(() => {
  const reduceMatchLengths: number[] = [];
  const continueLogIds: string[][] = [];
  return { reduceMatchLengths, continueLogIds };
});

vi.mock('../../', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../')>();
  return {
    ...actual,
    reduceMatch: (events: readonly EngineEvent[], matchCtx: MatchContext) => {
      hoisted.reduceMatchLengths.push(events.length);
      return actual.reduceMatch(events, matchCtx);
    },
    continueLog: (state: MatchState, events: readonly EngineEvent[], matchCtx: MatchContext) => {
      hoisted.continueLogIds.push(events.map((entry) => entry.id));
      return actual.continueLog(state, events, matchCtx);
    },
  };
});

const ctx: MatchContext = { matchId: 'match-view', teamAId: 'teamA', teamBId: 'teamB' };

const RULES: MatchRules = {
  sections: 2,
  sectionSeconds: 600,
  breakSeconds: 60,
  knockout: false,
  tiebreak: null,
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

function copyOf(matchId: string, confirmed: EngineEvent[], acked: EngineEvent[] = [], pending: EngineEvent[] = []) {
  return { matchId, confirmed, acked, pending };
}

const start = () => ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } });
const goal = (id: string, teamId: string, at: number) => ev({ id, type: 'GOAL', at, teamId, clockMs: at - 1000 });

describe('computeView', () => {
  beforeEach(() => {
    hoisted.reduceMatchLengths.length = 0;
    hoisted.continueLogIds.length = 0;
  });

  it('rechnet fremde Ereignisse dazwischen ein (anderes Gerät hat Tore eingetragen)', () => {
    const confirmed = [start(), goal('f1', 'teamB', 2000), goal('f2', 'teamB', 3000)];
    const result = computeView(copyOf('view-1', confirmed, [goal('a1', 'teamA', 2500)], [goal('p1', 'teamA', 3500)]), ctx);

    expect(result.localRejected).toEqual([]);
    expect(result.needsFullReload).toBe(false);
    expect(result.state.scores['teamA']?.regular).toBe(2);
    expect(result.state.scores['teamB']?.regular).toBe(2);
  });

  it('meldet lokal abgelehnte pending-Einträge mit Code (Tor nach fremdem Abpfiff)', () => {
    const confirmed = [start(), ev({ id: 'end', type: 'MATCH_END', at: 5000 })];
    const lateGoal = goal('p-late', 'teamA', 6000);
    const result = computeView(copyOf('view-2', confirmed, [], [lateGoal]), ctx);

    expect(result.localRejected.map((entry) => entry.event.id)).toEqual(['p-late']);
    expect(result.localRejected[0]?.code).toBe(ERROR_CODES.MATCH_FINISHED);
    expect(result.needsFullReload).toBe(false);
    expect(result.state.scores['teamA']?.regular).toBe(0);
  });

  it('meldet Folgeablehnungen (fremder MATCH_START vorher -> eigener MATCH_START + Tore abgelehnt)', () => {
    const confirmed = [start()];
    const ownStart = ev({ id: 'o1', type: 'MATCH_START', at: 1100, payload: { rules: RULES } });
    const result = computeView(
      copyOf('view-3', confirmed, [], [ownStart, goal('o2', 'teamA', 1200), goal('o3', 'teamA', 1300)]),
      ctx,
    );

    expect(result.localRejected.map((entry) => entry.event.id)).toEqual(['o1', 'o2', 'o3']);
    expect(result.localRejected.map((entry) => entry.code)).toEqual([
      ERROR_CODES.INVALID_TRANSITION,
      ERROR_CODES.DEPENDS_ON_REJECTED,
      ERROR_CODES.DEPENDS_ON_REJECTED,
    ]);
    expect(result.needsFullReload).toBe(false);
  });

  it('setzt needsFullReload, wenn ein acked-Eintrag lokal abgelehnt wird (V3)', () => {
    const confirmed = [start(), ev({ id: 'end', type: 'MATCH_END', at: 5000 })];
    const ackedGoal = goal('a-late', 'teamA', 6000);
    const result = computeView(copyOf('view-4', confirmed, [ackedGoal], []), ctx);

    expect(result.needsFullReload).toBe(true);
    expect(result.localRejected).toEqual([]);
  });

  it('zaehlt bestaetigte Duplikate aus pending nicht doppelt', () => {
    const shared = goal('d1', 'teamA', 2000);
    const result = computeView(copyOf('view-5', [start(), shared], [], [shared]), ctx);

    expect(result.localRejected).toEqual([]);
    expect(result.needsFullReload).toBe(false);
    expect(result.state.scores['teamA']?.regular).toBe(1);
  });

  it('rechnet inkrementell weiter: reduceMatch nur beim kalten Aufruf, Delta über continueLog', () => {
    const base = [start()];
    for (let i = 0; i < 30; i++) {
      base.push(goal(`inc-g${i}`, i % 2 === 0 ? 'teamA' : 'teamB', 2000 + i));
    }
    computeView(copyOf('view-warm', base, [], []), ctx);
    expect(hoisted.reduceMatchLengths).toEqual([31]);
    expect(hoisted.continueLogIds).toEqual([]);

    const extended = [...base, goal('inc-extra', 'teamB', 9000)];
    const warm = computeView(copyOf('view-warm', extended, [], [goal('inc-p', 'teamA', 9100)]), ctx);
    expect(hoisted.reduceMatchLengths).toEqual([31]);
    expect(hoisted.continueLogIds).toEqual([['inc-extra']]);

    const cold = computeView(copyOf('view-cold-2', extended, [], [goal('inc-p', 'teamA', 9100)]), ctx);
    expect(hoisted.reduceMatchLengths).toEqual([31, 32]);
    expect(warm.state).toEqual(cold.state);
    expect(warm.state.scores['teamB']?.regular).toBe(16);
  });

  it('rechnet 300 Ereignisse in unter 200 ms (Voll-Laufzeit und inkrementelles Update)', () => {
    const confirmed = [start()];
    for (let i = 0; i < 299; i++) {
      confirmed.push(goal(`perf-g${i}`, i % 2 === 0 ? 'teamA' : 'teamB', 2000 + i));
    }
    const pending = [goal('perf-p1', 'teamA', 4000), goal('perf-p2', 'teamB', 4100)];

    const coldStart = performance.now();
    const cold = computeView(copyOf('view-perf', confirmed, [], pending), ctx);
    const coldDuration = performance.now() - coldStart;

    const incrementalStart = performance.now();
    const warm = computeView(copyOf('view-perf', [...confirmed, goal('perf-next', 'teamA', 5000)], [], pending), ctx);
    const incrementalDuration = performance.now() - incrementalStart;

    expect(cold.state.scores['teamA']?.regular).toBe(151);
    expect(warm.state.scores['teamA']?.regular).toBe(152);
    expect(coldDuration).toBeLessThan(200);
    expect(incrementalDuration).toBeLessThan(200);
  });

  it('verwendet reduceMatch als Basis (fremder bestätigter Log ist die Wahrheit)', () => {
    const confirmed = [start(), goal('f1', 'teamB', 2000)];
    const expected = reduceMatch(confirmed, ctx).state;
    const result = computeView(copyOf('view-6', confirmed, [], []), ctx);
    expect(result.state).toEqual(expected);
  });
});
