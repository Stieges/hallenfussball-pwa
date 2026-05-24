import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { OfflineBanner, RECOVERY_ARM_DELAY_MS } from '../OfflineBanner';

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
// Recovery button (C3) — only mounts after the arming delay so a flickering
// banner can't be reset by a misclick.
// =============================================================================
describe('OfflineBanner — recovery button', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not render the recovery button when onClearCache prop is omitted', () => {
    render(<OfflineBanner subtitle="x" onRetry={vi.fn()} data-testid="b" />);
    act(() => {
      vi.advanceTimersByTime(RECOVERY_ARM_DELAY_MS + 1000);
    });
    expect(screen.queryByTestId('b-recovery')).not.toBeInTheDocument();
  });

  it('does not render the recovery button until the arming delay has elapsed', () => {
    render(
      <OfflineBanner
        subtitle="x"
        onRetry={vi.fn()}
        onClearCache={vi.fn()}
        clearCacheLabel="reset"
        data-testid="b"
      />,
    );
    expect(screen.queryByTestId('b-recovery')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(RECOVERY_ARM_DELAY_MS - 100);
    });
    expect(screen.queryByTestId('b-recovery')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('b-recovery')).toBeInTheDocument();
  });

  it('renders the supplied recovery label and disclaimer once armed', () => {
    render(
      <OfflineBanner
        subtitle="x"
        onRetry={vi.fn()}
        onClearCache={vi.fn()}
        clearCacheLabel="Cache leeren & neu laden"
        clearCacheDisclaimer="Lokale Änderungen können verloren gehen."
        data-testid="b"
      />,
    );
    act(() => {
      vi.advanceTimersByTime(RECOVERY_ARM_DELAY_MS + 50);
    });
    expect(screen.getByRole('button', { name: 'Cache leeren & neu laden' })).toBeInTheDocument();
    expect(screen.getByText('Lokale Änderungen können verloren gehen.')).toBeInTheDocument();
  });

  it('invokes onClearCache when the recovery button is clicked', () => {
    const onClearCache = vi.fn().mockResolvedValue(undefined);
    render(
      <OfflineBanner
        subtitle="x"
        onRetry={vi.fn()}
        onClearCache={onClearCache}
        clearCacheLabel="reset"
        data-testid="b"
      />,
    );
    act(() => {
      vi.advanceTimersByTime(RECOVERY_ARM_DELAY_MS + 50);
    });
    fireEvent.click(screen.getByTestId('b-recovery'));
    expect(onClearCache).toHaveBeenCalledOnce();
  });

  it('clears the arming timer on unmount (no late state update)', () => {
    const { unmount } = render(
      <OfflineBanner
        subtitle="x"
        onRetry={vi.fn()}
        onClearCache={vi.fn()}
        clearCacheLabel="reset"
        data-testid="b"
      />,
    );
    unmount();
    // Advancing past the arm delay must not throw or warn about state-updates
    // on an unmounted component.
    expect(() =>
      act(() => {
        vi.advanceTimersByTime(RECOVERY_ARM_DELAY_MS + 1000);
      }),
    ).not.toThrow();
  });
});
