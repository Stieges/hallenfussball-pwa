/**
 * B-19a (@ME-003 alle drei Lagen, @OB-028; Gegenbeispiel „/“): Auf der Monitor-Route (Kiosk) erscheint keine
 * globale Einblendung – kein Offline-Hinweis, keine Einwilligung, kein Update-Hinweis, kein Dialog. Das
 * Folienprogramm bleibt sichtbar. Auf „/“ (Verwaltung) bleiben Offline-Hinweis und Einwilligung wie bisher.
 */
import 'fake-indexeddb/auto';
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetSwForTests } from '../../../lib/swRegistration';
import { __fireNeedRefresh, registerSWMock } from '../../../test/mocks/virtual-pwa-register';
import { attachMonitor, buildTournament, slide, withMonitor } from './monitorFixture';

const { monitorLoad, online } = vi.hoisted(() => ({
  monitorLoad: vi.fn(),
  online: { value: true },
}));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: false,
  supabase: { rpc: vi.fn().mockResolvedValue({ data: null, error: null }), from: vi.fn() },
}));
// Die Monitor-Datenquelle wird ersetzt; die übrige App (Verwaltung, Repositories) bleibt echt.
vi.mock('../monitorDataSource', () => ({
  createMonitorSource: () => ({ fetch: monitorLoad }),
}));
vi.mock('qrcode.react', async () => {
  const React = await import('react');
  return {
    QRCodeSVG: ({ value }: { value: string }) => React.createElement('svg', { 'data-testid': 'qr-code', 'data-value': value }),
  };
});

import App from '../../../App';

/**
 * Wartebudget je asynchroner Abfrage (waitFor/findBy). Die Monitor-Seite wird per Lazy-Import geladen; unter Last
 * (parallele Testläufe) überschreitet das den Standard von 1000 ms. starteKiosk() wartet zweimal, daher liegt die
 * Testgrenze der Datei bei 15 s (siehe describe), das Modul ist in beforeAll vorgewärmt. Die Erwartungen bleiben gleich.
 */
const LADEZEIT = { timeout: 5000 };

function monitorTurnier() {
  return attachMonitor(buildTournament(), withMonitor({ slides: [slide('custom-text', { headline: 'Folie A' })] }));
}

function monitorSnapshot() {
  const tournament = monitorTurnier();
  return { kind: 'snapshot', version: null, tournament, monitor: tournament.monitors?.[0] ?? null, origin: 'local', lookupFailed: false };
}

/** Rendert die App auf der angegebenen Adresse und wartet, bis der SW-Setup-Pfad (dynamischer Import) steht. */
async function rendere(adresse: string): Promise<void> {
  render(
    <MemoryRouter initialEntries={[adresse]}>
      <App />
    </MemoryRouter>,
  );
  await waitFor(() => expect(registerSWMock).toHaveBeenCalled(), LADEZEIT);
}

async function starteKiosk(): Promise<void> {
  monitorLoad.mockResolvedValue(monitorSnapshot());
  await rendere('/display/tour-1/mon-1');
  await screen.findByText('Folie A', {}, LADEZEIT);
}

/** Netz wechselt: navigator.onLine plus das passende Ereignis, so wie der Browser es meldet. */
function setzeNetz(an: boolean): void {
  online.value = an;
  act(() => { window.dispatchEvent(new Event(an ? 'online' : 'offline')); });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Ohne gespeicherte Einwilligung (getItem liefert null) erscheint der Einwilligungs-Dialog.
  vi.mocked(localStorage.getItem).mockReturnValue(null);
  online.value = true;
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => online.value });
});

afterEach(() => {
  __resetSwForTests();
});

describe('Kiosk-Route Monitor (B-19a, @ME-003, @OB-028)', { timeout: 15_000 }, () => {
  // Lazy-Modul der Monitor-Seite vorwärmen, damit kein einzelner Test den Kaltstart bezahlt.
  beforeAll(async () => {
    await import('../index');
  }, 30_000);

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

  // W1: Die Version kommt, bevor die Monitor-Seite das Neulade-Tor setzt (Erstabruf). Der Hinweis
  // (role="status", testid sw-update-notice) darf dann nicht erscheinen.
  it('@ME-003 Lage „neue App-Version“ vor dem Aufbau der Seite: kein Update-Hinweis', async () => {
    monitorLoad.mockResolvedValue(monitorSnapshot());
    await rendere('/display/tour-1/mon-1');
    act(() => { __fireNeedRefresh(); });
    expect(await screen.findByText('Folie A', {}, LADEZEIT)).toBeInTheDocument();
    expect(screen.queryByTestId('sw-update-notice')).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  // W2: Netz kommt zurück → der grüne Hinweis „verbunden“ darf auf dem Monitor nicht erscheinen.
  it('@ME-003 Lage „das Netz fällt aus und kehrt zurück“: kein Hinweis über dem Bild', async () => {
    await starteKiosk();
    setzeNetz(false);
    setzeNetz(true);
    expect(screen.queryByLabelText('Connected')).toBeNull();
    expect(screen.queryByLabelText('Offline')).toBeNull();
    expect(screen.getByText('Folie A')).toBeInTheDocument();
  });

  // W2: Speicherwarnung (role="alert") auf dem Monitor – wird trotz Ereignis nicht eingeblendet.
  it('@ME-003 Speicherwarnung auf der Monitor-Route: keine Warnung über dem Bild', async () => {
    await starteKiosk();
    act(() => {
      window.dispatchEvent(new CustomEvent('storage-quota-warning', { detail: { message: 'Speicher voll', timestamp: 1 } }));
    });
    expect(screen.queryByText('Speicher voll')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Gegenbeispiel „/“ (Verwaltung): Offline-Hinweis und Einwilligung bleiben', async () => {
    online.value = false;
    await rendere('/');
    expect(await screen.findByTestId('offline-banner', {}, LADEZEIT)).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  // Gegenproben zu W1/W2: auf „/“ erscheinen die Hinweise tatsächlich (sonst wäre die Kiosk-Prüfung leer).
  it('Gegenbeispiel „/“: neue Version zeigt den Update-Hinweis; Netzrückkehr zeigt „verbunden“', async () => {
    await rendere('/');
    act(() => { __fireNeedRefresh(); });
    expect(await screen.findByTestId('sw-update-notice', {}, LADEZEIT)).toBeInTheDocument();
    setzeNetz(false);
    setzeNetz(true);
    expect(await screen.findByLabelText('Connected', {}, LADEZEIT)).toBeInTheDocument();
  });

  it('Gegenbeispiel „/“: Speicherwarnung erscheint', async () => {
    await rendere('/');
    act(() => {
      window.dispatchEvent(new CustomEvent('storage-quota-warning', { detail: { message: 'Speicher voll', timestamp: 1 } }));
    });
    expect(await screen.findByText('Speicher voll', {}, LADEZEIT)).toBeInTheDocument();
  });
});
