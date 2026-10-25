/**
 * R3-2b Sperre nach dem Abschluss (Plan R3 E10, R-EA-13; Record Lebenszyklus @LZ-036 „alles gesperrt“, @LZ-038 „Server lehnt
 * ab“): Ist das Turnier abgeschlossen, schickt die App kein `save()` mehr – sonst landete jede Änderung (Autosave, alte
 * Felder) mit 55000 in der Fehlerliste. Die Anzeige lädt stattdessen den Stand des Servers. Grundlage für R3-3.
 * Muster und Mocks wie useTournamentManager.a30aKit.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';
import { useLifecycleLock } from '../useLifecycleLock';

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
vi.mock('../useRealtimeTournament', () => ({ useRealtimeTournament: () => ({ isConnected: false, status: 'disconnected' }) }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({ useMatchEngineContextOptional: () => null }));

function turnier(lifecycleStatus: Tournament['lifecycleStatus']): Tournament {
  return {
    id: 'live-cup', title: 'Live-Cup', status: 'published', lifecycleStatus, matches: [], teams: [], placementLogic: [],
    groupPhaseGameDuration: 10, pointSystem: { win: 3, draw: 1, loss: 0 }, numberOfFields: 1, version: 5,
  } as unknown as Tournament;
}

beforeEach(() => {
  mockLoadTournament.mockReset();
  mockUpdateTournament.mockReset();
});

describe('R3-2b E10 nach dem Abschluss kein save()', () => {
  it('@LZ-036 @LZ-038 Turnier abgeschlossen: eine Änderung wird nicht gesendet, die Anzeige lädt den Stand des Servers', async () => {
    mockLoadTournament.mockResolvedValue(turnier('finished'));
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());
    const vorher = mockLoadTournament.mock.calls.length;

    await act(async () => { await result.current.handleTournamentUpdate({ ...result.current.tournament!, title: 'Neuer Name' }); });

    expect(mockUpdateTournament).not.toHaveBeenCalled();
    expect(mockLoadTournament.mock.calls.length).toBe(vorher + 1);
    expect(mockLoadTournament).toHaveBeenLastCalledWith('live-cup', { fresh: true });
    expect(result.current.tournament?.title).toBe('Live-Cup');
  });

  it('Gegenbeispiel: Turnier läuft (festgelegt) → die Änderung wird gespeichert', async () => {
    mockLoadTournament.mockResolvedValue(turnier('fixed'));
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    await act(async () => { await result.current.handleTournamentUpdate({ ...result.current.tournament!, title: 'Neuer Name' }); });

    expect(mockUpdateTournament).toHaveBeenCalledTimes(1);
  });
});

describe('R3-2b useLifecycleLock', () => {
  it.each([
    ['abgeschlossen', 'finished', true],
    ['abgebrochen (MVP+, vom Server gesperrt)', 'cancelled', true],
    ['festgelegt / läuft', 'fixed', false],
    ['Entwurf', 'draft', false],
  ] as const)('%s → gesperrt: %s', (_lage, lifecycle, closed) => {
    const { result } = renderHook(() => useLifecycleLock(turnier(lifecycle)));
    expect(result.current.closed).toBe(closed);
    expect(result.current.saveAllowed(turnier('fixed'))).toBe(!closed);
  });

  it('noch nicht geladen: nichts gesperrt; ein neuer Stand, der abgeschlossen ist, wird nie gespeichert', () => {
    const { result } = renderHook(() => useLifecycleLock(null));
    expect(result.current.closed).toBe(false);
    expect(result.current.saveAllowed(turnier('finished'))).toBe(false);
  });
});
