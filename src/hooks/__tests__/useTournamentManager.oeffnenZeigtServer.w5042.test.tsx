/**
 * @W5-042: Öffnet die Verwaltung ein Turnier, steht zuerst die lokale Kopie da (local-first), der Cloud-Abruf läuft im Hintergrund und
 * meldet sich nicht bei der Anzeige. Hat die lokale Kopie keine Spiele (älterer Entwurf), folgt dem ersten Laden genau ein frisches
 * Lesen, damit nach kurzem Laden der Stand des Servers steht. Das Öffnen schreibt nie: weder das Laden noch die Anzeige rufen `updateTournament`. Mocks wie useTournamentManager.turnierWechsel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
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
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => null,
}));

function tournament(matchCount: number): Tournament {
  return {
    id: 'T',
    title: 'Cup',
    matches: Array.from({ length: matchCount }, (_unused, index) => ({ id: `m${index}`, round: 1, field: 1, ...looseVs('teamA', 'teamB'), scoreA: 0, scoreB: 0, matchStatus: 'scheduled', scheduledTime: new Date('2026-11-07T10:00:00.000Z') })),
    teams: [{ id: 'teamA', name: 'Heim' }, { id: 'teamB', name: 'Gast' }],
    placementLogic: [],
    groupPhaseGameDuration: 10,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    numberOfFields: 1,
    version: 2,
  } as unknown as Tournament;
}

describe('@W5-042 useTournamentManager: Öffnen zeigt den Stand des Servers und schreibt nichts', () => {
  beforeEach(() => {
    mockLoadTournament.mockReset();
    mockUpdateTournament.mockReset();
  });

  it('erst die ältere lokale Kopie ohne Spiele, dann das frische Lesen mit dem Stand des Servers (15 Spiele); kein Speichern', async () => {
    mockLoadTournament.mockResolvedValueOnce(tournament(0)).mockResolvedValueOnce(tournament(15));

    const { result } = renderHook(() => useTournamentManager('T'));

    await waitFor(() => expect(result.current.tournament?.matches.length).toBe(15));
    expect(mockLoadTournament).toHaveBeenCalledTimes(2);
    expect(mockLoadTournament.mock.calls[0][1]).toBeUndefined(); // local-first: die Anzeige wartet nicht auf die Cloud
    expect(mockLoadTournament.mock.calls[1][1]).toEqual({ fresh: true });
    expect(mockUpdateTournament).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: hat die lokale Kopie Spiele, bleibt es beim einen Laden (kein zusätzlicher Abruf)', async () => {
    mockLoadTournament.mockResolvedValue(tournament(15));

    const { result } = renderHook(() => useTournamentManager('T'));

    await waitFor(() => expect(result.current.tournament?.matches.length).toBe(15));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(mockLoadTournament).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel: eine echte Änderung wird weiter gespeichert', async () => {
    mockLoadTournament.mockResolvedValue(tournament(15));
    mockUpdateTournament.mockResolvedValue(undefined);
    const { result } = renderHook(() => useTournamentManager('T'));
    await waitFor(() => expect(result.current.tournament?.matches.length).toBe(15));
    expect(mockUpdateTournament).not.toHaveBeenCalled();

    await result.current.handleTournamentUpdate({ ...tournament(15), title: 'Neuer Name' });

    expect(mockUpdateTournament).toHaveBeenCalledTimes(1);
  });
});
