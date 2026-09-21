/**
 * ManagementTab → LiveCockpit: Identität des normalisierten Ereignis-Arrays
 *
 * Regression aus PR #187. Die Normalisierung der Ereignisse (Draht-Format `payload.team` →
 * UI-Format `payload.teamId`) lag zunächst im selben `useMemo` wie das Match-Objekt. Damit
 * entstand bei JEDER Änderung am Match — auch einer reinen Uhr- oder Statusänderung — ein
 * frisch gemapptes Array.
 *
 * Das Cockpit führt `currentMatch?.events` in der Abhängigkeitsliste seines Reset-Effekts
 * (LiveCockpit.tsx, "C-2 FIX"), der alle Dialoge schließt und `pendingGoalSide` löscht.
 * Folge: Der Torschützen-Dialog verlor mitten im 10-Sekunden-Auto-Dismiss seinen Zustand,
 * `handleGoalConfirm` stieg wegen `!pendingGoalSide` wirkungslos aus — das Tor wurde nie
 * gebucht und der Spielstand blieb auf 0. Sichtbar wurde das nur im E2E-Test
 * `live-cockpit.spec.ts` ("GoalScorerDialog auto-dismisses after timeout"), auf allen vier
 * Viewports.
 *
 * Dieser Test hält die Ursache fest, nicht das Symptom: Solange sich die Ereignisse selbst
 * nicht ändern, muss das normalisierte Array seine Identität behalten.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import type { LiveMatch, MatchEvent as CoreMatchEvent } from '../../../core/models/LiveMatch';
import type { GeneratedSchedule } from '../../../core/generators';

const liveMatches = new Map<string, LiveMatch>();

/** Jede Übergabe an das Cockpit wird mitgeschrieben, damit Identitäten vergleichbar sind. */
const seenEventArrays: unknown[] = [];

vi.mock('../../../components/live-cockpit', () => ({
  LiveCockpit: (props: { currentMatch?: { events?: unknown } | null }) => {
    seenEventArrays.push(props.currentMatch?.events);
    return <div data-testid="cockpit-stub" />;
  },
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

vi.mock('../../../hooks/useMatchExecution', () => ({
  useMatchExecution: () => ({
    // Bei JEDEM Aufruf eine neue Map — so verhält sich der echte Hook auch
    // (`setLiveMatches(prev => new Map(prev)...)`). Gäbe die Attrappe die modulweite Map
    // zurück, bliebe deren Identität konstant, `currentMatch` würde nie neu berechnet und
    // beide Tests hier wären vakuum-grün: Sie prüften dann nur, dass nichts passiert.
    liveMatches: new Map(liveMatches),
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

import { ManagementTab } from '../ManagementTab';

const MATCH_ID = 'match-1';
const HOME = { id: 'team-a', name: 'FC Alpha' };
const AWAY = { id: 'team-b', name: 'SV Beta' };

const sharedEvents: CoreMatchEvent[] = [
  {
    id: 'f1', matchId: MATCH_ID, timestampSeconds: 30, type: 'FOUL',
    payload: { team: 'home' }, scoreAfter: { home: 0, away: 0 },
  },
];

function setLiveMatch(overrides: Partial<LiveMatch> = {}): void {
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
    // Bewusst DIESELBE Array-Referenz: Die Ereignisse ändern sich zwischen den Renderläufen nicht.
    events: sharedEvents,
    ...overrides,
  });
}

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

describe('ManagementTab → LiveCockpit: Identität der normalisierten Ereignisse', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    liveMatches.clear();
    seenEventArrays.length = 0;
  });

  it('behält die Array-Identität, wenn sich am Match nur die Uhr ändert', () => {
    setLiveMatch({ elapsedSeconds: 30 });
    const { rerender } = render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} />
    );

    // Neues Match-Objekt, identische Ereignisse — genau das, was ein Uhr-Tick erzeugt.
    setLiveMatch({ elapsedSeconds: 45 });
    rerender(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} />
    );

    const first = seenEventArrays[0];
    const last = seenEventArrays[seenEventArrays.length - 1];
    expect(first).toBeDefined();
    expect(last).toBe(first);
  });

  it('erzeugt ein neues Array, sobald sich die Ereignisse tatsächlich ändern', () => {
    setLiveMatch();
    const { rerender } = render(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} />
    );
    const before = seenEventArrays[seenEventArrays.length - 1];

    setLiveMatch({
      events: [
        ...sharedEvents,
        {
          id: 'g1', matchId: MATCH_ID, timestampSeconds: 60, type: 'GOAL',
          payload: { team: 'home', delta: 1 }, scoreAfter: { home: 1, away: 0 },
        },
      ],
    });
    rerender(
      <ManagementTab tournament={tournament} schedule={schedule} onTournamentUpdate={vi.fn()} />
    );

    const after = seenEventArrays[seenEventArrays.length - 1];
    expect(after).not.toBe(before);
    expect(after).toHaveLength(2);
  });
});
