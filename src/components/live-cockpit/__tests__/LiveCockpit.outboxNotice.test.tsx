/**
 * LiveCockpit (C3a-2a, Nachtrag W1): OutboxNotice ist im Kopf eingebunden -- rendert nichts ohne
 * Ausgangs-Zustand (Standardfall der anderen LiveCockpit.*.test.tsx-Dateien, ohne
 * MatchEngineProvider), zeigt aber den Hinweis, sobald der Sender einen Zustand meldet (hier:
 * authRequired).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';
import { emptyOutboxStatus, type OutboxStatus } from '../../../core/match/client/outboxTypes';

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

const mockStatus: { current: OutboxStatus } = { current: emptyOutboxStatus() };
// I4 (Nachtrag Fixrunde 1): useEngineOutboxSummary (jetzt ebenfalls in LiveCockpit eingebunden)
// braucht store/accountId zusaetzlich zu sender -- ein vollstaendiges Fake, damit kein
// `forAccount is not a function`/unhandled rejection den Testlauf verschmutzt.
const mockContext = {
  sender: {
    getStatus: () => mockStatus.current,
    subscribe: () => () => undefined,
    dismissRejected: vi.fn().mockResolvedValue(undefined),
  },
  store: { forAccount: vi.fn().mockResolvedValue([]) },
  accountId: 'acc-outbox-notice-test',
};
vi.mock('../../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockContext,
}));

function makeMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1', number: 7, phaseLabel: 'Gruppenphase', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' }, awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 1, awayScore: 0, status: 'RUNNING', elapsedSeconds: 30, playPhase: 'regular',
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

describe('LiveCockpit x OutboxNotice (C3a-2a, W1)', () => {
  beforeEach(() => {
    mockStatus.current = emptyOutboxStatus();
  });

  it('zeigt den Hinweis, wenn der Sender authRequired meldet', () => {
    mockStatus.current = { ...emptyOutboxStatus(), authRequired: true };
    render(<LiveCockpit {...baseProps(makeMatch())} />);

    expect(screen.getByTestId('outbox-notice')).toHaveAttribute('data-kind', 'authRequired');
  });

  it('zeigt nichts, wenn der Ausgang leer/ruhig ist', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} />);

    expect(screen.queryByTestId('outbox-notice')).not.toBeInTheDocument();
  });
});
