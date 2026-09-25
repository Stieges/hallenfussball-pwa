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

// Fixrunde 1 (Review C1): "deutlich bei gescheiterten Einträgen" muss SICHTBAR sein, nicht nur im
// Test-Attribut `data-state`. Vorher blieb das Symbol bei failedCount > 0 ein grünes "✓"
// (STATUS_CONFIG kam ausschließlich aus `status`, nie aus `failedCount`), und im Kompaktmodus
// (beide echten Aufrufstellen, AdminHeader + LiveCockpit, nutzen `compact`) wurde die Anzahl
// komplett ausgeblendet.
describe('SyncStatusBar — sichtbare Darstellung bei gescheiterten/wartenden Einträgen (Fixrunde 1, C1)', () => {
  it('shows the error icon/aria-label when failedCount > 0, even though status is still "synced"', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={1} compact />);
    const button = screen.getByTestId('sync-status');
    // Symbol wechselt (config.icon für 'error' ist "✕", nicht mehr "✓").
    expect(button).toHaveTextContent('✕');
    // aria-label wechselt auf den übersetzten "Fehler"-Text (I2: über i18n).
    expect(button).toHaveAttribute('aria-label', 'common:syncStatus.label.error');
  });

  it('shows a visible badge with the failed count in compact mode', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={3} compact />);
    expect(screen.getByTestId('sync-status-badge')).toHaveTextContent('3');
  });

  it('shows a visible badge with the pending count in compact mode when nothing failed', () => {
    render(<SyncStatusBar status="synced" pendingCount={5} failedCount={0} compact />);
    expect(screen.getByTestId('sync-status-badge')).toHaveTextContent('5');
  });

  it('failed count wins over pending count in the badge when both are set', () => {
    render(<SyncStatusBar status="synced" pendingCount={2} failedCount={1} compact />);
    expect(screen.getByTestId('sync-status-badge')).toHaveTextContent('1');
  });

  it('renders no badge when nothing is pending or failed', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={0} compact />);
    expect(screen.queryByTestId('sync-status-badge')).not.toBeInTheDocument();
  });

  it('keeps the synced (green check) look when nothing failed', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={0} compact />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveTextContent('✓');
    expect(button).toHaveAttribute('aria-label', 'common:syncStatus.label.synced');
  });
});

// Fixrunde 1 (Review I1): Touch-Target ≥ 44px, aus Design-Tokens (nicht hartkodiert).
describe('SyncStatusBar — Touch-Target (Fixrunde 1, I1)', () => {
  it('has a minHeight/minWidth of at least 44px in compact mode', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={0} compact />);
    const button = screen.getByTestId('sync-status');
    // jsdom löst CSS-Variablen nicht auf -- die Style-Werte selbst müssen daher bereits das
    // 44px-Token sein (cssVars.touchTargets.minimum = 'var(--touch-target-minimum)'), nicht "32".
    expect(button.style.minHeight).not.toBe('32px');
    expect(button.style.minWidth).not.toBe('32px');
  });
});

// Fixrunde 1 (Review I2): ALLE Texte über i18n, inkl. aria-label/title.
describe('SyncStatusBar — i18n (Fixrunde 1, I2)', () => {
  it('translates the syncing aria-label/title instead of hardcoding German', () => {
    render(<SyncStatusBar status="synced" isSyncing pendingCount={0} failedCount={0} />);
    const button = screen.getByTestId('sync-status');
    expect(button).toHaveAttribute('aria-label', 'common:syncStatus.syncingAriaLabel');
  });

  it('translates the label shown alongside the icon (showLabel, not compact)', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={0} showLabel />);
    expect(screen.getByText('common:syncStatus.label.synced')).toBeInTheDocument();
  });

  it('translates the pending/failed inline text (not compact)', () => {
    render(<SyncStatusBar status="synced" pendingCount={2} failedCount={1} />);
    expect(screen.getByText('(common:syncStatus.pendingCountLabel)')).toBeInTheDocument();
    expect(screen.getByText('(common:syncStatus.failedCountLabel)')).toBeInTheDocument();
  });
});
