/**
 * @ME-071: der Monitor-Editor erfährt ein gescheitertes Speichern (`saveTournamentOrThrow`), alle anderen Aufrufer
 * (`handleTournamentUpdate`) behalten das bisherige Verhalten (Fehler wird behandelt, nicht weitergereicht).
 * Mocks wie useTournamentManager.a30aKit.test.tsx.
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

describe('@ME-071 useTournamentManager: Speichern für den Monitor-Editor', () => {
  beforeEach(() => {
    listeners = [];
    mockView.mockReset().mockReturnValue(null);
    mockLoadTournament.mockReset().mockResolvedValue(makeTournament());
    mockUpdateTournament.mockReset();
  });

  async function bereit() {
    const rendered = renderHook(() => useTournamentManager('tour-overlay'));
    await waitFor(() => expect(rendered.result.current.tournament).not.toBeNull());
    return rendered.result;
  }

  it('Speichern scheitert: saveTournamentOrThrow wirft den Fehler', async () => {
    const result = await bereit();
    mockUpdateTournament.mockRejectedValue(new Error('Server weg'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(result.current.saveTournamentOrThrow({ ...result.current.tournament!, title: 'Neu' })).rejects.toThrow('Server weg');
  });

  it('Gegenbeispiel: dasselbe Scheitern bei handleTournamentUpdate wird nicht weitergereicht (bisheriges Verhalten)', async () => {
    const result = await bereit();
    mockUpdateTournament.mockRejectedValue(new Error('Server weg'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(result.current.handleTournamentUpdate({ ...result.current.tournament!, title: 'Neu' })).resolves.toBeUndefined();
  });

  it('Gegenbeispiel: gelingt das Speichern, wirft saveTournamentOrThrow nicht und speichert genau einmal', async () => {
    const result = await bereit();
    mockUpdateTournament.mockResolvedValue(undefined);
    await act(async () => { await result.current.saveTournamentOrThrow({ ...result.current.tournament!, title: 'Neu' }); });
    expect(mockUpdateTournament).toHaveBeenCalledTimes(1);
  });
});
