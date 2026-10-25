/**
 * R3-3: Auflage M-1 aus Review #393 (kein stilles Verwerfen von save() nach dem Abschluss) und die Anbindung des Abschlusses
 * an `useCan` (Plan R3 V6). Szenarien: @LZ-036, @LZ-037 Z. 5 (öffentliche Ansicht bleibt), @LZ-038. Mocks wie useLifecycleLock.test.tsx.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';
import { useTournamentManager } from '../useTournamentManager';
import { useLifecycleLock } from '../useLifecycleLock';
import { isTournamentClosedById, resetClosedTournaments } from '../../core/services/closedTournaments';

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
  showWarning.mockReset();
  resetClosedTournaments();
});
afterEach(() => resetClosedTournaments());

describe('R3-3 M-1 (Review #393): Speichern nach dem Abschluss wird nicht mehr still verworfen', () => {
  it('@LZ-036 abgeschlossen: die Änderung wird nicht gesendet, und die Person sieht „nicht gespeichert“', async () => {
    mockLoadTournament.mockResolvedValue(turnier('finished'));
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    await act(async () => { await result.current.handleTournamentUpdate({ ...result.current.tournament!, title: 'Neuer Name' }); });

    expect(mockUpdateTournament).not.toHaveBeenCalled();
    expect(showWarning).toHaveBeenCalledTimes(1);
    expect(showWarning).toHaveBeenCalledWith('tournament:rights.closedSaveBlocked');
  });

  it('@LZ-037 Gegenbeispiel: die öffentliche Ansicht beenden meldet nur den Stand nach dem Server-Weg – kein Hinweis „nicht gespeichert“', async () => {
    mockLoadTournament.mockResolvedValue({ ...turnier('finished'), isPublic: true, shareCode: 'ABC123' });
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    await act(async () => {
      await result.current.handleTournamentUpdate({
        ...result.current.tournament!, isPublic: false, shareCode: undefined, updatedAt: '2026-10-25T10:00:00.000Z',
      });
    });

    expect(mockUpdateTournament).not.toHaveBeenCalled();
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: offenes Turnier – gespeichert, kein Hinweis', async () => {
    mockLoadTournament.mockResolvedValue(turnier('fixed'));
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    await act(async () => { await result.current.handleTournamentUpdate({ ...result.current.tournament!, title: 'Neuer Name' }); });

    expect(mockUpdateTournament).toHaveBeenCalledTimes(1);
    expect(showWarning).not.toHaveBeenCalled();
  });

  it('eine Änderung zusammen mit einer öffentlichen-Ansicht-Änderung ist trotzdem „nicht gespeichert“ (Hinweis)', async () => {
    mockLoadTournament.mockResolvedValue(turnier('finished'));
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(result.current.tournament).not.toBeNull());

    await act(async () => { await result.current.handleTournamentUpdate({ ...result.current.tournament!, title: 'Neuer Name', isPublic: true }); });

    expect(showWarning).toHaveBeenCalledTimes(1);
  });
});

describe('R3-3 useLifecycleLock meldet den Abschluss an useCan (Verzeichnis der abgeschlossenen Turniere)', () => {
  it('abgeschlossenes Turnier wird eingetragen, ein offenes nicht', () => {
    renderHook(() => useLifecycleLock({ ...turnier('finished') }));
    renderHook(() => useLifecycleLock({ ...turnier('fixed'), id: 'offenes-cup' }));
    expect(isTournamentClosedById('live-cup')).toBe(true);
    expect(isTournamentClosedById('offenes-cup')).toBe(false);
  });

  it('der Verwaltungs-Hook trägt den geladenen Abschluss ein (Wiederöffnen trägt wieder aus)', async () => {
    mockLoadTournament.mockResolvedValue(turnier('finished'));
    const { result } = renderHook(() => useTournamentManager('live-cup'));
    await waitFor(() => expect(isTournamentClosedById('live-cup')).toBe(true));
    mockLoadTournament.mockResolvedValue(turnier('fixed'));
    await act(async () => { await result.current.reload({ fresh: true }); });
    await waitFor(() => expect(isTournamentClosedById('live-cup')).toBe(false));
  });
});
