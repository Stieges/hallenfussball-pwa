import { describe, it, expect } from 'vitest';
import { toLiveMatchView, stableEvents, activePenaltiesView, foulCounts } from '../viewAdapters';
import { initialState } from '../../';

describe('viewAdapters', () => {
  it('mappt Status korrekt', () => {
    const meta = {
      id: 'm', number: 1, phaseLabel: 'Gruppe', fieldId: 'f',
      scheduledKickoff: new Date().toISOString(), homeTeam: { id: 'a', name: 'A' },
      awayTeam: { id: 'b', name: 'B' }, version: 1,
    };
    const view = toLiveMatchView(initialState({ matchId: 'm', teamAId: 'a', teamBId: 'b' }), meta);
    expect(view.status).toBe('NOT_STARTED');
  });

  it('berechnet activePenalties korrekt', () => {
    const state = initialState({ matchId: 'm', teamAId: 'a', teamBId: 'b' });
    state.penalties.push({ id: 'p1', teamId: 'a', playerNumber: 7, startMs: 1000, durationMs: 120000 });
    state.clock = { ...state.clock, elapsedMs: 60000 };
    const result = activePenaltiesView(state);
    expect(result[0].remainingMs).toBe(61000);
  });

  it('stableEvents behält Referenz bei Gleichheit', () => {
    const a = [{ id: 'e1', timestampSeconds: 1, type: 'GOAL' as const, payload: {}, scoreAfter: { home: 1, away: 0 } }];
    expect(stableEvents(a, a)).toBe(a);
  });

  it('foulCounts zählt für das ganze Spiel', () => {
    const state = initialState({ matchId: 'm', teamAId: 'a', teamBId: 'b' });
    (state as any).fouls = [{ id: 'f1', teamId: 'a', clockMs: 1000, section: 1 }, { id: 'f2', teamId: 'a', clockMs: 2000, section: 2 }];
    expect(foulCounts(state)).toEqual({ a: 2 });
  });
});
