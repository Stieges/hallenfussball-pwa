/**
 * ManagementTab — indirekte Schreibpfade ehren die Bearbeitungsberechtigung (Task R4, H3).
 *
 * final-review.md, Randnotiz unter M6 (gehört zu H3): "Beenden und wechseln"
 * (`handleMatchSelectionChange`, ~ManagementTab.tsx:295-310) rief `handleFinish(runningMatch.id)`
 * auf, unabhängig davon, ob der Nutzer das LAUFENDE Spiel bearbeiten darf. Geprüft wurde nur die
 * Berechtigung für das CockpIT-`currentMatch` (also ggf. das neu gewählte Spiel), nicht für das
 * Spiel, das dabei automatisch beendet wird.
 *
 * Derselbe Fehler steckte im initialMatchId-Effekt (~ManagementTab.tsx:109-128): `initialMatchId`
 * kommt über den URL-Query-Parameter `matchId` (TournamentManagementScreen.tsx) — ein ungeprüfter
 * Input. Ein Nutzer ohne Bearbeitungsrecht für das laufende Spiel, der per direktem Link einsteigt,
 * hätte es trotzdem automatisch beendet.
 *
 * Fix: In beiden Pfaden wird jetzt `checkCanEditMatch` für das LAUFENDE Spiel geprüft, bevor
 * `handleFinish` aufgerufen wird. Ohne Berechtigung: kein Dialog, kein `handleFinish`, nur der
 * Wechsel der Auswahl (bzw. Konsum des URL-Parameters).
 *
 * LiveCockpit wird hier bewusst durch einen Stub ersetzt (wie in
 * ManagementTab.eventIdentity.test.tsx) — dieser Test prüft die Verdrahtung in ManagementTab
 * selbst, nicht das Cockpit-Innenleben (das deckt LiveCockpit.readOnly.test.tsx ab).
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

vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: () => <div data-testid="cockpit-stub" />,
}));

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({
    play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(),
    isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null,
  }),
}));

// Mutable Rolle des angemeldeten Nutzers — echte canEditResults()-Logik (aus permissions.ts)
// entscheidet, ob checkCanEditMatch true/false liefert. owner/co-admin/collaborator: true.
// trainer/viewer: false (unabhängig von teamIds, siehe permissions.ts:74-86).
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

vi.mock('../../../hooks/useMatchExecution', () => ({
  useMatchExecution: () => ({
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
      phase: 'groupStage', label: 'Gruppenphase', duration: 10,
    },
    {
      id: MATCH_TARGET, matchNumber: 2, time: '10:15', field: 1, slot: 2,
      homeTeam: HOME.name, awayTeam: AWAY.name, originalTeamA: HOME.id, originalTeamB: AWAY.id,
      phase: 'groupStage', label: 'Gruppenphase', duration: 10,
    },
  ],
  phases: [],
} as unknown as GeneratedSchedule;

describe('ManagementTab — "Beenden und wechseln" prüft die Berechtigung für das LAUFENDE Spiel (Task R4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    handleFinish.mockResolvedValue(undefined);
    liveMatches.clear();
    liveMatches.set(MATCH_RUNNING, makeLiveMatch(MATCH_RUNNING, 1, 'RUNNING'));
    liveMatches.set(MATCH_TARGET, makeLiveMatch(MATCH_TARGET, 2, 'NOT_STARTED'));
  });

  it('ohne Berechtigung (viewer): kein Bestätigungsdialog, kein handleFinish — Auswahl wechselt trotzdem', async () => {
    currentRole = 'viewer';
    const user = userEvent.setup();
    render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, MATCH_TARGET);

    expect(screen.queryByTestId('confirm-dialog-confirm')).not.toBeInTheDocument();
    expect(handleFinish).not.toHaveBeenCalled();
    await waitFor(() => expect(select).toHaveValue(MATCH_TARGET));
  });

  it('mit Berechtigung (owner): Dialog erscheint, nach Bestätigen ruft es handleFinish für das laufende Spiel auf — wie bisher', async () => {
    currentRole = 'owner';
    const user = userEvent.setup();
    render(<ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()} />);

    const select = screen.getByRole('combobox');
    await user.selectOptions(select, MATCH_TARGET);

    const confirmButton = await screen.findByTestId('confirm-dialog-confirm');
    await user.click(confirmButton);

    expect(handleFinish).toHaveBeenCalledWith(MATCH_RUNNING);
    await waitFor(() => expect(select).toHaveValue(MATCH_TARGET));
  });
});

describe('ManagementTab — initialMatchId (URL-Parameter) prüft die Berechtigung für das laufende Spiel (Task R4)', () => {
  // Bildet den echten Verdrahtungspfad aus TournamentManagementScreen.tsx nach: `initialMatchId`
  // kommt aus useState(matchIdFromUrl), `onInitialMatchConsumed` löscht ihn wieder.
  function UrlEntryWrapper({ initialMatchId }: { initialMatchId: string }) {
    const [pending, setPending] = useState<string | null>(initialMatchId);
    return (
      <ManagementTab
        tournament={tournament}
        schedule={schedule}
        onTournamentUpdate={vi.fn()} onLocalTournamentUpdate={vi.fn()}
        initialMatchId={pending}
        onInitialMatchConsumed={() => setPending(null)}
      />
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    handleFinish.mockResolvedValue(undefined);
    liveMatches.clear();
    liveMatches.set(MATCH_RUNNING, makeLiveMatch(MATCH_RUNNING, 1, 'RUNNING'));
    liveMatches.set(MATCH_TARGET, makeLiveMatch(MATCH_TARGET, 2, 'NOT_STARTED'));
  });

  it('ohne Berechtigung (viewer) für das laufende Spiel: kein handleFinish, Auswahl wechselt trotzdem zum Ziel-Spiel', async () => {
    currentRole = 'viewer';
    render(<UrlEntryWrapper initialMatchId={MATCH_TARGET} />);

    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue(MATCH_TARGET));
    expect(handleFinish).not.toHaveBeenCalled();
  });

  it('mit Berechtigung (owner) für das laufende Spiel: handleFinish wird aufgerufen — Verhalten wie bisher', async () => {
    currentRole = 'owner';
    render(<UrlEntryWrapper initialMatchId={MATCH_TARGET} />);

    await waitFor(() => expect(handleFinish).toHaveBeenCalledWith(MATCH_RUNNING));
    const select = await screen.findByRole('combobox');
    await waitFor(() => expect(select).toHaveValue(MATCH_TARGET));
  });
});
