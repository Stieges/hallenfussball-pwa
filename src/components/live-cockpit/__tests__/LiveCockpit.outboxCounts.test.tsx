/**
 * LiveCockpit — P5 (C3a-2a Fixrunde 3): `SyncStatusIndicator` erhaelt `enginePendingCount`
 * aus `useEngineOutboxSummary` (Verhalten existiert bereits seit Fixrunde 2, Item 4 -- der
 * Nachweis hier ist die Mutationsprobe, s. Report: M5b aus dem Re-Review ueberlebte bisher,
 * weil keine dedizierte Assertion existierte).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveCockpit } from '../LiveCockpit';
import type { LiveCockpitProps } from '../types';

vi.mock('../../../hooks/useMatchSound', () => ({
  useMatchSound: () => ({ play: vi.fn(), stop: vi.fn(), testPlay: vi.fn(), activate: vi.fn(), isPlaying: false, isLoading: false, isReady: true, isActivated: true, error: null }),
}));

vi.mock('../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced', isSyncing: false, pendingChanges: 0, failedChanges: 0, failedMutations: [],
    syncTournament: vi.fn(), retryFailedMutation: vi.fn(), discardFailedMutation: vi.fn(),
    isCloudSyncAvailable: true,
  }),
}));

vi.mock('../../../features/match-engine/useEngineOutboxSummary', () => ({
  useEngineOutboxSummary: () => ({
    pendingCount: 3,
    rejectedCount: 0,
    reviewCount: 0,
    entries: [],
    dismiss: vi.fn(),
  }),
}));

// C3b-1: LiveCockpit bindet useEngineEventEditing ein -> useActorRole (braucht AuthProvider); hier nicht Gegenstand.
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'helper' }));

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

describe('LiveCockpit — P5: enginePendingCount an SyncStatusIndicator', () => {
  it('reicht enginePendingCount (aus useEngineOutboxSummary) an SyncStatusIndicator/SyncStatusBar durch', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} />);

    // Echte Komponenten (SyncStatusIndicator + SyncStatusBar sind nicht gemockt) --
    // `pendingChanges` (0, aus useSyncStatus) + `enginePendingCount` (3) = 3.
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-pending', '3');
  });
});
