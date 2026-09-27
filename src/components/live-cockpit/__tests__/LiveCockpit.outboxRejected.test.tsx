/**
 * LiveCockpit (C3a-2a Fixrunde 1, I4/W1): SyncStatusIndicator bezieht rejectedCount/reviewCount
 * aus useEngineOutboxSummary; "Ablehnungen anzeigen" oeffnet einen Dialog mit
 * RejectedEntriesPanel, "Verstanden" ruft dismiss() auf. Helfer sahen Ablehnungen (D-C1) bisher
 * nirgends im Cockpit, nur im AdminHeader (Review-Befund 5).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RejectedEntry } from '../../../core/match/client';
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

const mockDismiss = vi.fn().mockResolvedValue(undefined);
const summaryEntries: RejectedEntry[] = [
  {
    event: { id: 'e1', type: 'GOAL', actor: 'helper', at: 0, section: 1, clockMs: 0, payload: {} },
    code: 'MATCH_FULL',
    rejectedAt: 0,
  },
];
vi.mock('../../../features/match-engine/useEngineOutboxSummary', () => ({
  useEngineOutboxSummary: () => ({
    pendingCount: 0,
    rejectedCount: 1,
    reviewCount: 0,
    entries: summaryEntries,
    dismiss: mockDismiss,
  }),
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

describe('LiveCockpit x useEngineOutboxSummary (C3a-2a Fixrunde 1, I4/W1)', () => {
  it('SyncStatusIndicator "Ablehnungen anzeigen" oeffnet den Dialog, "Verstanden" ruft dismiss auf', () => {
    render(<LiveCockpit {...baseProps(makeMatch())} />);

    fireEvent.click(screen.getByTestId('sync-status-rejected'));

    expect(screen.getByTestId('outbox-rejected-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('outbox-rejected-dismiss'));
    expect(mockDismiss).toHaveBeenCalledWith(['e1']);
  });

  it('Fixrunde 2 (Re-Review-Befund C4): ein Fehler bei dismiss() zeigt einen Toast statt einer unbehandelten Ablehnung', async () => {
    mockDismiss.mockRejectedValueOnce(new Error('IDB kaputt'));
    render(<LiveCockpit {...baseProps(makeMatch())} />);
    fireEvent.click(screen.getByTestId('sync-status-rejected'));

    fireEvent.click(screen.getByTestId('outbox-rejected-dismiss'));

    await screen.findByText('Verstanden fehlgeschlagen — bitte erneut versuchen');
  });
});
