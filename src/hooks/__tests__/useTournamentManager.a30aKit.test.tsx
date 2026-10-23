/**
 * A-30a (@W3-028): die getragenen Farben aus dem eigenen MATCH_START erscheinen in der Turnierkopie
 * (Ueberlagerung), gelangen aber nie in den Speicherpfad -- sie schreibt nur der Server beim Anpfiff
 * (Schutz-Trigger HF003). Muster und Mocks wie useTournamentManager.engineOverlay.test.ts (I3).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';
import { looseVs } from '../../test/matchSlotFixtures';

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
        ...looseVs('teamA', 'teamB'),
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
    version: 5,
    ...overrides,
  } as unknown as Tournament;
}

const KIT = { a: '#FFCC00', b: '#C62828', bibSide: 'a' };

describe('A-30a useTournamentManager: getragene Farben nur lokal', () => {
  beforeEach(() => {
    listeners = [];
    mockView.mockReset().mockReturnValue(null);
    mockLoadTournament.mockReset();
    mockUpdateTournament.mockReset();
  });

  it('@W3-028 Ueberlagerung zeigt kit aus dem MATCH_START, ein Voll-Speichern uebernimmt es NICHT', async () => {
    mockLoadTournament.mockResolvedValue(makeTournament());
    const { result, rerender } = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    mockView.mockReturnValue({
      result: {
        state: {
          status: 'running',
          phase: 'regular',
          scores: { teama: { regular: 0, overtime: 0, shootout: 0 }, teamb: { regular: 0, overtime: 0, shootout: 0 } },
          overrides: [],
          baseDecidedBy: null,
          decidedBy: null,
          finishedAt: null,
          clock: { running: true, elapsedMs: 0, anchorAt: null },
        },
        localRejected: [],
        needsFullReload: false,
      },
      log: [{ id: 's1', type: 'MATCH_START', payload: { rules: {}, kit: KIT } }],
      confirmedCount: 0,
    });
    act(() => {
      listeners.forEach((listener) => listener());
    });
    rerender();
    await waitFor(() => expect(result.current.tournament?.matches[0].kit).toEqual(KIT));

    const overlaidSnapshot = result.current.tournament!;
    const callerUpdate: Tournament = { ...overlaidSnapshot, matches: [{ ...overlaidSnapshot.matches[0], referee: 7 }] };
    await act(async () => {
      await result.current.handleTournamentUpdate(callerUpdate);
    });

    const persisted = mockUpdateTournament.mock.calls[0][0] as Tournament;
    expect(persisted.matches[0].referee).toBe(7);
    expect(persisted.matches[0].kit).toBeUndefined();
  });
});
