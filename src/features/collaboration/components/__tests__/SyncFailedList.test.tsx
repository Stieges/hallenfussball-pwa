import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncFailedList } from '../SyncFailedList';
import type { FailedMutationItem } from '../../../../core/services/MutationQueue';

// Task A4 (C-SYNC): Liste gescheiterter Übertragungen mit Grund je Eintrag und den Aktionen
// "erneut versuchen" (sofort) und "verwerfen" (mit Rückfrage). Wird sowohl vom Admin- als auch
// vom Cockpit-Kopf über SyncStatusIndicator eingebunden.

function makeItem(overrides?: Partial<FailedMutationItem>): FailedMutationItem {
  return {
    id: 'fail-1',
    type: 'UPDATE_MATCH',
    payload: {},
    timestamp: 1000,
    retryCount: 5,
    failedAt: 2000,
    lastError: 'RLS: keine Berechtigung',
    ...overrides,
  };
}

describe('SyncFailedList', () => {
  it('renders one row per failed mutation with its reason', () => {
    render(
      <SyncFailedList
        items={[makeItem()]}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('sync-failed-list')).toBeInTheDocument();
    expect(screen.getByText('RLS: keine Berechtigung')).toBeInTheDocument();
  });

  it('falls back to a generic reason when lastError is missing', () => {
    render(
      <SyncFailedList
        items={[makeItem({ lastError: undefined })]}
        onRetry={vi.fn()}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('common:syncStatus.failedReasonUnknown')).toBeInTheDocument();
  });

  it('calls onRetry immediately (no confirmation) when "erneut versuchen" is clicked', () => {
    const onRetry = vi.fn();
    render(
      <SyncFailedList
        items={[makeItem()]}
        onRetry={onRetry}
        onDiscard={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('sync-retry-fail-1'));
    expect(onRetry).toHaveBeenCalledWith('fail-1');
  });

  it('asks for confirmation before discarding, and only discards on confirm', () => {
    const onDiscard = vi.fn();
    render(
      <SyncFailedList
        items={[makeItem()]}
        onRetry={vi.fn()}
        onDiscard={onDiscard}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('sync-discard-fail-1'));
    // Not discarded yet — confirmation dialog must appear first.
    expect(onDiscard).not.toHaveBeenCalled();
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('confirm-dialog-confirm'));
    expect(onDiscard).toHaveBeenCalledWith('fail-1');
  });

  it('does not discard when the confirmation is cancelled', () => {
    const onDiscard = vi.fn();
    render(
      <SyncFailedList
        items={[makeItem()]}
        onRetry={vi.fn()}
        onDiscard={onDiscard}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTestId('sync-discard-fail-1'));
    fireEvent.click(screen.getByTestId('confirm-dialog-cancel'));
    expect(onDiscard).not.toHaveBeenCalled();
  });

  it('shows an empty state when there are no failed mutations', () => {
    render(
      <SyncFailedList items={[]} onRetry={vi.fn()} onDiscard={vi.fn()} onClose={vi.fn()} />
    );
    expect(screen.getByText('common:syncStatus.failedListEmpty')).toBeInTheDocument();
  });
});
