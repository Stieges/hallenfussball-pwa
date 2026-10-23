/**
 * useCorrectionMode -- A-08e (Frage 1 = A, Daniel 15.10.): der Hook behaelt nur Zustand und
 * Start/Abbruch (B-24 baut den Ereignisweg in dieselbe Datei). Es gibt KEINE Bestaetigung mehr, die
 * Spielstaende schreibt (frueher: `onMatchesUpdate`/`onLocalTournamentUpdate`, @FU-084).
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useCorrectionMode } from '../useCorrectionMode';
import { ToastProvider } from '../../../../components/ui/Toast';
import type { Tournament, Match } from '../../../../types/tournament';
import { vs, testUuid } from '../../../../test/matchSlotFixtures';

function createMatch(overrides: Partial<Match> = {}): Match {
  return {
    id: 'm1',
    round: 1,
    field: 1,
    ...vs(testUuid(1), testUuid(2)),
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

describe('useCorrectionMode (Zustand + Start/Abbruch fuer B-24)', () => {
  const render_ = (canCorrectResults: boolean, tournament = createTournament([createMatch({ scoreA: 3, scoreB: 1 })])) =>
    renderHook(() => useCorrectionMode({ tournament, canCorrectResults }), { wrapper });

  it('Start merkt Spiel und Ausgangsstand und oeffnet den Dialogzustand; Abbruch setzt zurueck', () => {
    const { result } = render_(true);
    act(() => { result.current.handleStartCorrection('m1'); });
    expect(result.current.correctionState).toEqual({ matchId: 'm1', originalScoreA: 3, originalScoreB: 1 });
    expect(result.current.showCorrectionDialog).toBe(true);
    act(() => { result.current.handleCancelCorrection(); });
    expect(result.current.correctionState).toBeNull();
    expect(result.current.showCorrectionDialog).toBe(false);
  });

  it('Gegenbeispiel: ohne Berechtigung oder ohne Ergebnis startet keine Korrektur', () => {
    const denied = render_(false);
    act(() => { denied.result.current.handleStartCorrection('m1'); });
    expect(denied.result.current.correctionState).toBeNull();
    const noResult = render_(true, createTournament([createMatch({ scoreA: undefined, scoreB: undefined })]));
    act(() => { noResult.result.current.handleStartCorrection('m1'); });
    expect(noResult.result.current.correctionState).toBeNull();
  });

  it('A-08e: der Hook schreibt keinen Spielstand mehr (keine Bestaetigung, keine Schreib-Callbacks)', () => {
    const { result } = render_(true);
    expect(Object.keys(result.current).sort()).toEqual(
      ['correctionState', 'handleCancelCorrection', 'handleStartCorrection', 'showCorrectionDialog'],
    );
  });
});
