import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SyncStatusBar } from '../SyncStatusBar';

// Task A4 (C-SYNC): Übertragungsstatus muss "deutlich bei gescheiterten Einträgen" sein. Bug
// gefunden beim Cloud-E2E-Nachweis (task-A4-brief.md): `data-state` blieb "idle", obwohl
// `failedCount > 0` war -- die alte testState-Berechnung sah nur auf `status` (synced/error/...),
// nie auf `failedCount`. useSyncStatus() setzt `status` aber nie automatisch auf 'error', wenn
// die MutationQueue einen Eintrag ins Dead-Letter verschiebt (das passiert passiv, ohne einen
// syncTournament()/resolveConflict()-Aufruf, der `status` sonst setzt).
describe('SyncStatusBar — data-state bei gescheiterten Einträgen (C-SYNC)', () => {
  it('shows data-state="error" when failedCount > 0, even if status is still "synced"', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={1} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-state', 'error');
  });

  it('keeps data-state="idle" when nothing failed and nothing is pending', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={0} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-state', 'idle');
  });

  it('data-state="offline" still wins over failedCount=0 while offline', () => {
    render(<SyncStatusBar status="offline" pendingCount={0} failedCount={0} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-state', 'offline');
  });

  it('failedCount > 0 takes priority even while isSyncing is false and status is offline', () => {
    render(<SyncStatusBar status="offline" pendingCount={0} failedCount={2} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-state', 'error');
  });
});
