/**
 * useCorrectionMode.test.ts — A2 Fixrunde 1 (Ruling AJ, C1/I2:
 * .superpowers/sdd/2026-09-25-oktober-fundament-helfer/task-A2-review.md).
 *
 * C1 (Critical): the correction dialog used to persist a corrected result ONLY via a full
 * `onTournamentUpdate()` save, which (since A2) skips result columns for EXISTING matches --
 * the correction landed in local state/IndexedDB, never in the cloud. Fixed by switching to
 * `onLocalTournamentUpdate` (local sync) + `onMatchesUpdate` (targeted UPDATE_MATCH).
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useCorrectionMode } from '../useCorrectionMode';
import { ToastProvider } from '../../../../components/ui/Toast';
import type { Tournament, Match } from '../../../../types/tournament';

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    round: 1,
    field: 1,
    teamA: 'Team A',
    teamB: 'Team B',
    scoreA: 3,
    scoreB: 1,
    matchStatus: 'finished',
    ...overrides,
  };
}

function createTournament(matches: Match[]): Tournament {
  return {
    id: 'test-tournament',
    title: 'Test Tournament',
    sport: 'hallenfussball',
    tournamentType: 'group_only',
    status: 'published',
    date: '2026-01-01',
    location: { name: '' },
    numberOfFields: 1,
    numberOfTeams: 2,
    numberOfGroups: 1,
    groupPhaseGameDuration: 10,
    pointSystem: { win: 3, draw: 1, loss: 0 },
    teams: [],
    matches,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as unknown as Tournament;
}

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

describe('useCorrectionMode — handleConfirmCorrection', () => {
  it('persists the corrected result via onMatchesUpdate (UPDATE_MATCH), NOT a full save', () => {
    const tournament = createTournament([createMatch({ scoreA: 3, scoreB: 1 })]);
    const onLocalTournamentUpdate = vi.fn();
    const onMatchesUpdate = vi.fn();

    const { result } = renderHook(
      () =>
        useCorrectionMode({
          tournament,
          onLocalTournamentUpdate,
          onMatchesUpdate,
          canCorrectResults: true,
        }),
      { wrapper }
    );

    act(() => {
      result.current.handleStartCorrection('m1');
    });
    expect(result.current.correctionState).toEqual(
      expect.objectContaining({ matchId: 'm1', originalScoreA: 3, originalScoreB: 1 })
    );

    act(() => {
      result.current.handleConfirmCorrection(4, 1, 'referee_decision', 'Schiedsrichter-Korrektur');
    });

    // Local UI state (standings etc.) still syncs immediately ...
    expect(onLocalTournamentUpdate).toHaveBeenCalledTimes(1);
    // ... but the RESULT persists via a targeted update, not a full tournament save.
    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    const updates = onMatchesUpdate.mock.calls[0][0];
    // A2 Fixrunde 3 (N1a): only the field that ACTUALLY changed goes out -- scoreB stayed 1,
    // so it must NOT appear in the update (Fixrunde 1 would have included it, sourced from the
    // caller's local state, even though it didn't change).
    expect(updates).toEqual([{ id: 'm1', scoreA: 4 }]);
  });

  it('does NOT call onMatchesUpdate when there is no active correction', () => {
    const tournament = createTournament([createMatch()]);
    const onLocalTournamentUpdate = vi.fn();
    const onMatchesUpdate = vi.fn();

    const { result } = renderHook(
      () =>
        useCorrectionMode({
          tournament,
          onLocalTournamentUpdate,
          onMatchesUpdate,
          canCorrectResults: true,
        }),
      { wrapper }
    );

    act(() => {
      // No handleStartCorrection() call first -- correctionState is null.
      result.current.handleConfirmCorrection(4, 1, 'input_error');
    });

    expect(onLocalTournamentUpdate).not.toHaveBeenCalled();
    expect(onMatchesUpdate).not.toHaveBeenCalled();
  });
});
