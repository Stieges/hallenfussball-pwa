/**
 * ManagementTab → LiveCockpit: Ereignis-Payload-Normalisierung an der Prop-Grenze.
 *
 * Der MatchExecutionService schreibt `{ team: 'home'|'away', delta, durationSeconds }`.
 * Das Cockpit liest `{ teamId, teamName, direction, penaltyDuration }`. Vor dieser
 * Normalisierung war jedes gelesene Feld `undefined`, mit vier sichtbaren Folgen:
 * Foulzähler nach Reload 0, jede Log-Zeile nannte das Gastteam, jede Zeitstrafe
 * las sich als "2 Min", und der Kopf des Bearbeiten-Dialogs nannte "Team".
 *
 * Diese Tests rendern den echten Verdrahtungspfad (ManagementTab → LiveCockpit),
 * nicht nur die reine Funktion — sie fallen also auch, wenn das `useMemo` in
 * ManagementTab entfällt oder die Prop wieder am Cockpit vorbeigeführt wird.
 *
 * i18n: Der Test-Mock (src/test/setup.ts) gibt Keys als Text zurück. Assertions
 * hängen deshalb an Stellen, die Teamnamen literal rendern (Sidebar-Korrektur-
 * zeile `−1 <Team>`, Dialog-Untertitel), nicht an übersetzten Sätzen.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManagementTab } from '../ManagementTab';
import type { Tournament } from '../../../types/tournament';
import type { GeneratedSchedule } from '../../../core/generators';
import type { LiveMatch as CoreLiveMatch, MatchEvent as CoreMatchEvent } from '../../../core/models/LiveMatch';

// Kein Ton im jsdom (IndexedDB/AudioContext).
vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

// Keine Mitgliedschafts-Abfrage (Supabase) — ohne Membership erlaubt ManagementTab die Bearbeitung.
vi.mock('../../auth/hooks/useTournamentMembers', () => ({
  useTournamentMembers: () => ({ myMembership: null, members: [], isLoading: false, error: null }),
}));

// A4 (C-SYNC): SyncStatusIndicator (neu im Cockpit-Kopf) braucht RepositoryContext via
// useSyncStatus/useRepositories -- dieser Test rendert ManagementTab (und damit LiveCockpit) ohne
// Provider. isCloudSyncAvailable:false spiegelt genau den fehlenden Cloud-Kontext hier wider.
vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

// Spiel-Zustand kommt als Map direkt aus dem Hook — so wie ihn der Service liefert:
// Draht-Format im payload, kein einziges UI-Feld.
const liveMatches = new Map<string, CoreLiveMatch>();

vi.mock('../../../hooks/useMatchExecution', () => ({
  useMatchExecution: () => ({
    liveMatches,
    loadingStates: { goal: false, card: false, finish: false, undo: false, start: false },
    isAnyLoading: false,
    getLiveMatchData: vi.fn(),
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

const MATCH_ID = 'match-1';
const HOME = { id: 'team-a', name: 'FC Alpha' };
const AWAY = { id: 'team-b', name: 'SV Beta' };

function wireEvent(id: string, type: CoreMatchEvent['type'], payload: CoreMatchEvent['payload']): CoreMatchEvent {
  return {
    id,
    matchId: MATCH_ID,
    timestampSeconds: 30,
    type,
    payload,
    scoreAfter: { home: 0, away: 0 },
  };
}

function setLiveMatch(events: CoreMatchEvent[]): void {
  liveMatches.clear();
  liveMatches.set(MATCH_ID, {
    id: MATCH_ID,
    number: 1,
    phaseLabel: 'Gruppenphase',
    fieldId: 'field-1',
    scheduledKickoff: '10:00',
    durationSeconds: 600,
    version: 1,
    homeTeam: HOME,
    awayTeam: AWAY,
    homeScore: 0,
    awayScore: 0,
    status: 'PAUSED',
    elapsedSeconds: 30,
    events,
  });
}

const tournament = {
  id: 'tournament-1',
  title: 'Test-Turnier',
  numberOfFields: 1,
  teams: [],
  matches: [],
} as unknown as Tournament;

const schedule = {
  tournament: { id: 'tournament-1', title: 'Test-Turnier' },
  teams: [HOME, AWAY],
  allMatches: [
    {
      id: MATCH_ID,
      matchNumber: 1,
      time: '10:00',
      field: 1,
      slot: 1,
      homeTeam: HOME.name,
      awayTeam: AWAY.name,
      originalTeamA: HOME.id,
      originalTeamB: AWAY.id,
      phase: 'groupStage',
      label: 'Gruppenphase',
      duration: 10,
    },
  ],
  phases: [],
} as unknown as GeneratedSchedule;

function renderTab(): void {
  render(
    <ManagementTab
      tournament={tournament}
      schedule={schedule}
      onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()}
    />
  );
}

describe('ManagementTab → LiveCockpit: Ereignis-Payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatches.clear();
  });

  it('Foulzähler liest die Mannschaftsseite aus dem Draht-Payload (nach Reload nicht mehr 0)', () => {
    setLiveMatch([
      wireEvent('f1', 'FOUL', { team: 'home' }),
      wireEvent('f2', 'FOUL', { team: 'home' }),
      wireEvent('f3', 'FOUL', { team: 'away' }),
    ]);

    renderTab();

    expect(screen.getByTestId('foul-count-home')).toHaveTextContent('2');
    expect(screen.getByTestId('foul-count-away')).toHaveTextContent('1');
  });

  it('Ereignis-Log nennt beide Mannschaften richtig — nicht zweimal den Gast', () => {
    // Korrektur-Tore (delta: -1) rendert die Sidebar literal als "−1 <Teamname>",
    // ohne i18n-Interpolation — damit ist der Name direkt prüfbar.
    setLiveMatch([
      wireEvent('g1', 'GOAL', { team: 'home', delta: -1 }),
      wireEvent('g2', 'GOAL', { team: 'away', delta: -1 }),
    ]);

    renderTab();

    expect(screen.getByText(/−1 FC Alpha/)).toBeInTheDocument();
    expect(screen.getByText(/−1 SV Beta/)).toBeInTheDocument();
  });

  it('Kopf des Bearbeiten-Dialogs nennt die Mannschaft des Ereignisses, nicht "Team"', async () => {
    setLiveMatch([wireEvent('g1', 'GOAL', { team: 'home', delta: 1, playerNumber: 9 })]);
    const user = userEvent.setup();

    renderTab();
    await user.click(screen.getByTitle('cockpit:sidebar.edit'));

    expect(screen.getByText('FC Alpha · 00:30')).toBeInTheDocument();
  });
});
