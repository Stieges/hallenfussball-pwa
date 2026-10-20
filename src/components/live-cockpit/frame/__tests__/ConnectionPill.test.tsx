/**
 * Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140, @SL-168): am Handy bei Netz nur der Punkt, ohne Netz mit Wort, wartenden Einträgen
 * und „Verbinden“; nach der Rückkehr kurz „Wieder verbunden“. Das Molekül `VerbindungsStatus` hat eigene Tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ConnectionPill } from '../ConnectionPill';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const zustand = vi.hoisted(() => ({ mobil: true, online: true, wasOffline: false, wartend: 0, verbinden: vi.fn() }));
vi.mock('../../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: zustand.mobil }) }));
vi.mock('../../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: zustand.online, wasOffline: zustand.wasOffline }) }));
vi.mock('../../../../features/match-engine/useEngineOutboxSummary', () => ({ useEngineOutboxSummary: () => ({ pendingCount: zustand.wartend }) }));
vi.mock('../../../../features/match-engine/useVerbinden', () => ({ useVerbinden: () => zustand.verbinden }));

describe('ConnectionPill', () => {
  beforeEach(() => { zustand.mobil = true; zustand.online = true; zustand.wasOffline = false; zustand.wartend = 0; zustand.verbinden = vi.fn(); });

  it('@SL-140 Handy mit Netz: nur der Punkt, zugänglicher Name „Online“', () => {
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByRole('status')).toHaveTextContent('Online');
    expect(screen.queryByText('Online', { ignore: '[role="status"]' })).toBeNull();
  });

  it('@SL-140 Gegenbeispiel Tablet/Laptop mit Netz: Text „Online“ sichtbar', () => {
    zustand.mobil = false;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByText('Online', { ignore: '[role="status"]' })).toBeInTheDocument();
  });

  it('@SL-168 ohne Netz mit 3 wartenden Einträgen: „Offline“, „3 Einträge warten“, Tippen auf „Verbinden“ stößt die Übertragung an', async () => {
    zustand.online = false; zustand.wartend = 3;
    render(<ConnectionPill tournamentId="t-1" />);
    const pille = screen.getByTestId('cockpit-verbindung');
    expect(pille).toHaveTextContent('Offline');
    expect(pille).toHaveTextContent('3 Einträge warten');
    await userEvent.click(screen.getByRole('button', { name: 'Verbinden' }));
    expect(zustand.verbinden).toHaveBeenCalledTimes(1);
  });

  it('@SL-168 N1 Handy ohne Netz: eine einzige Pille als Knopf, role="status" nicht um den Knopf (Kopf wird nicht höher)', () => {
    zustand.online = false; zustand.wartend = 3;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Offline, 3 Einträge warten');
    expect(screen.getByRole('button', { name: 'Verbinden' }).closest('[role="status"]')).toBeNull();
  });

  it('@SL-168 Gegenbeispiel: mit Netz zeigt der Kopf keinen Knopf „Verbinden“', () => {
    zustand.mobil = false;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.queryByRole('button', { name: 'Verbinden' })).toBeNull();
  });

  it('@SL-168 ist das Netz zurück, steht kurz „Wieder verbunden“ (auch am Handy), sonst bleibt „Offline“', () => {
    zustand.wasOffline = true;
    const { unmount } = render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveTextContent('Wieder verbunden');
    unmount();
    zustand.online = false; zustand.wasOffline = false;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveTextContent('Offline');
    expect(screen.getByTestId('cockpit-verbindung')).not.toHaveTextContent('Wieder verbunden');
  });
});
