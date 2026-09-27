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
import { render, screen, waitFor, act } from '@testing-library/react';
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
// Minor 2 (Fixrunde 4): mutable ueber den Testverlauf -- der Reset-Test simuliert einen
// Feld-/Spielwechsel auf ein Spiel, das BEREITS eine Engine-Kopie hat (kein erneuter
// getLiveMatchData-Aufruf noetig).
let mockLiveMatches = new Map<string, LiveMatch>();
vi.mock('../../../hooks/useMatchExecution', () => ({
  useMatchExecution: () => ({
    liveMatches: mockLiveMatches,
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
    mockLiveMatches = new Map<string, LiveMatch>();
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

  // Minor 2 (Fixrunde 4): `engineReadyError` wurde bisher NUR im Init-Zweig zurueckgesetzt -- ein
  // Wechsel auf ein LEERES Feld (kein `currentMatchData`, der Effekt nimmt den fruehen
  // `!currentMatchData`-Ausstieg VOR dem Reset) zeigte "Spiel wird vorbereitet" weiter an, obwohl
  // gar kein Spiel mehr existiert (sollte "Keine Spiele auf diesem Feld" zeigen).
  it('Minor 2: engineReadyError wird zurueckgesetzt, sobald das Feld leer ist (kein currentMatchData)', async () => {
    const { rerender } = render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('tournament:management.enginePreparing')).toBeInTheDocument());

    // Wechsel: dasselbe Feld hat jetzt KEIN Spiel mehr (`currentMatchData` wird `undefined`).
    const emptySchedule = { ...schedule, allMatches: [] } as unknown as GeneratedSchedule;

    await act(async () => {
      rerender(
        <ManagementTab tournament={tournament} schedule={emptySchedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
      );
    });

    expect(screen.queryByText('tournament:management.enginePreparing')).not.toBeInTheDocument();
    expect(screen.getByText('tournament:management.noMatchesOnField')).toBeInTheDocument();
  });

  // Minor 4 (Fixrunde 4): "Spiel wird vorbereitet" bekommt einen "Erneut versuchen"-Knopf --
  // vorher blieb der Zustand bestehen, bis sich eine Abhaengigkeit AUTOMATISCH aendert.
  it('Minor 4: "Spiel wird vorbereitet" zeigt einen Erneut-versuchen-Knopf, ein Klick ruft getLiveMatchData erneut auf', async () => {
    render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />
    );
    await waitFor(() => expect(screen.getByText('tournament:management.enginePreparing')).toBeInTheDocument());
    expect(mockGetLiveMatchData).toHaveBeenCalledTimes(1);

    const retryButton = screen.getByTestId('engine-ready-retry');
    // common:actions.retry (i18n) -- nicht hart kodiert.
    expect(retryButton).toHaveTextContent('common:actions.retry');

    await act(async () => {
      retryButton.click();
    });

    await waitFor(() => expect(mockGetLiveMatchData).toHaveBeenCalledTimes(2));
  });
});
