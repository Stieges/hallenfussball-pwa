/**
 * C-COCKPIT-MATCHID-BEENDET: Das Öffnen eines Spiels beendet nie ein anderes Spiel.
 *
 * Vorher rief der `initialMatchId`-Effekt (URL `?matchId=`) `handleFinish` für das erste laufende Spiel
 * des ganzen Turniers auf – ohne Rückfrage, über alle Felder, auch für Helfer. Ebenso beendete die
 * Spielauswahl im Cockpit ein laufendes Spiel („Spiel beenden & wechseln“). Eine Anforderung, beim
 * Öffnen oder Auswählen ein laufendes Spiel zu beenden, gibt es nicht: Der Spielwechsel (spiel-leiten,
 * Funktionalität D) beginnt nach dem Abpfiff; ein Abpfiff vor Ablauf fragt mit der Restzeit (@SL-010);
 * ein laufendes Spiel eines anderen Felds bleibt unberührt (Regel B1.4, „ein Gerät steuert jeweils ein Feld“).
 *
 * LiveCockpit ist ein Stub (wie in ManagementTab.readOnlyWritePaths.test.tsx), geprüft wird die
 * Verdrahtung in ManagementTab.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManagementTab } from '../ManagementTab';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import type { TournamentRole } from '../../auth/types/auth.types';
import { testTeamSlot } from '../../../test/matchSlotFixtures';

vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));
vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: () => <div data-testid="cockpit-stub" />,
}));
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));
vi.mock('../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: vi.fn(), showSuccess: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn() }),
}));

let currentRole: TournamentRole = 'collaborator';
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

// Spiel 11 läuft auf Feld 1 (Tom), Spiel 12 läuft auf Feld 2 (Clara), Spiel 13 folgt auf Feld 1.
const SPIEL_11 = 'spiel-11';
const SPIEL_12 = 'spiel-12';
const SPIEL_13 = 'spiel-13';
const NORD = { id: 'fc-nord', name: 'FC Nord' };
const SUED = { id: 'sv-sued', name: 'SV Süd' };
const WEST = { id: 'tsv-west', name: 'TSV West' };
const MITTE = { id: 'sg-mitte', name: 'SG Mitte' };

const handleFinish = vi.fn().mockResolvedValue(undefined);
const liveMatches = new Map<string, CoreLiveMatch>();

function live(id: string, number: number, fieldId: string, home: typeof NORD, away: typeof NORD, status: CoreLiveMatch['status']): CoreLiveMatch {
  return {
    id, number, phaseLabel: 'Gruppe A', fieldId, scheduledKickoff: '15:00', durationSeconds: 600, version: 1,
    homeTeam: home, awayTeam: away, homeScore: 1, awayScore: 0, status, elapsedSeconds: 168, events: [],
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
    // wie useCockpitExecution: das ERSTE laufende Spiel des ganzen Turniers, feldübergreifend
    hasRunningMatch: () => [...liveMatches.values()].find((m) => m.status === 'RUNNING'),
    handleStartOvertime: vi.fn(), handleStartGoldenGoal: vi.fn(), handleStartPenaltyShootout: vi.fn(),
    handleRecordPenaltyResult: vi.fn(), handleAbortPenaltyShootout: vi.fn(),
    handleUpdateEvent: vi.fn(), handleDeleteEvent: vi.fn(),
  }),
}));

const tournament = {
  id: 'tournament-1', title: 'Hallencup Süd', numberOfFields: 2, teams: [], matches: [],
} as unknown as Tournament;

function scheduled(id: string, matchNumber: number, field: number, time: string, home: typeof NORD, away: typeof NORD) {
  return {
    id, matchNumber, time, field, slot: matchNumber,
    homeTeam: home.name, awayTeam: away.name, originalTeamA: home.id, originalTeamB: away.id,
    slotA: testTeamSlot(home.id), slotB: testTeamSlot(away.id),
    phase: 'groupStage', label: 'Gruppe A', duration: 10,
  };
}

const schedule = {
  tournament: { id: 'tournament-1', title: 'Hallencup Süd' },
  teams: [NORD, SUED, WEST, MITTE],
  allMatches: [
    scheduled(SPIEL_11, 11, 1, '15:00', NORD, SUED),
    scheduled(SPIEL_12, 12, 2, '15:00', WEST, MITTE),
    scheduled(SPIEL_13, 13, 1, '15:15', WEST, MITTE),
  ],
  phases: [],
} as unknown as GeneratedSchedule;

/** Wie TournamentManagementScreen: `initialMatchId` aus `?matchId=`, nach dem Verbrauch gelöscht. */
function UrlEntry({ matchId }: { matchId: string }) {
  const [pending, setPending] = useState<string | null>(matchId);
  return (
    <ManagementTab
      tournament={tournament}
      schedule={schedule}
      onTournamentUpdate={vi.fn()}
      onLocalTournamentUpdate={vi.fn()}
      initialMatchId={pending}
      onInitialMatchConsumed={() => setPending(null)}
    />
  );
}

describe('ManagementTab: Öffnen eines Spiels beendet kein anderes Spiel (C-MATCHID-BEENDET-ANDERES-SPIEL)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleFinish.mockResolvedValue(undefined);
    liveMatches.clear();
    liveMatches.set(SPIEL_11, live(SPIEL_11, 11, 'field-1', NORD, SUED, 'RUNNING'));
    liveMatches.set(SPIEL_12, live(SPIEL_12, 12, 'field-2', WEST, MITTE, 'RUNNING'));
    liveMatches.set(SPIEL_13, live(SPIEL_13, 13, 'field-1', WEST, MITTE, 'NOT_STARTED'));
  });

  for (const role of ['collaborator', 'owner'] as const) {
    it(`@SL-010: Spiele 11 (Feld 1) und 12 (Feld 2) laufen, Cockpit von Spiel 12 per ?matchId= öffnen (${role}) → Spiel 11 läuft weiter`, async () => {
      currentRole = role;
      render(<UrlEntry matchId={SPIEL_12} />);

      const select = await screen.findByRole('combobox');
      await waitFor(() => expect(select).toHaveValue(SPIEL_12));
      expect(handleFinish).not.toHaveBeenCalled();
      expect(screen.queryByTestId('confirm-dialog-confirm')).not.toBeInTheDocument();
    });
  }

  it('@SL-010: Spiel 11 läuft auf Feld 1, Cockpit von Spiel 13 (Feld 1) per ?matchId= öffnen → Spiel 11 läuft weiter, kein stilles Beenden', async () => {
    currentRole = 'collaborator';
    render(<UrlEntry matchId={SPIEL_13} />);

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue(SPIEL_13));
    expect(handleFinish).not.toHaveBeenCalled();
  });

  it('@SL-010: Spiel 11 läuft, Tom wählt im Cockpit Spiel 13 aus → Spiel 11 wird nicht beendet, es gibt keinen Beenden-Dialog', async () => {
    currentRole = 'collaborator';
    const user = userEvent.setup();
    render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, SPIEL_13);

    await waitFor(() => expect(select).toHaveValue(SPIEL_13));
    expect(screen.queryByTestId('confirm-dialog-confirm')).not.toBeInTheDocument();
    expect(handleFinish).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: das geöffnete Spiel steht im Cockpit – Feld 2 mit Spiel 12 ist gewählt', async () => {
    currentRole = 'collaborator';
    render(<UrlEntry matchId={SPIEL_12} />);

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue(SPIEL_12));
    expect(screen.getByTestId('cockpit-stub')).toBeInTheDocument();
  });
});
