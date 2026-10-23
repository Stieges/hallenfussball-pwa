/**
 * Verbindungsanzeige im schmalen Kopf (Plan LT-2, @SL-140, @SL-168): am Handy bei Netz nur der Punkt, ohne Netz mit Wort, wartenden Einträgen
 * und „Verbinden“, während des Versuchs „Verbinde …“ in derselben Pille; „Wieder verbunden“ gibt es nicht. Das Molekül `VerbindungsStatus` hat eigene Tests.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { initRealDeI18n } from '../../../../test/realDeI18n';
import { ConnectionPill } from '../ConnectionPill';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

const zustand = vi.hoisted(() => ({ mobil: true, online: true, wartend: 0, verbinden: vi.fn(), laeuft: false, blockiert: false }));
vi.mock('../../../../hooks/useBreakpoint', () => ({ useBreakpoint: () => ({ isMobile: zustand.mobil }) }));
vi.mock('../../../../hooks/useOnlineStatus', () => ({ useOnlineStatus: () => ({ isOnline: zustand.online, wasOffline: false }) }));
vi.mock('../../../../features/match-engine/useEngineOutboxSummary', () => ({ useEngineOutboxSummary: () => ({ pendingCount: zustand.wartend, sendBlocked: zustand.blockiert }) }));
vi.mock('../../../../features/match-engine/useVerbindenVersuch', () => ({ useVerbindenVersuch: () => ({ verbinde: zustand.verbinden, laeuft: zustand.laeuft }) }));

describe('ConnectionPill', () => {
  beforeEach(() => { zustand.mobil = true; zustand.online = true; zustand.wartend = 0; zustand.verbinden = vi.fn(); zustand.laeuft = false; zustand.blockiert = false; });

  it('@SL-140 Handy mit Netz: nur der Punkt, Ansage „Verbunden“', () => {
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByRole('status')).toHaveTextContent('Verbunden');
    expect(screen.queryByText('Verbunden', { ignore: '[role="status"]' })).toBeNull();
  });

  it('@SL-140 Gegenbeispiel Tablet/Laptop mit Netz: Text „Verbunden“ sichtbar', () => {
    zustand.mobil = false;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByText('Verbunden', { ignore: '[role="status"]' })).toBeInTheDocument();
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

  it('@SL-168 nicht verbunden: „Offline“ und „Verbinden“; nach dem Netz kein „Wieder verbunden“ (auch am Handy), nur wieder der Punkt', () => {
    zustand.online = false;
    const { unmount } = render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveTextContent('Offline');
    unmount();
    zustand.online = true;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).not.toHaveTextContent(/Wieder verbunden|Offline/);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('@SL-168 Versuch läuft: in derselben Pille steht „Verbinde …“ mit „Offline“ und „3 Einträge warten“, auch wenn das Netz schon zurück ist; danach der Punkt', () => {
    zustand.online = false; zustand.wartend = 3; zustand.laeuft = true;
    const { unmount } = render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByRole('button', { name: 'Verbinde …' })).toHaveTextContent('3 Einträge warten');
    expect(screen.getByRole('status')).toHaveTextContent('Verbinde …');
    unmount();
    zustand.online = true;
    const noch = render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'offline');
    expect(screen.getByRole('button', { name: 'Verbinde …' })).toBeInTheDocument();
    noch.unmount();
    zustand.laeuft = false;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'online');
    expect(screen.getByTestId('cockpit-verbindung')).not.toHaveTextContent(/Wieder verbunden|Verbinde/);
  });

  it('@SL-168 Netz da, aber nichts kommt durch (Ausgang wartet nach Fehlschlag): die Pille „Verbinden“ mit „Offline“ und „3 Einträge warten“ erscheint, obwohl das Gerät online ist', async () => {
    zustand.online = true; zustand.blockiert = true; zustand.wartend = 3;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'offline');
    const knopf = screen.getByRole('button', { name: 'Verbinden' });
    expect(knopf).toHaveTextContent('Offline');
    expect(knopf).toHaveTextContent('3 Einträge warten');
    await userEvent.click(knopf);
    expect(zustand.verbinden).toHaveBeenCalledTimes(1);
  });

  it('@SL-168 Gegenbeispiel: online, Senden klappt oder ist nur unterwegs (nichts wartet nach Fehlschlag): keine Pille, auch mit wartenden Einträgen', () => {
    zustand.online = true; zustand.blockiert = false; zustand.wartend = 3;
    render(<ConnectionPill tournamentId="t-1" />);
    expect(screen.getByTestId('cockpit-verbindung')).toHaveAttribute('data-status', 'online');
    expect(screen.queryByRole('button')).toBeNull();
  });
});
