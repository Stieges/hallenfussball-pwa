import { describe, it, expect } from 'vitest';
import {
  toLiveMatchView,
  toRuntimeEvents,
  stableEvents,
  activePenaltiesView,
  foulCounts,
  type LiveMatchMeta,
} from '../viewAdapters';
import { initialState, reduceMatch, type EngineEvent, type MatchContext, type MatchRules, type MatchState } from '../../';
import type { MatchStatus } from '../../../models/LiveMatch';

const ctx: MatchContext = { matchId: 'm', teamAId: 'teamA', teamBId: 'teamB' };

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

const meta: LiveMatchMeta = {
  id: 'm',
  number: 7,
  phaseLabel: 'Gruppe A',
  tournamentPhase: 'groupStage',
  fieldId: 'f1',
  scheduledKickoff: '2026-09-26T12:00:00.000Z',
  refereeName: 'Schiri',
  homeTeam: { id: 'teamA', name: 'Heim' },
  awayTeam: { id: 'teamB', name: 'Gast' },
  version: 3,
};

const T = 1_790_000_000_000;

function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

const start = () => ev({ id: 's', type: 'MATCH_START', at: 1000, payload: { rules: RULES } });
const goal = (id: string, teamId: string, at: number, clockMs: number, payload: Record<string, unknown> = {}) =>
  ev({ id, type: 'GOAL', at, teamId, clockMs, payload });

function runningState(clock: MatchState['clock']): MatchState {
  return { ...initialState(ctx), status: 'running', rules: RULES, clock };
}

describe('toLiveMatchView: Status-Abbildung', () => {
  const cases: Array<[MatchState['status'], MatchStatus]> = [
    ['scheduled', 'NOT_STARTED'],
    ['running', 'RUNNING'],
    ['paused', 'PAUSED'],
    ['section_break', 'PAUSED'],
    ['decision_pending', 'PAUSED'],
    ['shootout', 'PAUSED'],
    ['finished', 'FINISHED'],
    ['skipped', 'FINISHED'],
  ];

  for (const [engineStatus, uiStatus] of cases) {
    it(`mappt ${engineStatus} auf ${uiStatus}`, () => {
      const state: MatchState = { ...initialState(ctx), status: engineStatus };
      const view = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 });
      expect(view.status).toBe(uiStatus);
    });
  }
});

describe('toLiveMatchView: Uhr mit Serverzeit und Offset (I1)', () => {
  it('rechnet elapsedSeconds ueber serverNow und timerStartTime in Geraetezeit (+7 min Offset)', () => {
    const state = runningState({ running: true, elapsedMs: 60_000, anchorAt: T });
    const view = toLiveMatchView(state, meta, { serverNow: T + 30_000, offsetMs: 420_000 });

    expect(view.elapsedSeconds).toBe(90);
    expect(view.timerStartTime).toBe(new Date(T - 420_000).toISOString());
    expect(view.timerElapsedSeconds).toBe(60);
    expect(view.timerPausedAt).toBeUndefined();

    // Gleichung aus useMatchTimerExtended (Basis + Geraetelaufzeit) muss den Anzeigewert liefern.
    const deviceNow = T + 30_000 - 420_000;
    const hookTotal = (view.timerElapsedSeconds ?? 0) + Math.floor((deviceNow - Date.parse(view.timerStartTime ?? '')) / 1000);
    expect(hookTotal).toBe(view.elapsedSeconds);
  });

  it('rechnet timerStartTime auch bei -7 min Offset in Geraetezeit um', () => {
    const state = runningState({ running: true, elapsedMs: 60_000, anchorAt: T });
    const view = toLiveMatchView(state, meta, { serverNow: T + 30_000, offsetMs: -420_000 });

    expect(view.elapsedSeconds).toBe(90);
    expect(view.timerStartTime).toBe(new Date(T + 420_000).toISOString());
    const deviceNow = T + 30_000 + 420_000;
    const hookTotal = (view.timerElapsedSeconds ?? 0) + Math.floor((deviceNow - Date.parse(view.timerStartTime ?? '')) / 1000);
    expect(hookTotal).toBe(view.elapsedSeconds);
  });

  it('setzt timerPausedAt in Geraetezeit, wenn die Uhr steht, und belässtet elapsedSeconds auf dem Ankerwert', () => {
    const state = runningState({ running: false, elapsedMs: 45_000, anchorAt: null });
    const view = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 60_000 });

    expect(view.elapsedSeconds).toBe(45);
    expect(view.timerPausedAt).toBe(new Date(T - 60_000).toISOString());
    expect(view.timerStartTime).toBeUndefined();
  });

  it('dauer kommt aus den Spielregeln, scores aus dem effektiven Stand, events aus dem Log', () => {
    const log = [start(), goal('g1', 'teamA', 2000, 30_000)];
    const state = reduceMatch(log, ctx).state;
    const view = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 }, log);

    expect(view.durationSeconds).toBe(1200);
    expect(view.homeScore).toBe(1);
    expect(view.awayScore).toBe(0);
    expect(view.events.map((e) => e.id)).toEqual(['g1']);
    expect(view.tournamentPhase).toBe('groupStage');
    expect(view.id).toBe('m');
    expect(view.version).toBe(3);
  });
});

describe('toRuntimeEvents (I2)', () => {
  it('filtert nicht angenommene und zurueckgenommene Ereignisse, AMEND wirkt', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 30_000, { playerNumber: 7, assists: [3] }),
      ev({ id: 'a1', type: 'AMEND', at: 2500, targetId: 'g1', payload: { playerNumber: 9, clear: ['assists'] } }),
      goal('g2', 'teamB', 3000, 40_000),
      ev({ id: 'r1', type: 'RETRACT', at: 3500, targetId: 'g2' }),
    ];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);

    expect(events.map((e) => e.id)).toEqual(['g1']);
    expect(events[0]?.payload.playerNumber).toBe(9);
    expect(events[0]?.payload.assists).toBeUndefined();
    expect(events[0]?.matchId).toBe('m');
  });

  it('bildet OWN_GOAL als Tor des Gegners ab und YELLOW_RED_CARD als rote Karte', () => {
    const log = [
      start(),
      ev({ id: 'og1', type: 'OWN_GOAL', at: 2000, teamId: 'teamA', clockMs: 25_000, payload: {} }),
      ev({ id: 'yr1', type: 'YELLOW_RED_CARD', at: 3000, teamId: 'teamB', clockMs: 35_000, payload: { playerNumber: 4 } }),
    ];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);

    expect(events[0]?.type).toBe('GOAL');
    expect(events[0]?.payload.teamId).toBe('teamB');
    expect(events[0]?.timestampSeconds).toBe(25);
    expect(events[0]?.scoreAfter).toEqual({ home: 0, away: 1 });
    expect(events[1]?.type).toBe('RED_CARD');
    expect(events[1]?.payload.cardType).toBe('RED');
    expect(events[1]?.payload.playerNumber).toBe(4);
  });

  it('fuehrt scoreAfter laufend aus den Toren und setzt timestampSeconds aus der Spieluhr', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 10_000),
      goal('g2', 'teamB', 3000, 20_000),
      goal('g3', 'teamA', 4000, 55_000),
    ];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);

    expect(events.map((e) => e.scoreAfter)).toEqual([
      { home: 1, away: 0 },
      { home: 1, away: 1 },
      { home: 2, away: 1 },
    ]);
    expect(events.map((e) => e.timestampSeconds)).toEqual([10, 20, 55]);
    expect(events.every((e) => e.matchId === 'm')).toBe(true);
  });

  it('zeigt Zeitstrafen und Wechsel mit UI-Payload', () => {
    const log = [
      start(),
      ev({ id: 'tp1', type: 'TIME_PENALTY', at: 2000, teamId: 'teamA', clockMs: 30_000, payload: { durationSeconds: 120, playerNumber: 8 } }),
      ev({ id: 'sub1', type: 'SUBSTITUTION', at: 3000, teamId: 'teamB', clockMs: 40_000, payload: { playersIn: [9], playersOut: [2] } }),
    ];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);

    expect(events[0]?.type).toBe('TIME_PENALTY');
    expect(events[0]?.payload.penaltyDuration).toBe(120);
    expect(events[0]?.payload.playerNumber).toBe(8);
    expect(events[1]?.type).toBe('SUBSTITUTION');
    expect(events[1]?.payload.playersIn).toEqual([9]);
    expect(events[1]?.payload.playersOut).toEqual([2]);
  });

  it('laesst lokal abgelehnte Log-Einträge weg (kein state.accepted-Eintrag)', () => {
    const log = [start(), goal('bad', 'teamA', 2000, 10_000)];
    const state = reduceMatch([start()], ctx).state;
    expect(toRuntimeEvents(state, log, ctx).map((e) => e.id)).toEqual([]);
  });
});

describe('stableEvents (M-4)', () => {
  it('behält die Referenz bei inhaltlich gleichen Eintraegen, auch bei neuem Array', () => {
    const prev = [{ id: 'e1', matchId: 'm', timestampSeconds: 1, type: 'GOAL' as const, payload: { playerNumber: 7 }, scoreAfter: { home: 1, away: 0 } }];
    const next = [{ id: 'e1', matchId: 'm', timestampSeconds: 1, type: 'GOAL' as const, payload: { playerNumber: 7 }, scoreAfter: { home: 1, away: 0 } }];
    expect(stableEvents(prev, next)).toBe(prev);
  });

  it('liefert next, wenn sich Inhalte bei gleicher ID aendern (AMEND)', () => {
    const prev = [{ id: 'e1', matchId: 'm', timestampSeconds: 1, type: 'GOAL' as const, payload: { playerNumber: 7 }, scoreAfter: { home: 1, away: 0 } }];
    const next = [{ id: 'e1', matchId: 'm', timestampSeconds: 1, type: 'GOAL' as const, payload: { playerNumber: 9 }, scoreAfter: { home: 1, away: 0 } }];
    expect(stableEvents(prev, next)).toBe(next);
  });
});

describe('activePenaltiesView und foulCounts (I4)', () => {
  it('rechnet die Restzeit mit serverNow und filtert abgelaufene sowie zurueckgenommene Strafen', () => {
    const state: MatchState = {
      ...initialState(ctx),
      clock: { running: true, elapsedMs: 30_000, anchorAt: T },
      penalties: [
        { id: 'p1', teamId: 'teamA', startMs: 0, durationMs: 120_000 },
        { id: 'p2', teamId: 'teamB', startMs: 0, durationMs: 10_000 },
        { id: 'p3', teamId: 'teamA', startMs: 0, durationMs: 90_000 },
      ],
      retracted: ['p3'],
    };
    const result = activePenaltiesView(state, T + 15_000);
    expect(result).toEqual([{ id: 'p1', teamId: 'teamA', remainingMs: 75_000 }]);
  });

  it('zaehlt Fouls fuer das ganze Spiel', () => {
    const state: MatchState = {
      ...initialState(ctx),
      fouls: [
        { id: 'f1', teamId: 'teamA', clockMs: 1000, section: 1 },
        { id: 'f2', teamId: 'teamA', clockMs: 2000, section: 2 },
        { id: 'f3', teamId: 'teamB', clockMs: 3000, section: 2 },
      ],
    };
    expect(foulCounts(state)).toEqual({ teamA: 2, teamB: 1 });
  });
});
