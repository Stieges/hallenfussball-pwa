import { describe, it, expect } from 'vitest';
import { toLiveMatchView } from '../viewAdapters';
import { initialState, reduceMatch, type MatchState } from '../../';
import type { MatchStatus } from '../../../models/LiveMatch';
import { RULES, T, ctx, goal, meta, start } from './fixtures';

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

  it('dauert ohne Regeln 0 Sekunden', () => {
    const state: MatchState = { ...initialState(ctx), status: 'scheduled' };
    const view = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 });
    expect(view.durationSeconds).toBe(0);
  });

  it('uebernimmt die Meta-Angaben unveraendert in die LiveMatch-Form', () => {
    const view = toLiveMatchView(initialState(ctx), meta, { serverNow: T, offsetMs: 0 });
    expect(view).toMatchObject({
      id: 'm',
      number: 7,
      phaseLabel: 'Gruppe A',
      fieldId: 'f1',
      scheduledKickoff: '2026-09-26T12:00:00.000Z',
      refereeName: 'Schiri',
      homeTeam: { id: 'teamA', name: 'Heim' },
      awayTeam: { id: 'teamB', name: 'Gast' },
      version: 3,
      tournamentPhase: 'groupStage',
    });
  });
});
