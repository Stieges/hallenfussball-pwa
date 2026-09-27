/**
 * Task C2b, Aufgabe 4c: SyncStatusBar additiv um Ablehnungs-/Review-Hinweis.
 * Bestehendes Verhalten bleibt unveraendert (siehe SyncStatusBar.test.tsx).
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { cssVars } from '../../../../design-tokens';
import { SyncStatusBar } from '../SyncStatusBar';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

vi.mock('../../../../hooks/useSyncStatus', () => ({
  useSyncStatus: () => ({
    status: 'synced',
    isSyncing: false,
    pendingChanges: 0,
    failedChanges: 0,
    failedMutations: [],
    isCloudSyncAvailable: true,
    lastSyncedAt: undefined,
    syncTournament: vi.fn(),
    retryFailedMutation: vi.fn(),
    discardFailedMutation: vi.fn(),
  }),
}));

describe('SyncStatusBar — nicht uebernommene Eintraege (C2b, additiv)', () => {
  it('zeigt bei rejectedCount > 0 einen Hinweis mit data-rejected', () => {
    render(<SyncStatusBar status="synced" rejectedCount={2} />);
    const hint = screen.getByTestId('sync-status-rejected');
    expect(hint).toHaveAttribute('data-rejected', '2');
    expect(hint).toHaveTextContent('common:outbox.rejected.countLabel');
  });

  it('Klick auf den Hinweis ruft onShowRejected und nicht onSyncClick', () => {
    const onShowRejected = vi.fn();
    const onSyncClick = vi.fn();
    render(
      <SyncStatusBar
        status="synced"
        rejectedCount={1}
        onShowRejected={onShowRejected}
        onSyncClick={onSyncClick}
      />,
    );
    fireEvent.click(screen.getByTestId('sync-status-rejected'));
    expect(onShowRejected).toHaveBeenCalledTimes(1);
    expect(onSyncClick).not.toHaveBeenCalled();
  });

  it('ohne rejectedCount erscheint kein Hinweis', () => {
    render(<SyncStatusBar status="synced" rejectedCount={0} />);
    expect(screen.queryByTestId('sync-status-rejected')).toBeNull();
  });

  it('reviewCount zeigt den Hinweis wartet auf Turnierleitung', () => {
    render(<SyncStatusBar status="synced" reviewCount={3} />);
    expect(screen.getByTestId('sync-status')).toHaveTextContent('common:outbox.notice.review');
  });

  // Fixrunde 1 (Review m5): beide echten Einbauorte (AdminHeader, LiveCockpit via
  // SyncStatusIndicator) nutzen `compact=true` -- der Review-Hinweis war dort nie sichtbar.
  it('reviewCount ist auch im Kompaktmodus sichtbar', () => {
    render(<SyncStatusBar status="synced" compact reviewCount={2} />);
    expect(screen.getByTestId('sync-status-review-badge')).toHaveTextContent('2');
  });

  // Fixrunde 1 (Review I2): color=onError (weiss) auf background=errorLight (fast weiss/leicht
  // transparent) ist im hellen Theme praktisch unlesbar (Kontrast weit unter WCAG 4.5:1). Beide
  // Tokens sind Theme-abhaengige CSS-Variablen -- der satte `error`-Ton auf der blassen
  // `errorLight`-Flaeche ist in BEIDEN Themes lesbar (heller/dunkler Text auf blasser Flaeche).
  it('Ablehnungs-Hinweis nutzt eine im hellen UND dunklen Theme lesbare Farbkombination', () => {
    render(<SyncStatusBar status="synced" rejectedCount={1} />);
    const hint = screen.getByTestId('sync-status-rejected');
    expect(hint).toHaveStyle({ color: cssVars.colors.error });
    expect(hint).not.toHaveStyle({ color: cssVars.colors.onError });
    expect(hint).toHaveStyle({ background: cssVars.colors.errorLight });
  });

  it('Hinweis mit Aktion ist ein Touch-Ziel', () => {
    render(<SyncStatusBar status="synced" rejectedCount={1} onShowRejected={vi.fn()} />);
    expect(screen.getByTestId('sync-status-rejected')).toHaveStyle({
      minHeight: cssVars.touchTargets.minimum,
    });
  });

  it('bestehendes Verhalten bleibt: failedCount schaltet weiter auf error', () => {
    render(<SyncStatusBar status="synced" pendingCount={0} failedCount={1} rejectedCount={4} />);
    expect(screen.getByTestId('sync-status')).toHaveAttribute('data-state', 'error');
  });
});

describe('SyncStatusIndicator — Durchreichung der neuen Props (C2b, ohne Datenquelle)', () => {
  it('gibt rejectedCount und onShowRejected an die SyncStatusBar weiter', () => {
    const onShowRejected = vi.fn();
    render(<SyncStatusIndicator compact={false} rejectedCount={2} reviewCount={1} onShowRejected={onShowRejected} />);
    fireEvent.click(screen.getByTestId('sync-status-rejected'));
    expect(screen.getByTestId('sync-status-rejected')).toHaveAttribute('data-rejected', '2');
    expect(onShowRejected).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('sync-status')).toHaveTextContent('common:outbox.notice.review');
  });
});
