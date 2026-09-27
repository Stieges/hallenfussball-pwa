/**
 * ManagementTab — P7 (C3a-2a Fixrunde 3): scheitert `getLiveMatchData` (z. B. weil
 * `ensureEngineMatchReady` fuer ein engine-bestimmtes Spiel wirft, das auch nach `ensureMatch`
 * keine Ansicht liefert), zeigte der Mount-Effekt bisher nur `console.error` und danach die
 * irrefuehrende Leeranzeige "Keine Spiele auf diesem Feld" -- ohne Toast, ohne Sentry-Meldung.
 *
 * Jetzt: `showError`-Toast + `captureFeatureError(error, 'tournament', 'ensureEngineMatchReady')`,
 * Anzeige "Spiel wird vorbereitet" statt "Keine Spiele auf diesem Feld".
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { LiveMatch } from '../../../core/models/LiveMatch';
import type { GeneratedSchedule } from '../../../core/generators';

const mockShowError = vi.fn();
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

const mockCaptureFeatureError = vi.fn();
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: () => <div data-testid="cockpit-stub" />,
}));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    members: [], isLoading: false, error: null,
    checkCanEditMatch: () => true, canEditResults: () => true,
  }),
}));

const rejectionError = new Error('Engine-Spiel match-1 ist noch nicht bereit.');
const mockGetLiveMatchData = vi.fn<() => Promise<LiveMatch>>().mockRejectedValue(rejectionError);
vi.mock('../../../hooks/useMatchExecution', () => ({
  useMatchExecution: () => ({
    liveMatches: new Map<string, LiveMatch>(),
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: mockGetLiveMatchData,
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish: vi.fn(),
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(), handleReopenMatch: vi.fn(),
    hasRunningMatch: () => undefined,
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

import { ManagementTab } from '../ManagementTab';

const MATCH_ID = 'match-1';
const HOME = { id: 'team-a', name: 'FC Alpha' };
const AWAY = { id: 'team-b', name: 'SV Beta' };

const tournament = {
  id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
} as unknown as Tournament;

const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' },
  teams: [HOME, AWAY],
  allMatches: [{
    id: MATCH_ID, matchNumber: 1, time: '10:00', field: 1, slot: 1,
    homeTeam: HOME.name, awayTeam: AWAY.name,
    originalTeamA: HOME.id, originalTeamB: AWAY.id,
    phase: 'groupStage', label: 'Gruppenphase', duration: 10,
  }],
  phases: [],
} as unknown as GeneratedSchedule;

describe('ManagementTab — P7: ensureEngineMatchReady-Fehler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLiveMatchData.mockRejectedValue(rejectionError);
  });

  it('zeigt einen showError-Toast und meldet den Fehler an Sentry (captureFeatureError)', async () => {
    render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
    );

    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(mockCaptureFeatureError).toHaveBeenCalledWith(rejectionError, 'tournament', 'ensureEngineMatchReady');
  });

  it('zeigt "Spiel wird vorbereitet" statt der irrefuehrenden "Keine Spiele auf diesem Feld"-Anzeige', async () => {
    render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
    );

    // i18n ist im Test global auf Passthrough gemockt (Namespace:Schluessel statt Uebersetzung,
    // s. `src/test/setup.ts`) -- der Schluessel selbst ist hier das beobachtbare Signal.
    await waitFor(() => expect(mockShowError).toHaveBeenCalled());
    expect(screen.queryByText('tournament:management.noMatchesOnField')).not.toBeInTheDocument();
    expect(screen.getByText('tournament:management.enginePreparing')).toBeInTheDocument();
  });
});
