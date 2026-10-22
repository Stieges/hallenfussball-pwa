/**
 * B-49: Verdrahtung der Steuer je Feld im Cockpit (ManagementTab -> LiveCockpit): `kannSteuern` aus Recht UND Steuer,
 * `steuerung` (Nur-Lesen-Zeile mit Halter, „Spielleitung übernehmen“ nur für die Turnierleitung).
 * Der Stand je Feld kommt gemockt aus `useFieldControl` (Server-Abbild: useCockpitFieldControl.test.tsx).
 * Werte aus dem Gherkin: Toms Handy steuert Feld 1 (@FU-026, @SL-046), Olli Turnierleitung, Tom/Clara Helfer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ManagementTab } from '../ManagementTab';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch } from '../../../core/models/LiveMatch';
import type { TournamentRole } from '../../auth/types/auth.types';
import { testTeamSlot } from '../../../test/matchSlotFixtures';

import { RouterWrapper } from './routerWrapper';
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: ({ kannSteuern, steuerung }: { kannSteuern?: boolean; steuerung?: { leitetName: string | null; onUebernehmen?: () => void } | null }) => (
    <div data-testid="cockpit-stub" data-readonly={String(kannSteuern !== true)} data-leitet={steuerung?.leitetName ?? ''} data-uebernehmen={String(Boolean(steuerung?.onUebernehmen))} />
  ),
}));

// Stand der Steuer je Feld aus Sicht dieses Geräts (field_control_state)
const steuer = vi.hoisted(() => ({ list: null as unknown[] | null }));
vi.mock('../../match-engine/useFieldControl', () => ({
  useFieldControl: () => ({ list: steuer.list, active: true, deviceId: 'geraet', refresh: vi.fn(), takeOver: vi.fn() }),
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

const TOM_HANDY = { field: 1, epoch: 1, holderName: 'Tom', holderRole: 'helper', holderDeviceLabel: 'Handy', isMine: false, claimedAt: 1 };

function renderTab() {
  render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />, { wrapper: RouterWrapper });
  return screen.getByTestId('cockpit-stub');
}

describe('B-49 Cockpit: Steuer je Feld (Verdrahtung)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatches.clear();
    liveMatches.set(MATCH_RUNNING, makeLiveMatch(MATCH_RUNNING, 1, 'RUNNING'));
    liveMatches.set(MATCH_TARGET, makeLiveMatch(MATCH_TARGET, 2, 'NOT_STARTED'));
    steuer.list = null;
  });

  it('@FU-026 @SL-046 Toms Handy steuert Feld 1: Olli (Turnierleitung) bekommt das Cockpit nur zum Lesen, mit Halter und „Spielleitung übernehmen“', () => {
    currentRole = 'owner';
    steuer.list = [TOM_HANDY];
    const cockpit = renderTab();
    expect(cockpit).toHaveAttribute('data-readonly', 'true');
    expect(cockpit).toHaveAttribute('data-leitet', 'Tom (Handy)');
    expect(cockpit).toHaveAttribute('data-uebernehmen', 'true');
  });

  it('@FU-120 Helfer Tom, auf Feld 1 läuft kein Spiel: nur lesend, mit „Spielleitung übernehmen“', () => {
    currentRole = 'collaborator';
    steuer.list = [TOM_HANDY];
    liveMatches.set(MATCH_RUNNING, makeLiveMatch(MATCH_RUNNING, 1, 'FINISHED'));
    const cockpit = renderTab();
    expect(cockpit).toHaveAttribute('data-readonly', 'true');
    expect(cockpit).toHaveAttribute('data-uebernehmen', 'true');
  });

  it('@FU-120 Gegenbeispiel: läuft irgendein Spiel des Felds (pausiert), bekommt der Helfer keine Übernahme', () => {
    currentRole = 'collaborator';
    steuer.list = [TOM_HANDY];
    liveMatches.set(MATCH_RUNNING, makeLiveMatch(MATCH_RUNNING, 1, 'FINISHED'));
    liveMatches.set(MATCH_TARGET, makeLiveMatch(MATCH_TARGET, 2, 'PAUSED'));
    expect(renderTab()).toHaveAttribute('data-uebernehmen', 'false');
  });

  it('@FU-026 @FU-120 Helferin Clara bei laufendem Spiel: nur lesend, ohne „Spielleitung übernehmen“', () => {
    currentRole = 'collaborator';
    steuer.list = [TOM_HANDY];
    const cockpit = renderTab();
    expect(cockpit).toHaveAttribute('data-readonly', 'true');
    expect(cockpit).toHaveAttribute('data-uebernehmen', 'false');
  });

  it.each([
    ['dieses Gerät steuert Feld 1', [{ ...TOM_HANDY, isMine: true }]],
    ['Feld 1 ist frei (nur Feld 2 gesteuert)', [{ ...TOM_HANDY, field: 2 }]],
    ['Stand unbekannt (Gast, ohne Netz seit dem Öffnen)', null],
  ])('@FU-026 Gegenbeispiel: %s → Tom leitet, das Cockpit ist nicht schreibgeschützt', (_fall, list) => {
    currentRole = 'collaborator';
    steuer.list = list;
    const cockpit = renderTab();
    expect(cockpit).toHaveAttribute('data-readonly', 'false');
    expect(cockpit).toHaveAttribute('data-leitet', '');
  });

  it('Gegenbeispiel Recht: Trainer bleibt auch auf freiem Feld nur lesend (writeMatchData fehlt)', () => {
    currentRole = 'trainer';
    steuer.list = [];
    expect(renderTab()).toHaveAttribute('data-readonly', 'true');
  });
});
