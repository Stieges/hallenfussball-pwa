import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { OfflineBanner } from '../OfflineBanner';

// =============================================================================
// Existing behaviour (#153 hotfix surface)
// =============================================================================
describe('OfflineBanner — current surface', () => {
  it('renders the "Cloud nicht erreichbar" headline', () => {
    render(<OfflineBanner subtitle="probe-subtitle" onRetry={vi.fn()} />);
    expect(screen.getByText('Cloud nicht erreichbar')).toBeInTheDocument();
  });

  it('renders the supplied subtitle', () => {
    render(<OfflineBanner subtitle="probe-subtitle" onRetry={vi.fn()} />);
    expect(screen.getByText('probe-subtitle')).toBeInTheDocument();
  });

  it('fires onRetry when the retry button is clicked', async () => {
    const onRetry = vi.fn();
    render(<OfflineBanner subtitle="x" onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /erneut/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('exposes data-testid hooks for the banner and retry button', () => {
    render(<OfflineBanner subtitle="x" onRetry={vi.fn()} data-testid="offline-banner" />);
    expect(screen.getByTestId('offline-banner')).toBeInTheDocument();
    expect(screen.getByTestId('offline-banner-retry')).toBeInTheDocument();
  });
});

// =============================================================================
// PR 2 surface — recovery button (C3 in the sub-spec).
// `.todo()` markers describe the contract we'll satisfy in PR 2 without
// blocking PR 1's telemetry-baseline merge. Each todo translates 1:1 to an
// `it()` in PR 2.
// =============================================================================
describe('OfflineBanner — recovery button (PR 2)', () => {
  it.todo(
    'renders a "Cache leeren & neu laden" button after the 5s arming delay',
  );
  it.todo(
    'does not render the recovery button until the arming delay has elapsed (prevents accidental clicks on transient banners)',
  );
  it.todo(
    'unregisters all service workers, deletes all caches, then triggers location.reload() in that order',
  );
  it.todo(
    'sends a captureFeatureError breadcrumb with buildHash + navigator.onLine before resetting',
  );
  it.todo(
    'surfaces an i18n disclaimer that unsynced local mutations may be lost',
  );
});
