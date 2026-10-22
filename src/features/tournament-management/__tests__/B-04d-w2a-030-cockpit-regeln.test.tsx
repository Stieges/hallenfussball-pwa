/**
 * B-04 Fixrunde 1 – @W2A-030: Nur die Turnierleitung ändert Regeln (Cockpit-Einstellungen).
 *
 * Gegeben ein Helfer ist im Turnier angemeldet
 * Wenn er eine Regel ändern will
 * Dann bietet die App das nicht an
 *
 * Pflichttest mit ECHTEM ManagementTab und ECHTEM LiveCockpit (kein Stub): Einstellungen
 * öffnen, Regelfelder (Zeitstrafe, Schützenzahl) sind für den Helfer gesperrt. Die
 * Speicherstrecke (handleUpdateSettings) übernimmt keine geänderte Regel. Turnierleitung
 * und Co-Admin sind frei. Ein Nicht-Regel-Schalter bleibt für den Helfer bedienbar.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManagementTab } from '../ManagementTab';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type MatchCockpitSettings, type Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import type { TournamentRole } from '../../auth/types/auth.types';
import { testTeamSlot } from '../../../test/matchSlotFixtures';

import { RouterWrapper } from './routerWrapper';
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

// Merge Spur A/B: ManagementTab meldet seit C3a-2a P7 Fehler ueber den App-weiten useToast (wirft ohne
// ToastProvider); hier nicht Gegenstand. LiveCockpit nutzt seinen eigenen Toast-Hook.
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

// Mutable Rolle des angemeldeten Nutzers; useEffectiveTournamentRole/canManageTournament
// entscheiden echt über die Rechte.
let currentRole: TournamentRole = 'owner';
vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({
    myMembership: {
      id: 'membership-1', userId: 'user-1', tournamentId: 'tournament-1',
      role: currentRole, teamIds: [], createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    },
    members: [], isLoading: false, error: null,
  }),
}));

const MATCH_RUNNING = 'match-1';
const HOME = { id: 'team-a', name: 'FC Alpha' };
const AWAY = { id: 'team-b', name: 'SV Beta' };
const liveMatches = new Map<string, CoreLiveMatch>();

vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches,
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: vi.fn(),
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish: vi.fn(),
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(), handleReopenMatch: vi.fn(),
    hasRunningMatch: () => liveMatches.get(MATCH_RUNNING),
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

type OnTournamentUpdate = (tournament: Tournament, regenerateSchedule?: boolean) => void;

function makeTournament(): Tournament {
  return {
    id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
    matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, timePenaltyDurationSeconds: 120, penaltyShootersPerTeam: 5 },
  } as unknown as Tournament;
}

const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' },
  teams: [HOME, AWAY],
  allMatches: [
    {
      id: MATCH_RUNNING, matchNumber: 1, time: '10:00', field: 1, slot: 1,
      homeTeam: HOME.name, awayTeam: AWAY.name, originalTeamA: HOME.id, originalTeamB: AWAY.id,
      // Merge Spur A/B: Spielseiten kommen seit A-04a/A-04b aus den Slots.
      slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
      phase: 'groupStage', label: 'Gruppenphase', duration: 10,
    },
  ],
  phases: [],
} as unknown as GeneratedSchedule;

function renderTab(onTournamentUpdate: ReturnType<typeof vi.fn<OnTournamentUpdate>>) {
  return render(
    <ManagementTab
      tournament={makeTournament()}
      schedule={schedule}
      onTournamentUpdate={onTournamentUpdate}
      onLocalTournamentUpdate={vi.fn()}
    />, { wrapper: RouterWrapper }
  );
}

async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId('cockpit-more-button'));
  await user.click(screen.getByTestId('mehr-einstellungen'));
}

/** Jeder Aufruf der Speicherstrecke muss die Regeln unverändert lassen (Speicherschutz). */
function expectNoRuleChangeSaved(onTournamentUpdate: ReturnType<typeof vi.fn<OnTournamentUpdate>>, zeitstrafe: number, schuetzen: number) {
  for (const call of onTournamentUpdate.mock.calls) {
    const saved: MatchCockpitSettings = call[0].matchCockpitSettings!;
    expect(saved.timePenaltyDurationSeconds).toBe(zeitstrafe);
    expect(saved.penaltyShootersPerTeam).toBe(schuetzen);
  }
}

describe('B-04 Fixrunde 1 @W2A-030 – Cockpit-Regeln nur für die Turnierleitung', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatches.clear();
    liveMatches.set(MATCH_RUNNING, {
      id: MATCH_RUNNING, number: 1, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
      scheduledKickoff: '10:00', durationSeconds: 600, version: 1,
      homeTeam: HOME, awayTeam: AWAY, homeScore: 0, awayScore: 0,
      status: 'RUNNING', elapsedSeconds: 0, events: [],
    } as unknown as CoreLiveMatch);
  });

  it('Pflichttest: Helfer (collaborator) sieht die Regelfelder gesperrt, Speichern übernimmt keine Regeländerung', async () => {
    currentRole = 'collaborator';
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn<OnTournamentUpdate>();
    renderTab(onTournamentUpdate);

    await openSettings(user);

    const zeitstrafe = screen.getByTestId('settings-time-penalty-duration');
    const schuetzen = screen.getByTestId('settings-penalty-shooters');
    expect(zeitstrafe).toBeDisabled();
    expect(schuetzen).toBeDisabled();

    fireEvent.change(zeitstrafe, { target: { value: '60' } });
    fireEvent.change(schuetzen, { target: { value: '3' } });
    expectNoRuleChangeSaved(onTournamentUpdate, 120, 5);
  });

  it('Pflichttest: Helfer kann einen Nicht-Regel-Schalter (Vibration) weiter bedienen', async () => {
    currentRole = 'collaborator';
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn<OnTournamentUpdate>();
    renderTab(onTournamentUpdate);

    await openSettings(user);

    const vibration = screen.getByRole('switch', { name: /vibration/i });
    expect(vibration).not.toBeDisabled();
  });

  it('Gegenbeispiel: Turnierleitung (owner) kann die Zeitstrafe ändern, Speichern übernimmt sie', async () => {
    currentRole = 'owner';
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn<OnTournamentUpdate>();
    renderTab(onTournamentUpdate);

    await openSettings(user);

    const zeitstrafe = screen.getByTestId('settings-time-penalty-duration');
    expect(zeitstrafe).not.toBeDisabled();
    fireEvent.change(zeitstrafe, { target: { value: '60' } });

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ timePenaltyDurationSeconds: 60 }),
      }),
    );
  });

  it('Gegenbeispiel: Co-Admin kann die Schützenzahl ändern, Speichern übernimmt sie', async () => {
    currentRole = 'co-admin';
    const user = userEvent.setup();
    const onTournamentUpdate = vi.fn<OnTournamentUpdate>();
    renderTab(onTournamentUpdate);

    await openSettings(user);

    const schuetzen = screen.getByTestId('settings-penalty-shooters');
    expect(schuetzen).not.toBeDisabled();
    fireEvent.change(schuetzen, { target: { value: '3' } });
    fireEvent.blur(schuetzen);

    expect(onTournamentUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        matchCockpitSettings: expect.objectContaining({ penaltyShootersPerTeam: 3 }),
      }),
    );
  });
});
