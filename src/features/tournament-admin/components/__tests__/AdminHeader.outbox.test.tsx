/**
 * AdminHeader (C3a-2a, Nachtrag W1): SyncStatusIndicator bezieht rejectedCount/reviewCount aus
 * useEngineOutboxSummary; "onShowRejected" oeffnet einen Dialog mit RejectedEntriesPanel,
 * "Verstanden" ruft dismiss() auf. SyncStatusIndicator/RejectedEntriesPanel selbst sind bereits
 * eigenstaendig getestet -- hier geht es nur um die Verdrahtung in AdminHeader.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { RejectedEntry } from '../../../../core/match/client';

const mockDismiss = vi.fn().mockResolvedValue(undefined);
const summary: { rejectedCount: number; reviewCount: number; entries: RejectedEntry[] } = {
  rejectedCount: 2,
  reviewCount: 0,
  entries: [
    {
      event: { id: 'e1', type: 'GOAL', actor: 'helper', at: 0, section: 1, clockMs: 0, payload: {} },
      code: 'MATCH_FULL',
      rejectedAt: 0,
    },
  ],
};
// P5 (Fixrunde 3): pendingCount: 3 statt 0 -- der Stub unten faengt `enginePendingCount` jetzt
// AUCH ab (M5c aus dem Re-Review ueberlebte bisher, weil der Stub die Prop schlicht ignorierte).
vi.mock('../../../match-engine/useEngineOutboxSummary', () => ({
  useEngineOutboxSummary: () => ({ ...summary, pendingCount: 3, dismiss: mockDismiss }),
}));

const mockShowToastError = vi.fn();
vi.mock('../../../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showError: mockShowToastError }),
}));

vi.mock('../../../collaboration', () => ({
  SyncStatusIndicator: ({ rejectedCount, reviewCount, onShowRejected, enginePendingCount }: {
    rejectedCount?: number;
    reviewCount?: number;
    onShowRejected?: () => void;
    enginePendingCount?: number;
  }) => (
    <button data-testid="sync-status-stub" onClick={onShowRejected} data-engine-pending={enginePendingCount}>
      {rejectedCount}/{reviewCount}
    </button>
  ),
}));

import { AdminHeader } from '../AdminHeader';

describe('AdminHeader x useEngineOutboxSummary (C3a-2a, W1)', () => {
  it('reicht rejectedCount/reviewCount an SyncStatusIndicator durch', () => {
    render(
      <AdminHeader title="Test" onBackToTournament={vi.fn()} tournamentId="tour-1" showSyncStatus />,
    );
    expect(screen.getByTestId('sync-status-stub')).toHaveTextContent('2/0');
  });

  // P5 (Fixrunde 3): Verhalten existiert bereits (AdminHeader.tsx uebergibt
  // `enginePendingCount={outboxSummary.pendingCount}`) -- der Nachweis ist die Mutationsprobe
  // (M5c aus dem Re-Review), s. Report.
  it('P5: reicht enginePendingCount (aus useEngineOutboxSummary) an SyncStatusIndicator durch', () => {
    render(
      <AdminHeader title="Test" onBackToTournament={vi.fn()} tournamentId="tour-1" showSyncStatus />,
    );
    expect(screen.getByTestId('sync-status-stub')).toHaveAttribute('data-engine-pending', '3');
  });

  it('onShowRejected oeffnet den Dialog mit RejectedEntriesPanel, "Verstanden" ruft dismiss auf', () => {
    render(
      <AdminHeader title="Test" onBackToTournament={vi.fn()} tournamentId="tour-1" showSyncStatus />,
    );

    fireEvent.click(screen.getByTestId('sync-status-stub'));

    expect(screen.getByTestId('outbox-rejected-panel')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('outbox-rejected-dismiss'));
    expect(mockDismiss).toHaveBeenCalledWith(['e1']);
  });

  it('Fixrunde 2 (Re-Review-Befund C4): ein Fehler bei dismiss() zeigt einen Toast statt einer unbehandelten Ablehnung', async () => {
    mockDismiss.mockRejectedValueOnce(new Error('IDB kaputt'));
    render(
      <AdminHeader title="Test" onBackToTournament={vi.fn()} tournamentId="tour-1" showSyncStatus />,
    );
    fireEvent.click(screen.getByTestId('sync-status-stub'));

    fireEvent.click(screen.getByTestId('outbox-rejected-dismiss'));

    await vi.waitFor(() => expect(mockShowToastError).toHaveBeenCalled());
  });
});
