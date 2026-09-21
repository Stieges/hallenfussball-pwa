/**
 * toRuntimeMatchEvent — Umrechnung Draht-Format → UI-Format.
 *
 * Hintergrund: Der MatchExecutionService schreibt `{ team, delta, durationSeconds }`,
 * das Cockpit liest `{ teamId, teamName, direction, penaltyDuration }`. Weil beide
 * Seiten nur optionale Felder deklarieren, hat `tsc` dazu nie etwas gesagt — zur
 * Laufzeit war jedes gelesene Feld `undefined` (Foulzähler 0, falscher Teamname,
 * jede Zeitstrafe "2 Min"). Diese Tests decken jeden Ereignistyp ab.
 */
import { describe, it, expect } from 'vitest';
import { toRuntimeMatchEvent, toRuntimeMatchEvents, type WireMatchEvent } from '../matchEvents';
import type { MatchEvent as CoreMatchEvent } from '../../core/models/LiveMatch';

const homeTeam = { id: 'team-a', name: 'FC Alpha' };
const awayTeam = { id: 'team-b', name: 'SV Beta' };

function wireEvent(overrides: Partial<CoreMatchEvent> = {}): CoreMatchEvent {
  return {
    id: 'e1',
    matchId: 'match-1',
    timestampSeconds: 42,
    type: 'GOAL',
    payload: {},
    scoreAfter: { home: 0, away: 0 },
    ...overrides,
  };
}

describe('toRuntimeMatchEvent — Mannschaftszuordnung', () => {
  it('GOAL mit team: "away" liefert teamId/teamName der Gastmannschaft', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ payload: { team: 'away', delta: 1 }, scoreAfter: { home: 0, away: 1 } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.teamId).toBe('team-b');
    expect(result.payload.teamName).toBe('SV Beta');
  });

  it('GOAL mit team: "home" liefert teamId/teamName der Heimmannschaft', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.teamId).toBe('team-a');
    expect(result.payload.teamName).toBe('FC Alpha');
  });

  it('FOUL behält die Mannschaftsseite — Grundlage der Foulzähler nach Reload', () => {
    const home = toRuntimeMatchEvent(wireEvent({ type: 'FOUL', payload: { team: 'home' } }), homeTeam, awayTeam);
    const away = toRuntimeMatchEvent(wireEvent({ type: 'FOUL', payload: { team: 'away' } }), homeTeam, awayTeam);

    expect(home.payload.teamId).toBe('team-a');
    expect(away.payload.teamId).toBe('team-b');
  });

  it('ohne team bleibt teamId undefined statt auf eine Mannschaft zu raten', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ type: 'STATUS_CHANGE', payload: { toStatus: 'RUNNING' } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.teamId).toBeUndefined();
    expect(result.payload.teamName).toBeUndefined();
  });
});

describe('toRuntimeMatchEvent — Richtung', () => {
  it('delta: 1 wird zu direction: "INC"', () => {
    const result = toRuntimeMatchEvent(wireEvent({ payload: { team: 'home', delta: 1 } }), homeTeam, awayTeam);
    expect(result.payload.direction).toBe('INC');
  });

  it('delta: -1 wird zu direction: "DEC"', () => {
    const result = toRuntimeMatchEvent(wireEvent({ payload: { team: 'home', delta: -1 } }), homeTeam, awayTeam);
    expect(result.payload.direction).toBe('DEC');
  });

  it('ohne delta bleibt direction undefined', () => {
    const result = toRuntimeMatchEvent(wireEvent({ type: 'FOUL', payload: { team: 'away' } }), homeTeam, awayTeam);
    expect(result.payload.direction).toBeUndefined();
  });
});

describe('toRuntimeMatchEvent — Zeitstrafen-Dauer', () => {
  it('durationSeconds: 300 wird zu penaltyDuration: 300 (Log sagt heute immer "2 Min")', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ type: 'TIME_PENALTY', payload: { team: 'away', durationSeconds: 300, playerNumber: 7 } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.penaltyDuration).toBe(300);
    expect(result.payload.teamName).toBe('SV Beta');
    expect(result.payload.playerNumber).toBe(7);
  });

  it('durationSeconds: 120 wird zu penaltyDuration: 120', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ type: 'TIME_PENALTY', payload: { team: 'home', durationSeconds: 120 } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.penaltyDuration).toBe(120);
  });
});

describe('toRuntimeMatchEvent — Verlustfreiheit', () => {
  it('GOAL: playerNumber und assists überleben die Umrechnung', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ payload: { team: 'home', delta: 1, playerNumber: 9, assists: [4, 11] } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.playerNumber).toBe(9);
    expect(result.payload.assists).toEqual([4, 11]);
  });

  it('SUBSTITUTION: playersIn und playersOut überleben die Umrechnung', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ type: 'SUBSTITUTION', payload: { team: 'away', playersOut: [3], playersIn: [12, 14] } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.playersOut).toEqual([3]);
    expect(result.payload.playersIn).toEqual([12, 14]);
    expect(result.payload.teamName).toBe('SV Beta');
  });

  it('STATUS_CHANGE: toStatus überlebt die Umrechnung', () => {
    const result = toRuntimeMatchEvent(
      wireEvent({ type: 'STATUS_CHANGE', payload: { toStatus: 'FINISHED' } }),
      homeTeam,
      awayTeam
    );

    expect(result.payload.toStatus).toBe('FINISHED');
  });

  it('YELLOW_CARD/RED_CARD: cardType überlebt die Umrechnung', () => {
    const yellow = toRuntimeMatchEvent(
      wireEvent({ type: 'YELLOW_CARD', payload: { team: 'home', cardType: 'YELLOW', playerNumber: 5 } }),
      homeTeam,
      awayTeam
    );
    const red = toRuntimeMatchEvent(
      wireEvent({ type: 'RED_CARD', payload: { team: 'away', cardType: 'RED' } }),
      homeTeam,
      awayTeam
    );

    expect(yellow.payload.cardType).toBe('YELLOW');
    expect(yellow.payload.playerNumber).toBe(5);
    expect(red.payload.cardType).toBe('RED');
  });

  it('Kopf-Felder (id, matchId, timestampSeconds, type, scoreAfter, incomplete) bleiben erhalten', () => {
    const event: WireMatchEvent = {
      ...wireEvent({ payload: { team: 'home', delta: 1 }, scoreAfter: { home: 3, away: 2 } }),
      incomplete: true,
    };

    const result = toRuntimeMatchEvent(event, homeTeam, awayTeam);

    expect(result.id).toBe('e1');
    expect(result.matchId).toBe('match-1');
    expect(result.timestampSeconds).toBe(42);
    expect(result.type).toBe('GOAL');
    expect(result.scoreAfter).toEqual({ home: 3, away: 2 });
    expect(result.incomplete).toBe(true);
  });

  it('bereits normalisierte Ereignisse überstehen den Durchlauf unverändert', () => {
    const alreadyUi: WireMatchEvent = {
      id: 'e9',
      matchId: 'match-1',
      timestampSeconds: 10,
      type: 'TIME_PENALTY',
      payload: { teamId: 'team-b', teamName: 'SV Beta', direction: 'INC', penaltyDuration: 300 },
      scoreAfter: { home: 0, away: 0 },
    };

    const result = toRuntimeMatchEvent(alreadyUi, homeTeam, awayTeam);

    expect(result.payload.teamId).toBe('team-b');
    expect(result.payload.teamName).toBe('SV Beta');
    expect(result.payload.direction).toBe('INC');
    expect(result.payload.penaltyDuration).toBe(300);
  });
});

describe('toRuntimeMatchEvents', () => {
  it('rechnet eine ganze Liste um und behält die Reihenfolge', () => {
    const events: CoreMatchEvent[] = [
      wireEvent({ id: 'e1', type: 'FOUL', payload: { team: 'home' } }),
      wireEvent({ id: 'e2', payload: { team: 'away', delta: 1 } }),
      wireEvent({ id: 'e3', type: 'TIME_PENALTY', payload: { team: 'home', durationSeconds: 300 } }),
    ];

    const result = toRuntimeMatchEvents(events, homeTeam, awayTeam);

    expect(result.map((e) => e.id)).toEqual(['e1', 'e2', 'e3']);
    expect(result[0].payload.teamId).toBe('team-a');
    expect(result[1].payload.teamName).toBe('SV Beta');
    expect(result[2].payload.penaltyDuration).toBe(300);
  });
});
