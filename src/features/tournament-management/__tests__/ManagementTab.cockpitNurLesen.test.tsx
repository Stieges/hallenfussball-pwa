/**
 * Review A-11 A3: die Verdrahtung `readOnly={!canPlay}` (ManagementTab -> LiveCockpit, canPlay = useCan('writeMatchData')).
 *
 * Ein Konto ohne `writeMatchData` (Trainer, Zuschauer) bekommt ein Cockpit nur zum Lesen. Gegenbeispiel @HE-042
 * („ein Spiel anpfeifen → gelingt“): Tom (Helfer) und die Turnierleitung leiten -- das Cockpit ist nicht schreibgeschützt.
 * A-11 hat das Verhalten geändert (vorher „ohne Mitgliedszeile erlaubt“); das Cockpit-Innenleben bei `readOnly` deckt
 * LiveCockpit.readOnly.test.tsx ab, hier nur die Verdrahtung.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManagementTab } from '../ManagementTab';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import type { TournamentRole } from '../../auth/types/auth.types';
import { testTeamSlot } from '../../../test/matchSlotFixtures';

vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: ({ readOnly }: { readOnly?: boolean }) => (
    <div data-testid="cockpit-stub" data-readonly={String(readOnly === true)} />
  ),
}));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

// P7 (Fixrunde 3): ManagementTab braucht jetzt den App-weiten `useToast` (Fehler-Toast bei einem
// gescheiterten `getLiveMatchData`) -- der wirft ohne `<ToastProvider>`-Vorfahren.
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

// Rolle des angemeldeten Kontos; die echte Kette useCan -> useMyTournamentRole -> hasPermission (JSON) entscheidet.
let currentRole: TournamentRole = 'owner';
vi.mock('../../auth/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true, user: { id: 'user-1' } }),
}));

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
const MATCH_TARGET = 'match-2';
const HOME = { id: 'team-a', name: 'FC Alpha' };
const AWAY = { id: 'team-b', name: 'SV Beta' };

const handleFinish = vi.fn().mockResolvedValue(undefined);
const liveMatches = new Map<string, CoreLiveMatch>();

function makeLiveMatch(id: string, number: number, status: CoreLiveMatch['status']): CoreLiveMatch {
  return {
    id, number, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: '10:00', durationSeconds: 600, version: 1,
    homeTeam: HOME, awayTeam: AWAY, homeScore: 0, awayScore: 0,
    status, elapsedSeconds: 0, events: [],
  };
}

vi.mock('../../../hooks/useCockpitExecution', () => ({
  useCockpitExecution: () => ({
    liveMatches,
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: vi.fn(),
    handleStart: vi.fn(), handlePause: vi.fn(), handleResume: vi.fn(), handleFinish,
    handleForceFinish: vi.fn(), handleGoal: vi.fn(), handleTimePenalty: vi.fn(), handleCard: vi.fn(),
    handleSubstitution: vi.fn(), handleFoul: vi.fn(), handleUndoLastEvent: vi.fn(),
    handleManualEditResult: vi.fn(), handleAdjustTime: vi.fn(), handleReopenMatch: vi.fn(),
    hasRunningMatch: () => liveMatches.get(MATCH_RUNNING),
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

const tournament = {
  id: 'tournament-1', title: 'Test-Turnier', numberOfFields: 1, teams: [], matches: [],
} as unknown as Tournament;

const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' },
  teams: [HOME, AWAY],
  allMatches: [
    {
      id: MATCH_RUNNING, matchNumber: 1, time: '10:00', field: 1, slot: 1,
      homeTeam: HOME.name, awayTeam: AWAY.name, originalTeamA: HOME.id, originalTeamB: AWAY.id,
    slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
      phase: 'groupStage', label: 'Gruppenphase', duration: 10,
    },
    {
      id: MATCH_TARGET, matchNumber: 2, time: '10:15', field: 1, slot: 2,
      homeTeam: HOME.name, awayTeam: AWAY.name, originalTeamA: HOME.id, originalTeamB: AWAY.id,
    slotA: testTeamSlot(HOME.id), slotB: testTeamSlot(AWAY.id),
      phase: 'groupStage', label: 'Gruppenphase', duration: 10,
    },
  ],
  phases: [],
} as unknown as GeneratedSchedule;

describe('Review A-11 A3: Cockpit nur zum Lesen ohne Recht auf den Spielbetrieb (writeMatchData)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleFinish.mockResolvedValue(undefined);
    liveMatches.clear();
    liveMatches.set(MATCH_RUNNING, makeLiveMatch(MATCH_RUNNING, 1, 'NOT_STARTED'));
    liveMatches.set(MATCH_TARGET, makeLiveMatch(MATCH_TARGET, 2, 'NOT_STARTED'));
  });

  it.each<TournamentRole>(['trainer', 'viewer'])('Konto %s (kein writeMatchData): das Cockpit ist nur zum Lesen', (role) => {
    currentRole = role;
    render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
    expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-readonly', 'true');
  });

  it.each<TournamentRole>(['collaborator', 'co-admin', 'owner'])(
    'Gegenbeispiel @HE-042 %s (Tom/Maria/Olli): „ein Spiel anpfeifen“ – das Cockpit ist nicht schreibgeschützt',
    (role) => {
      currentRole = role;
      render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);
      expect(screen.getByTestId('cockpit-stub')).toHaveAttribute('data-readonly', 'false');
    },
  );
});
