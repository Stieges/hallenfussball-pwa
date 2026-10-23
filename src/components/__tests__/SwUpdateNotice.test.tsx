/**
 * Task C3b-2d (G8): persistenter Update-Hinweis — bleibt stehen
 * (kein Auto-Ausblenden), der Knopf lädt sofort neu.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { touchTargets } from '../../design-tokens';
import { SwUpdateNotice } from '../SwUpdateNotice';

describe('SwUpdateNotice', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Hinweis bleibt stehen (kein Auto-Ausblenden)', () => {
    render(<SwUpdateNotice onUpdateNow={vi.fn()} />);
    const notice = screen.getByTestId('sw-update-notice');
    expect(notice).toHaveTextContent('common:outbox.notice.updateAvailable');
    expect(screen.getByTestId('sw-update-now')).toHaveTextContent(
      'common:outbox.notice.reloadNow',
    );
    act(() => {
      vi.advanceTimersByTime(600_000);
    });
    expect(screen.getByTestId('sw-update-notice')).toBeInTheDocument();
  });

  it('Knopf „Jetzt aktualisieren“ feuert sofort und hat ein Touch-Target ≥ 44 px', () => {
    const onUpdateNow = vi.fn();
    render(<SwUpdateNotice onUpdateNow={onUpdateNow} />);
    const button = screen.getByTestId('sw-update-now');
    expect(button).toHaveStyle({ minHeight: touchTargets.minimum });
    fireEvent.click(button);
    expect(onUpdateNow).toHaveBeenCalledTimes(1);
  });
});
