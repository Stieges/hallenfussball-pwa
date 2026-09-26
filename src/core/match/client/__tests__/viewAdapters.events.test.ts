import { describe, it, expect } from 'vitest';
import { toRuntimeEvents, stableEvents, activePenaltiesView, foulCounts, toLiveMatchView } from '../viewAdapters';
import { initialState, reduceMatch, type MatchState } from '../../';
import { T, ctx, ev, goal, meta, start } from './fixtures';

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

  it('zeigt gelbe Karten und Fouls mit Mannschaft und Spieluhr', () => {
    const log = [
      start(),
      ev({ id: 'yc1', type: 'YELLOW_CARD', at: 2000, teamId: 'teamA', clockMs: 15_000, payload: { playerNumber: 5 } }),
      ev({ id: 'fo1', type: 'FOUL', at: 3000, teamId: 'teamB', clockMs: 25_000, payload: { playerNumber: 11 } }),
    ];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);

    expect(events.map((e) => e.type)).toEqual(['YELLOW_CARD', 'FOUL']);
    expect(events[0]?.payload.cardType).toBe('YELLOW');
    expect(events[0]?.payload.teamId).toBe('teamA');
    expect(events[1]?.payload.teamId).toBe('teamB');
    expect(events.map((e) => e.timestampSeconds)).toEqual([15, 25]);
  });

  it('laesst lokal abgelehnte Log-Einträge weg (kein state.accepted-Eintrag)', () => {
    const log = [start(), goal('bad', 'teamA', 2000, 10_000)];
    const state = reduceMatch([start()], ctx).state;
    expect(toRuntimeEvents(state, log, ctx).map((e) => e.id)).toEqual([]);
  });

  it('zeigt doppelte Log-IDs nur einmal und nimmt den Inhalt aus state.accepted (N7)', () => {
    const accepted = goal('g1', 'teamA', 2000, 10_000, { playerNumber: 7 });
    const variant = goal('g1', 'teamA', 2000, 10_000, { playerNumber: 99 });
    const log = [start(), accepted, variant];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);

    expect(events).toHaveLength(1);
    expect(events[0]?.payload.playerNumber).toBe(7);
  });

  it('scoreAfter der letzten Zeile entspricht dem Kopfstand auch nach einer Korrektur (N8)', () => {
    const log = [
      start(),
      goal('g1', 'teamA', 2000, 10_000),
      ev({ id: 'end', type: 'MATCH_END', at: 3000, clockMs: 30_000 }),
      ev({ id: 'c1', type: 'CORRECTION', actor: 'leitung', at: 3500, payload: { scores: { teamA: 5, teamB: 0 }, reason: 'Tore vergessen', basedOn: 'g1' } }),
      ev({ id: 're', type: 'REOPEN', actor: 'leitung', at: 3600, clockMs: 30_000 }),
      goal('g2', 'teamB', 4000, 40_000),
    ];
    const state = reduceMatch(log, ctx).state;
    const events = toRuntimeEvents(state, log, ctx);
    const view = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 }, log);

    expect(view.homeScore).toBe(5);
    expect(view.awayScore).toBe(1);
    expect(events.map((e) => e.id)).toEqual(['g1', 'g2']);
    expect(events[events.length - 1]?.scoreAfter).toEqual({ home: 5, away: 1 });
    expect(events[0]?.scoreAfter).toEqual({ home: 5, away: 0 });
  });

  it('toRuntimeEvents mit leerem Log liefert leere Ereignisliste', () => {
    const state = reduceMatch([start()], ctx).state;
    expect(toRuntimeEvents(state, [], ctx)).toEqual([]);
    const view = toLiveMatchView(state, meta, { serverNow: T, offsetMs: 0 }, []);
    expect(view.events).toEqual([]);
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

  it('liefert ohne Strafen eine leere Liste und rechnet bei stehender Uhr nur mit elapsedMs', () => {
    const empty: MatchState = { ...initialState(ctx), clock: { running: true, elapsedMs: 0, anchorAt: T } };
    expect(activePenaltiesView(empty, T + 60_000)).toEqual([]);

    const paused: MatchState = {
      ...initialState(ctx),
      clock: { running: false, elapsedMs: 30_000, anchorAt: null },
      penalties: [{ id: 'sp1', teamId: 'teamB', startMs: 0, durationMs: 120_000 }],
    };
    expect(activePenaltiesView(paused, T + 10 * 60_000)).toEqual([
      { id: 'sp1', teamId: 'teamB', remainingMs: 90_000 },
    ]);
  });
});
