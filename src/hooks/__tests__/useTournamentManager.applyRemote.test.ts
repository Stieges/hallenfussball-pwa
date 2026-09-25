/**
 * useTournamentManager.applyRemote — Task A1 (Sofortschutz), Fixrunde 1 (I2).
 *
 * Review-Befund I2: die bisherige Negativprüfung im useMatchExecution-Test
 * (`mockTournamentRepository.save).not.toHaveBeenCalled()`) prüfte nichts — der Hook hat
 * `tournamentRepository.save` auch VOR dem A1-Fix nie direkt aufgerufen, der Speicherweg lag in
 * `useTournamentManager.handleTournamentUpdate` (das seinerseits `service.updateTournament`
 * aufruft). Dieser Test sichert deshalb direkt an der Quelle ab: `applyRemote` setzt NUR den
 * lokalen State und ruft `TournamentService.updateTournament` (und damit den Speicherweg) NICHT
 * auf — im Gegensatz zu `handleTournamentUpdate`, das das sehr wohl tut.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';

const mockLoadTournament = vi.fn();
const mockUpdateTournament = vi.fn();

vi.mock('../../core/services/TournamentService', () => {
  // Echte Klasse statt vi.fn().mockImplementation(() => ({...})) — arrow-function-Objekte sind
  // nicht `new`-fähig, `new TournamentService(...)` würde sonst werfen (gleiches Muster wie
  // useMatchExecution.test.ts für MatchExecutionService).
  class MockTournamentService {
    loadTournament = mockLoadTournament;
    updateTournament = mockUpdateTournament;
    schedule = {};
  }
  return { TournamentService: MockTournamentService };
});

// Stabile Referenz: `service` im Hook ist `useMemo(() => new TournamentService(tournamentRepository),
// [tournamentRepository])` — eine bei jedem Aufruf NEU erzeugte Objekt-Literal-Instanz hier würde
// diese Dependency bei jedem Render ändern und damit `loadTournament` (hängt an `service` ab) und
// den Lade-Effekt (hängt an `loadTournament` ab) auf jedem Render neu feuern lassen: ein Endlos-
// Render-Loop, an dem `waitFor()` unten hängen bleibt (beobachtet: Timeout nach 5s).
const STABLE_TOURNAMENT_REPOSITORY = {};

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({
    tournamentRepository: STABLE_TOURNAMENT_REPOSITORY,
    isRealtimeEnabled: false,
  }),
}));

vi.mock('../useRealtimeTournament', () => ({
  useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }),
}));

function makeTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 'tour-1',
    matches: [],
    teams: [],
    // calculateStandings() (aufgerufen im currentStandings-useMemo des Hooks) liest
    // placementLogic direkt — ohne dieses Feld wirft der Hook beim Rendern.
    placementLogic: [],
    ...overrides,
  } as unknown as Tournament;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLoadTournament.mockResolvedValue(makeTournament());
});

describe('useTournamentManager.applyRemote — kein Speicherweg (Task A1, Fixrunde 1 I2)', () => {
  it('setzt den Tournament-State, ohne TournamentService.updateTournament aufzurufen', async () => {
    const { result } = renderHook(() => useTournamentManager('tour-1'));

    // Initialen Ladevorgang abwarten, sonst überschreibt er das gleich wieder.
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    mockUpdateTournament.mockClear();

    const remoteTournament = makeTournament({ title: 'Nach Spielende neu geladen' });

    act(() => {
      result.current.applyRemote(remoteTournament);
    });

    expect(result.current.tournament).toEqual(remoteTournament);
    expect(mockUpdateTournament).not.toHaveBeenCalled();
  });

  it('Gegenprobe: handleTournamentUpdate (der ECHTE Speicherweg) ruft TournamentService.updateTournament auf', async () => {
    const { result } = renderHook(() => useTournamentManager('tour-1'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    mockUpdateTournament.mockClear();
    mockUpdateTournament.mockResolvedValueOnce(undefined);

    const updated = makeTournament({ title: 'Gespeicherte Änderung' });

    await act(async () => {
      await result.current.handleTournamentUpdate(updated);
    });

    expect(mockUpdateTournament).toHaveBeenCalledWith(updated);
  });
});
