/**
 * ManagementTab – @FU-004 (C-COCKPIT-LAEDT-NACH-ABPFIFF): Ist das Laden eines Spiels noch offen
 * (z. B. weil der Wechsel des Felds es abgebrochen hat) und hat danach jedes Spiel des Felds ein
 * Ergebnis, bleibt „Spiel wird geladen…“ nicht stehen, sondern die Tafel sagt „kein Spiel mehr“ (@SL-054).
 *
 * Der Kopf (Mocks, HOME/AWAY, tournament, schedule) stammt aus ManagementTab.engineReadyError.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { LiveMatch } from '../../../core/models/LiveMatch';
import type { GeneratedSchedule } from '../../../core/generators';

const mockShowError = vi.fn();
// C3b-1: LiveCockpit bindet useEngineEventEditing ein -> useActorRole (braucht AuthProvider); hier nicht Gegenstand.
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: mockShowError, showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

// Merge Spur A/B: ManagementTab loest seit B-04 Fixrunde 1 (@W2A-030) die Spielregel-Rolle ueber
// useEffectiveTournamentRole auf; das braucht useAuth. Hier nicht Gegenstand.
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

const mockCaptureFeatureError = vi.fn();
vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: (...args: unknown[]) => mockCaptureFeatureError(...args),
}));

vi.mock('../../../components/live-cockpit', () => ({
  // ohne Spiel zeigt die Tafel den Grund (@SL-054): der Stub legt die Art offen
  LiveCockpit: (props: { leer?: { art: string } | null }) => <div data-testid="cockpit-stub" data-leer={props.leer?.art ?? ''} />,
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

const mockGetLiveMatchData = vi.fn<() => Promise<LiveMatch>>();
// Minor 2 (Fixrunde 4): mutable ueber den Testverlauf -- der Reset-Test simuliert einen
// Feld-/Spielwechsel auf ein Spiel, das BEREITS eine Engine-Kopie hat (kein erneuter
// getLiveMatchData-Aufruf noetig).
let mockLiveMatches = new Map<string, LiveMatch>();
vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
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
import { testTeamSlot } from '../../../test/matchSlotFixtures';

import { RouterWrapper } from './routerWrapper';
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
    slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
    phase: 'groupStage', label: 'Gruppenphase', duration: 10,
  }],
  phases: [],
} as unknown as GeneratedSchedule;

describe('ManagementTab – @FU-004 kein dauerhaftes „Spiel wird geladen…“ (C-COCKPIT-LAEDT-NACH-ABPFIFF)', () => {
  // Texte über den globalen Passthrough-Mock: Schlüssel mit Namensraum.
  const LADEN = 'tournament:management.matchLoading';
  const mitErgebnis = {
    ...schedule,
    allMatches: schedule.allMatches.map((m) => ({ ...m, scoreA: 2, scoreB: 1 })),
  } as unknown as GeneratedSchedule;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLiveMatches = new Map<string, LiveMatch>();
  });

  it('@FU-004 hängt das Laden und hat danach jedes Spiel des Felds ein Ergebnis, sagt die Tafel „kein Spiel mehr“ statt „wird geladen“', async () => {
    mockGetLiveMatchData.mockReturnValue(new Promise(() => undefined)); // erster Lauf hängt, wird abgebrochen
    const { rerender } = render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />, { wrapper: RouterWrapper }
    );
    expect(await screen.findByText(LADEN)).toBeInTheDocument();
    rerender(
      <ManagementTab tournament={{ ...tournament }} schedule={mitErgebnis} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />,
    );
    await waitFor(() => expect(screen.queryByText(LADEN)).toBeNull());
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-leer', 'keinSpiel');
  });

  it('Gegenbeispiel: solange das Spiel ohne Ergebnis noch lädt, steht der Ladehinweis', async () => {
    mockGetLiveMatchData.mockReturnValue(new Promise(() => undefined));
    render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />, { wrapper: RouterWrapper }
    );
    expect(await screen.findByText(LADEN)).toBeInTheDocument();
  });
});
