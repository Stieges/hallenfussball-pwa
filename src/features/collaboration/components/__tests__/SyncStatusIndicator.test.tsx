import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatusIndicator } from '../SyncStatusIndicator';
import type { FailedMutationItem } from '../../../../core/services/MutationQueue';

// Task A4 (C-SYNC): Übertragungsstatus muss im Admin- und Cockpit-Kopf sichtbar sein — ruhig
// bei "alles übertragen", "n Einträge warten" bei ausstehenden Einträgen, deutlich bei
// gescheiterten Einträgen mit Zugriff auf retry/verwerfen. Ein Baustein statt zwei getrennte
// Implementierungen in AdminHeader und LiveCockpit.

const mockState: {
  status: 'synced' | 'updated' | 'conflict' | 'error' | 'offline';
  isSyncing: boolean;
  pendingChanges: number;
  failedChanges: number;
  failedMutations: FailedMutationItem[];
  isCloudSyncAvailable: boolean;
} = {
  status: 'synced',
  isSyncing: false,
  pendingChanges: 0,
  failedChanges: 0,
  failedMutations: [],
  isCloudSyncAvailable: true,
};

const syncTournament = vi.fn();
const retryFailedMutation = vi.fn();
const discardFailedMutation = vi.fn();

vi.mock('../../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    ...mockState,
    syncTournament,
    retryFailedMutation,
    discardFailedMutation,
  }),
}));

describe('SyncStatusIndicator', () => {
  beforeEach(() => {
    mockState.status = 'synced';
    mockState.isSyncing = false;
    mockState.pendingChanges = 0;
    mockState.failedChanges = 0;
    mockState.failedMutations = [];
    mockState.isCloudSyncAvailable = true;
    syncTournament.mockClear();
    retryFailedMutation.mockClear();
    discardFailedMutation.mockClear();
  });

  it('renders the sync-status indicator quietly when everything is synced', () => {
    render(<SyncStatusIndicator tournamentId="t1" />);
    const indicator = screen.getByTestId('sync-status');
    expect(indicator).toHaveAttribute('data-state', 'idle');
    expect(indicator).toHaveAttribute('data-pending', '0');
  });

  it('shows the pending count while entries are waiting to sync', () => {
    mockState.pendingChanges = 3;
    render(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-pending', '3');
  });

  it('shows offline state', () => {
    mockState.status = 'offline';
    render(<SyncStatusIndicator tournamentId="t1" />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-state', 'offline');
  });

  it('opens the failed list when clicked while there are failed mutations, instead of syncing', () => {
    mockState.failedChanges = 1;
    mockState.failedMutations = [{
      id: 'fail-1', type: 'UPDATE_MATCH', payload: {}, timestamp: 1, retryCount: 5,
      failedAt: 2, lastError: 'RLS: keine Berechtigung',
    }];
    render(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));

    expect(screen.getByTestId('sync-failed-list')).toBeInTheDocument();
    expect(syncTournament).not.toHaveBeenCalled();
  });

  it('retries a failed mutation from the opened list', () => {
    mockState.failedChanges = 1;
    mockState.failedMutations = [{
      id: 'fail-1', type: 'UPDATE_MATCH', payload: {}, timestamp: 1, retryCount: 5,
      failedAt: 2, lastError: 'RLS: keine Berechtigung',
    }];
    render(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));
    fireEvent.click(screen.getByTestId('sync-retry-fail-1'));

    expect(retryFailedMutation).toHaveBeenCalledWith('fail-1');
  });

  it('triggers a manual sync when clicked while there are no failed mutations', () => {
    mockState.pendingChanges = 2;
    render(<SyncStatusIndicator tournamentId="t1" />);

    fireEvent.click(screen.getByTestId('sync-status'));

    expect(syncTournament).toHaveBeenCalledWith('t1');
    expect(screen.queryByTestId('sync-failed-list')).not.toBeInTheDocument();
  });

  it('renders nothing outside cloud mode (guest/local-only — no mutation queue)', () => {
    mockState.isCloudSyncAvailable = false;
    const { container } = render(<SyncStatusIndicator tournamentId="t1" />);
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('sync-status')).not.toBeInTheDocument();
  });
});
