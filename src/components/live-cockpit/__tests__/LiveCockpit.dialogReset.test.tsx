/**
 * LiveCockpit (C3a-2a Fixrunde 2, RC13-Regression): der Dialog-Reset-Effekt haengt NUR an
 * `match.id`, NICHT an `currentMatch?.events` -- ein offener GoalScorerDialog (oder ein anderer
 * Dialog-/Pending-Zustand) darf NICHT geschlossen werden, wenn sich NUR die Ereignisliste des
 * AKTUELLEN Spiels aendert (z. B. weil der Engine-Lesepfad ein neues LiveMatch-Objekt liefert,
 * ohne dass sich das Spiel selbst geaendert hat). Fixrunde 1 hatte diesen Fix ohne eigenen
 * Regressionstest gemeldet -- die Mutation ueberlebte Vitest UND E2E (Re-Review-Befund).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: false,
  }),
}));

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 0, awayScore: 0, status: 'RUNNING', elapsedSeconds: 30, playPhase: 'regular',
    events: [],
    ...overrides,
  };
}

function baseProps(match: unknown, handlers: Partial<LiveCockpitProps> = {}): LiveCockpitProps {
  return {
    fieldName: 'Feld 1', tournamentName: 'Test-Turnier', tournamentId: 'tour-1',
    currentMatch: match as never, upcomingMatches: [],
    onStart: vi.fn(), onPause: vi.fn(), onResume: vi.fn(), onFinish: vi.fn(), onGoal: vi.fn(),
    onUndoLastEvent: vi.fn(), onManualEditResult: vi.fn(), onAdjustTime: vi.fn(),
    onLoadNextMatch: vi.fn(), onReopenLastMatch: vi.fn(), ...handlers,
  };
}

describe('LiveCockpit — RC13-Regression (C3a-2a Fixrunde 2): Dialog-Reset haengt nur an match.id', () => {
  it('ein offener GoalScorerDialog bleibt offen, wenn sich NUR currentMatch.events aendert (gleiches match.id)', async () => {
    const user = userEvent.setup();
    const match1 = makeMatch({ elapsedSeconds: 30, events: [] });
    const { rerender } = render(<LiveCockpit {...baseProps(match1)} />);

    await user.click(screen.getByTestId('goal-button-home'));
    expect(screen.getByTestId('dialog-skip-button')).toBeInTheDocument();

    // Gleiches Spiel (match.id unveraendert), aber ein NEUES `events`-Array (z. B. weil der
    // Engine-Lesepfad ein frisches LiveMatch-Objekt liefert) -- der Dialog darf NICHT
    // verschwinden.
    const match2 = makeMatch({ elapsedSeconds: 31, events: [{ id: 'e-other', type: 'FOUL', payload: {} }] });
    rerender(<LiveCockpit {...baseProps(match2)} />);

    expect(screen.getByTestId('dialog-skip-button')).toBeInTheDocument();
  });

  it('Gegenprobe: ein ECHTER Spielwechsel (neues match.id) schliesst den Dialog weiterhin', async () => {
    const user = userEvent.setup();
    const match1 = makeMatch({ id: 'match-1' });
    const { rerender } = render(<LiveCockpit {...baseProps(match1)} />);

    await user.click(screen.getByTestId('goal-button-home'));
    expect(screen.getByTestId('dialog-skip-button')).toBeInTheDocument();

    const match2 = makeMatch({ id: 'match-2' });
    rerender(<LiveCockpit {...baseProps(match2)} />);

    expect(screen.queryByTestId('dialog-skip-button')).not.toBeInTheDocument();
  });
});
