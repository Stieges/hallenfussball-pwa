/**
 * B-19a (@ME-003 alle drei Lagen, @OB-028; Gegenbeispiel „/“): Auf der Monitor-Route (Kiosk) erscheint keine
 * globale Einblendung – kein Offline-Hinweis, keine Einwilligung, kein Update-Hinweis, kein Dialog. Das
 * Folienprogramm bleibt sichtbar. Auf „/“ (Verwaltung) bleiben Offline-Hinweis und Einwilligung wie bisher.
 */
import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSwForTests } from '../../../lib/swRegistration';
import { __fireNeedRefresh, registerSWMock } from '../../../test/mocks/virtual-pwa-register';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';

const { monitorLoad, online } = vi.hoisted(() => ({
  monitorLoad: vi.fn(),
  online: { value: true },
}));

vi.mock('../../../hooks/useOnlineStatus', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../../hooks/useOnlineStatus')>();
  return {
    ...original,
    useOnlineStatus: () => ({ ...original.useOnlineStatus(), isOnline: online.value, wasOffline: false }),
  };
});
vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
// Die Monitor-Datenquelle wird ersetzt; die übrige App (Verwaltung, Repositories) bleibt echt.
vi.mock('../monitorDataSource', () => ({
  createLegacyMonitorSource: () => ({ fetch: monitorLoad }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});

import App from '../../../App';

function monitorTurnier() {
  return attachMonitor(buildTournament(), withMonitor({ slides: [slide('custom-text', { headline: 'Folie A' })] }));
}

async function starteKiosk(): Promise<void> {
  monitorLoad.mockResolvedValue({
    kind: 'snapshot', version: null, tournament: monitorTurnier(), monitor: monitorTurnier().monitors?.[0] ?? null,
    origin: 'local', lookupFailed: false,
  });
  render(
    <MemoryRouter initialEntries={['/display/tour-1/mon-1']}>
      <App />
    </MemoryRouter>,
  );
  await screen.findByText('Folie A');
  // Der SW-Setup-Pfad läuft über einen dynamischen Import: auf die Registrierung warten.
  await waitFor(() => expect(registerSWMock).toHaveBeenCalled());
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ohne gespeicherte Einwilligung (getItem liefert null) erscheint der Einwilligungs-Dialog.
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  online.value = true;
});

afterEach(() => {
  __resetSwForTests();
});

describe('Kiosk-Route Monitor (B-19a, @ME-003, @OB-028)', () => {
  it.each([
    ['eine neue App-Version ist erschienen', () => { act(() => { __fireNeedRefresh(); }); }],
    ['ein Dialog ist an einem anderen Gerät offen (auf dieser Seite gibt es keinen)', () => { /* kein Ereignis hier */ }],
    ['das Netz fällt aus und kehrt zurück', () => {
      online.value = false;
      act(() => { window.dispatchEvent(new Event('offline')); });
      online.value = true;
      act(() => { window.dispatchEvent(new Event('online')); });
    }],
  ])('@ME-003 Lage „%s“: kein Dialog, kein Banner, Folienprogramm sichtbar', async (_lage, ereignis) => {
    await starteKiosk();
    ereignis();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByLabelText('Offline')).toBeNull();
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  it('@ME-003 Offline auf der Monitor-Route: kein Offline-Hinweis, keine Einwilligung', async () => {
    online.value = false;
    await starteKiosk();
    expect(screen.queryByLabelText('Offline')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Gegenbeispiel „/“ (Verwaltung): Offline-Hinweis und Einwilligung bleiben', async () => {
    online.value = false;
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );
    expect(await screen.findByLabelText('Offline')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
