/**
 * R3-3 Review #394 M-1: der Vergleich „nur öffentliche Ansicht geändert“ zieht wie das Speichern die Engine-Überlagerung ab.
 * Mocks wie useLifecycleLock.abschlussSperre.test.tsx, dazu eine Überlagerung für Spiel m1.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';
import { resetClosedTournaments } from '../../core/services/closedTournaments';

const showWarning = vi.hoisted(() => vi.fn());
vi.mock('../../components/ui/Toast', () => ({ useOptionalToast: () => ({ showWarning }) }));

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
vi.mock('../useEngineOverlayForTournament', () => ({
  useEngineOverlayForTournament: (t: unknown) => t,
  useEngineOverlaidMatchIds: () => ({ current: new Set(['m1']) }),
}));
// die Ableitungen für die Anzeige sind hier nicht Gegenstand (Spiel ohne Teams)
vi.mock('../../utils/calculations', () => ({ calculateStandings: () => [], calculateStandingsPerGroup: () => [] }));
vi.mock('../../core/generators', () => ({ generateFullSchedule: () => ({ allMatches: [], phases: [], teams: [] }) }));
vi.mock('../useRealtimeTournament', () => ({ useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }) }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => null }));

function turnier0(lifecycleStatus: Tournament['lifecycleStatus']): Tournament {
  return {
    id: 'live-cup', title: 'Live-Cup', status: 'published', lifecycleStatus, matches: [], teams: [], placementLogic: [],
    groupPhaseGameDuration: 10, pointSystem: { win: 3, draw: 1, loss: 0 }, numberOfFields: 1, version: 5,
  } as unknown as Tournament;
}

function turnier(lifecycleStatus: Tournament['lifecycleStatus']): Tournament {
  return {
    ...turnier0(lifecycleStatus),
    matches: [{ id: 'm1', matchStatus: 'scheduled', field: 1 }],
  } as unknown as Tournament;
}

beforeEach(() => {
  mockLoadTournament.mockReset();
  mockUpdateTournament.mockReset();
  showWarning.mockReset();
  resetClosedTournaments();
});
afterEach(() => resetClosedTournaments());

describe('R3-3 Review #394 M-1: öffentliche Ansicht beenden nach einem gespielten Turnier (Engine-Überlagerung)', () => {
  it('@LZ-037 Z. 5 Spiel 1 steht in der Anzeige 2:1 beendet (Engine), roh noch angesetzt: kein „nicht gespeichert“', async () => {
    mockLoadTournament.mockResolvedValue({ ...turnier('finished'), isPublic: true, shareCode: 'ABC123' });
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    const angezeigt = result.current.tournament!;

    await act(async () => {
      await result.current.handleTournamentUpdate({
        ...angezeigt, isPublic: false, shareCode: undefined, updatedAt: '2026-10-25T10:00:00.000Z',
        matches: angezeigt.matches.map((m) => ({ ...m, matchStatus: 'finished', scoreA: 2, scoreB: 1 })),
      });
    });

    expect(mockUpdateTournament).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: dieselbe Überlagerung plus eine echte Änderung (Name) – Hinweis „nicht gespeichert“', async () => {
    mockLoadTournament.mockResolvedValue({ ...turnier('finished'), isPublic: true, shareCode: 'ABC123' });
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    const angezeigt = result.current.tournament!;

    await act(async () => {
      await result.current.handleTournamentUpdate({
        ...angezeigt, title: 'Neuer Name', matches: angezeigt.matches.map((m) => ({ ...m, matchStatus: 'finished', scoreA: 2, scoreB: 1 })),
      });
    });

    expect(showWarning).toHaveBeenCalledTimes(1);
  });
});
