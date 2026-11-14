/**
 * @W5-042: Öffnet die Verwaltung ein Turnier, steht zuerst die lokale Kopie da (local-first), der Cloud-Abruf läuft im Hintergrund und
 * meldet sich nicht bei der Anzeige. Hat die lokale Kopie keine Spiele (älterer Entwurf), folgt dem ersten Laden genau ein frisches
 * Lesen, damit nach kurzem Laden der Stand des Servers steht. Das Öffnen schreibt nie: weder das Laden noch die Anzeige rufen `updateTournament`. Mocks wie useTournamentManager.turnierWechsel.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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
const repoState: { current: object } = { current: STABLE_TOURNAMENT_REPOSITORY };
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ tournamentRepository: repoState.current, isRealtimeEnabled: false }),
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

describe('@W5-042 useTournamentManager: Laden-Anzeige bleibt, bis das Nachlesen fertig ist', () => {
  beforeEach(() => {
    mockLoadTournament.mockReset();
    mockUpdateTournament.mockReset();
    repoState.current = STABLE_TOURNAMENT_REPOSITORY;
  });

  function held<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  }

  it('ohne Spiele lokal: isLoading bleibt bis zur Antwort des zweiten Ladens stehen; danach mit Spielen geladen', async () => {
    const second = held<Tournament>();
    mockLoadTournament.mockResolvedValueOnce(tournament(0)).mockReturnValueOnce(second.promise);

    const { result } = renderHook(() => useTournamentManager('T'));

    await waitFor(() => expect(mockLoadTournament).toHaveBeenCalledTimes(2));
    expect(result.current.isLoading).toBe(true);
    await act(async () => { second.resolve(tournament(15)); await second.promise; });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tournament?.matches.length).toBe(15);
  });

  it('scheitert das Nachlesen (offline), endet die Laden-Anzeige trotzdem; die lokale Kopie ohne Spiele bleibt', async () => {
    const second = held<Tournament>();
    mockLoadTournament.mockResolvedValueOnce(tournament(0)).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => useTournamentManager('T'));
    await waitFor(() => expect(mockLoadTournament).toHaveBeenCalledTimes(2));
    expect(result.current.isLoading).toBe(true);

    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await act(async () => { second.reject(new Error('offline')); await second.promise.catch(() => undefined); });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.tournament?.matches.length).toBe(0);
    expect(mockLoadTournament).toHaveBeenCalledTimes(2);
  });

  it('Gegenbeispiel: lokale Kopie mit Spielen -> kein zweites Laden, isLoading endet nach dem ersten Laden', async () => {
    mockLoadTournament.mockResolvedValue(tournament(15));
    const { result } = renderHook(() => useTournamentManager('T'));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(mockLoadTournament).toHaveBeenCalledTimes(1);
  });

  it('Unmount vor dem ersten Laden: kein Nachlesen mehr', async () => {
    const first = held<Tournament>();
    mockLoadTournament.mockReturnValueOnce(first.promise);
    const { unmount } = renderHook(() => useTournamentManager('T'));
    unmount();
    await act(async () => { first.resolve(tournament(0)); await first.promise; });
    expect(mockLoadTournament).toHaveBeenCalledTimes(1);
  });

  it('Turnierwechsel mitten im Nachlesen: isLoading bleibt true, bis die neue Kette fertig ist (kein Aufblitzen des Hinweises)', async () => {
    const secondOld = held<Tournament>();
    const firstNew = held<Tournament>();
    mockLoadTournament
      .mockResolvedValueOnce(tournament(0)) // alt, erstes Laden
      .mockReturnValueOnce(secondOld.promise) // alt, Nachlesen (hängt)
      .mockReturnValueOnce(firstNew.promise); // neu, erstes Laden (hängt)
    const { result, rerender } = renderHook(({ id }) => useTournamentManager(id), { initialProps: { id: 'T' } });
    await waitFor(() => expect(mockLoadTournament).toHaveBeenCalledTimes(2));

    rerender({ id: 'U' });
    await waitFor(() => expect(mockLoadTournament).toHaveBeenCalledTimes(3));
    await act(async () => { secondOld.resolve(tournament(0)); await secondOld.promise; });

    expect(result.current.isLoading).toBe(true);
    await act(async () => { firstNew.resolve(tournament(15)); await firstNew.promise; });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('abgebrochene Kette (Wechsel des Dienstes bei gleicher Adresse) setzt isLoading nicht zurück, solange die neue Kette hält', async () => {
    const secondOld = held<Tournament>();
    const firstNew = held<Tournament>();
    const secondNew = held<Tournament>();
    mockLoadTournament
      .mockResolvedValueOnce(tournament(0)) // alt, erstes Laden
      .mockReturnValueOnce(secondOld.promise) // alt, Nachlesen (hängt)
      .mockResolvedValueOnce(tournament(0)) // neu, erstes Laden (hält)
      .mockReturnValueOnce(secondNew.promise); // neu, Nachlesen (hängt)
    const { result, rerender } = renderHook(() => useTournamentManager('T'));
    await waitFor(() => expect(mockLoadTournament).toHaveBeenCalledTimes(2));

    repoState.current = {}; // neuer Dienst, gleiche Adresse
    rerender();
    await waitFor(() => expect(mockLoadTournament).toHaveBeenCalledTimes(4));
    await act(async () => { secondOld.resolve(tournament(0)); await secondOld.promise; });

    expect(result.current.isLoading).toBe(true);
    await act(async () => { secondNew.resolve(tournament(15)); await secondNew.promise; });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    firstNew.resolve(tournament(0));
    repoState.current = STABLE_TOURNAMENT_REPOSITORY;
  });
});
