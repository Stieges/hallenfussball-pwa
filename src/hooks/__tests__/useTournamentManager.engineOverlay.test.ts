/**
 * useTournamentManager x useEngineOverlayForTournament (C3a-2a, W7): Engine-Ergebnisse fliessen
 * NUR lokal in die Turnier-Ausgabe -- kein Versionssprung, kein `syncUp` (Spy auf
 * `TournamentService.updateTournament` bleibt unberuehrt, solange niemand `handleTournamentUpdate`
 * aufruft), Ueberlagerung reagiert auf `engine.subscribe`.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';

const mockLoadTournament = vi.fn();
const mockUpdateTournament = vi.fn();

vi.mock('../../core/services/TournamentService', () => {
  class MockTournamentService {
    loadTournament = mockLoadTournament;
    updateTournament = mockUpdateTournament;
    schedule = {};
  }
  return { TournamentService: MockTournamentService };
});

const STABLE_TOURNAMENT_REPOSITORY = {};
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: STABLE_TOURNAMENT_REPOSITORY, isRealtimeEnabled: false }),
}));
vi.mock('../useRealtimeTournament', () => ({
  useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }),
}));

let listeners: Array<() => void> = [];
const mockView = vi.fn();
const mockEngineContext: { engine: { view: typeof mockView; subscribe: (l: () => void) => () => void } } = {
  engine: {
    view: mockView,
    subscribe: (listener: () => void) => {
      listeners.push(listener);
      return () => {
        listeners = listeners.filter((l) => l !== listener);
      };
    },
  },
};
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockEngineContext,
}));

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'tour-overlay',
    matches: [
      {
        id: 'm1',
        round: 1,
        field: 1,
        teamA: 'teamA',
        teamB: 'teamB',
        scoreA: 0,
        scoreB: 0,
        matchStatus: 'scheduled',
        scheduledTime: new Date('2026-09-27T10:00:00.000Z'),
      },
    ],
    teams: [
      { id: 'teamA', name: 'Heim' },
      { id: 'teamB', name: 'Gast' },
    ],
    placementLogic: [],
    groupPhaseGameDuration: 20,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    numberOfFields: 1,
    ...overrides,
  } as unknown as Tournament;
}

describe('useTournamentManager x useEngineOverlayForTournament (W7)', () => {
  beforeEach(() => {
    listeners = [];
    mockView.mockReset().mockReturnValue(null);
    mockLoadTournament.mockReset();
    mockUpdateTournament.mockReset();
  });

  it('ueberlagert scoreA/scoreB aus der Engine-Ansicht, sobald diese Ereignisse hat', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));

    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    expect(result.current.tournament?.matches[0].scoreA).toBe(0);

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'running',
          phase: 'regular',
          scores: { teama: { regular: 2, overtime: 0, shootout: 0 }, teamb: { regular: 1, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: null,
          decidedBy: null,
          finishedAt: null,
          clock: { running: true, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 'g1', type: 'GOAL' }],
      confirmedCount: 1,
    });
    // W7: die Ueberlagerung reagiert auf engine.subscribe, nicht nur auf einen neuen `tournament`.
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();

    await waitFor(() => expect(result.current.tournament?.matches[0].scoreA).toBe(2));
    expect(result.current.tournament?.matches[0].scoreB).toBe(1);
    // Rein lokal: KEIN Speicherpfad ausgeloest.
    expect(mockUpdateTournament).not.toHaveBeenCalled();
  });
});
