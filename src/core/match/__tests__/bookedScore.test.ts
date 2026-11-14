/**
 * @FU-139 (Befund C-ERGEBNISEINTRAG-TORE-WIDERSPRUCH): Weicht der im Spielplan eingetragene Stand von den im Cockpit gebuchten
 * Toren ab? Je Zeile des Szenarios ein Fall; Werte wörtlich aus dem Gherkin (gebucht 1:0, eingetragen 3:1).
 */
import { describe, expect, it } from 'vitest';
import { applyGoal, reverseGoal } from '../handlers/records';
import { initialState } from '../applyEvent';
import { bookedScoreMismatch } from '../bookedScore';
import type { EngineEvent, MatchContext, MatchState } from '../types';

const ctx: MatchContext = { matchId: 'spiel-9', teamAId: 'sv-sued', teamBId: 'fc-nord' };

const goalEvent = (id: string, teamId: string, type: 'GOAL' | 'OWN_GOAL' = 'GOAL'): EngineEvent =>
  ({ id, type, actor: 'helper', at: 1000, section: 1, clockMs: 1000, teamId, payload: {} });
const book = (state: MatchState, ...events: EngineEvent[]): MatchState => events.reduce((s, e) => applyGoal(s, e, ctx), state);

describe('bookedScoreMismatch (@FU-139)', () => {
  it('@FU-139 gebucht 1:0, eingetragen 3:1 → Abweichung mit dem gebuchten Stand „1:0“', () => {
    const state = book(initialState(ctx), goalEvent('t1', 'sv-sued'));
    expect(bookedScoreMismatch(state, ctx, { home: 3, away: 1 })).toBe('1:0');
  });

  it('@FU-139 Gegenbeispiel: eingetragen 1:0 (Stand aus dem Cockpit) → keine Abweichung', () => {
    const state = book(initialState(ctx), goalEvent('t1', 'sv-sued'));
    expect(bookedScoreMismatch(state, ctx, { home: 1, away: 0 })).toBeNull();
  });

  it('@FU-139 Gegenbeispiel: keine Tore gebucht → keine Abweichung, egal was eingetragen wird', () => {
    expect(bookedScoreMismatch(initialState(ctx), ctx, { home: 3, away: 1 })).toBeNull();
    expect(bookedScoreMismatch(initialState(ctx), ctx, { home: 0, away: 0 })).toBeNull();
  });

  it('@FU-139 zurückgenommenes Tor zählt nicht: Tor gebucht und zurückgenommen → keine Abweichung', () => {
    const state = reverseGoal(book(initialState(ctx), goalEvent('t1', 'sv-sued')), 't1');
    expect(bookedScoreMismatch(state, ctx, { home: 3, away: 1 })).toBeNull();
  });

  it('@FU-139 zurückgenommenes Tor zählt nicht: zwei Tore, eines zurückgenommen → gebucht 1:0', () => {
    const state = reverseGoal(book(initialState(ctx), goalEvent('t1', 'sv-sued'), goalEvent('t2', 'sv-sued')), 't2');
    expect(bookedScoreMismatch(state, ctx, { home: 2, away: 0 })).toBe('1:0');
    expect(bookedScoreMismatch(state, ctx, { home: 1, away: 0 })).toBeNull();
  });

  it('@FU-139 Eigentor zählt für die richtige Seite: Eigentor von SV Süd ist ein Tor für FC Nord (0:1)', () => {
    const state = book(initialState(ctx), goalEvent('e1', 'sv-sued', 'OWN_GOAL'));
    expect(bookedScoreMismatch(state, ctx, { home: 1, away: 0 })).toBe('0:1');
    expect(bookedScoreMismatch(state, ctx, { home: 0, away: 1 })).toBeNull();
  });

  it('@FU-139 nur eine Seite weicht ab: gebucht 2:1, eingetragen 2:3 → Abweichung', () => {
    const state = book(initialState(ctx), goalEvent('a', 'sv-sued'), goalEvent('b', 'sv-sued'), goalEvent('c', 'fc-nord'));
    expect(bookedScoreMismatch(state, ctx, { home: 2, away: 3 })).toBe('2:1');
    expect(bookedScoreMismatch(state, ctx, { home: 2, away: 1 })).toBeNull();
  });

  it('@FU-139 eingetragen 0:0 bei gebuchtem Tor widerspricht den gebuchten Toren', () => {
    const state = book(initialState(ctx), goalEvent('t1', 'fc-nord'));
    expect(bookedScoreMismatch(state, ctx, { home: 0, away: 0 })).toBe('0:1');
  });
});
