/**
 * Task C2b, Aufgabe 4b: Status-Hinweis des Ausgangs.
 * Prioritaet: clientOutdated > authRequired > notReady > review.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OutboxStatus } from '../../../../core/match/client/outboxTypes';
import { emptyOutboxStatus } from '../../../../core/match/client/outboxTypes';
import { touchTargets } from '../../../../design-tokens';
import { OutboxNotice } from '../OutboxNotice';

function makeStatus(overrides: Partial<OutboxStatus> = {}): OutboxStatus {
  return { ...emptyOutboxStatus(), ...overrides };
}

function renderNotice(status: OutboxStatus, onReload = vi.fn(), matchId = 'm1') {
  render(<OutboxNotice status={status} matchId={matchId} onReload={onReload} />);
  return { onReload };
}

describe('OutboxNotice', () => {
  it('ohne Hinweis rendert nichts', () => {
    const { container } = render(<OutboxNotice status={makeStatus()} matchId="m1" onReload={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('clientOutdated hat Vorrang und zeigt den Aktualisieren-Knopf', () => {
    const { onReload } = renderNotice(
      makeStatus({
        clientOutdated: true,
        authRequired: true,
        pausedMatches: { m1: 'notReady' },
        reviewByMatch: { m1: 2 },
      }),
    );
    const notice = screen.getByTestId('outbox-notice');
    expect(notice).toHaveAttribute('data-kind', 'clientOutdated');
    expect(notice).toHaveTextContent('common:outbox.notice.clientOutdated');

    const button = screen.getByTestId('outbox-notice-reload');
    expect(button).toHaveTextContent('common:outbox.notice.reloadNow');
    expect(button).toHaveStyle({ minHeight: touchTargets.minimum });
    fireEvent.click(button);
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('authRequired kommt vor notReady und review', () => {
    renderNotice(
      makeStatus({
        authRequired: true,
        pausedMatches: { m1: 'notReady' },
        reviewByMatch: { m1: 2 },
      }),
    );
    const notice = screen.getByTestId('outbox-notice');
    expect(notice).toHaveAttribute('data-kind', 'authRequired');
    expect(notice).toHaveTextContent('common:outbox.notice.authRequired');
  });

  it('notReady (Teams offen) kommt vor review', () => {
    renderNotice(makeStatus({ pausedMatches: { m1: 'notReady' }, reviewByMatch: { m1: 2 } }));
    const notice = screen.getByTestId('outbox-notice');
    expect(notice).toHaveAttribute('data-kind', 'notReady');
    expect(notice).toHaveTextContent('common:outbox.notice.notReady');
  });

  it('backoff pausiert das Spiel nicht als notReady', () => {
    renderNotice(makeStatus({ pausedMatches: { m1: 'backoff' } }));
    expect(screen.queryByTestId('outbox-notice')).toBeNull();
  });

  it('review zeigt die Anzahl der wartenden Eintraege', () => {
    renderNotice(makeStatus({ reviewByMatch: { m1: 3 } }));
    const notice = screen.getByTestId('outbox-notice');
    expect(notice).toHaveAttribute('data-kind', 'review');
    expect(notice).toHaveTextContent('common:outbox.notice.review');
  });

  it('ohne matchId zaehlt review ueber alle Spiele', () => {
    render(
      <OutboxNotice
        status={makeStatus({ reviewByMatch: { m1: 3, m2: 2 } })}
        onReload={vi.fn()}
      />,
    );
    expect(screen.getByTestId('outbox-notice')).toHaveAttribute('data-kind', 'review');
  });
});
