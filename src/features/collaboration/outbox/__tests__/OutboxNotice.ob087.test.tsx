/**
 * @OB-087 Zeile 3: Toms Sitzung ist abgelaufen, 3 Einträge warten auf seinem Gerät. Am Hinweis steht „Anmelden“ (mindestens 44 Bildpunkte hoch);
 * ein Tipp öffnet die Anmeldung. Gegenbeispiele: ohne abgelaufene Sitzung keine Taste; „App aktualisieren“ trägt „Jetzt aktualisieren“, nicht „Anmelden“.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { emptyOutboxStatus, type OutboxStatus } from '../../../../core/match/client/outboxTypes';
import { touchTargets } from '../../../../design-tokens';
import { OutboxNotice } from '../OutboxNotice';

const status = (over: Partial<OutboxStatus>): OutboxStatus => ({ ...emptyOutboxStatus(), ...over });

describe('@OB-087 Zeile 3 – „Anmelden“ am Hinweis bei abgelaufener Sitzung', () => {
  it('@OB-087 Zeile 3: bei authRequired steht „Anmelden“ (≥ 44 px) am Hinweis, und ein Tipp ruft die Anmeldung auf', () => {
    const onLogin = vi.fn();
    render(<OutboxNotice status={status({ authRequired: true, pendingByMatch: { m1: 3 } })} matchId="m1" onReload={vi.fn()} onLogin={onLogin} />);
    const taste = screen.getByTestId('outbox-notice-login');
    expect(taste).toHaveTextContent('common:actions.login');
    expect(taste).toHaveStyle({ minHeight: touchTargets.minimum });
    fireEvent.click(taste);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('@OB-087 Zeile 3 Gegenbeispiel: ohne abgelaufene Sitzung gibt es keine „Anmelden“-Taste (Spiel noch nicht bereit, App veraltet)', () => {
    const { rerender } = render(<OutboxNotice status={status({ pausedMatches: { m1: 'notReady' } })} matchId="m1" onReload={vi.fn()} onLogin={vi.fn()} />);
    expect(screen.getByTestId('outbox-notice')).toHaveAttribute('data-kind', 'notReady');
    expect(screen.queryByTestId('outbox-notice-login')).toBeNull();
    rerender(<OutboxNotice status={status({ clientOutdated: true })} matchId="m1" onReload={vi.fn()} onLogin={vi.fn()} />);
    expect(screen.queryByTestId('outbox-notice-login')).toBeNull();
    expect(screen.getByTestId('outbox-notice-reload')).toBeInTheDocument();
  });

  it('@OB-087 Zeile 3 Gegenbeispiel: ohne Anmelde-Funktion (Aufrufer ohne Router) bleibt es beim Text', () => {
    render(<OutboxNotice status={status({ authRequired: true })} matchId="m1" onReload={vi.fn()} />);
    expect(screen.getByTestId('outbox-notice')).toHaveAttribute('data-kind', 'authRequired');
    expect(screen.queryByTestId('outbox-notice-login')).toBeNull();
  });
});
