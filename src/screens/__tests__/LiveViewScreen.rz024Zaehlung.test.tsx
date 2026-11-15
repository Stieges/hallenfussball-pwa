/**
 * @RZ-024 @RZ-026 @RZ-028 Die Zuschauer-Seite `/live/:shareCode` zählt sich selbst, aber nur nach erfolgreichem Laden, und das Zählen
 * stört sie nie (Server nimmt die Meldung nicht an oder antwortet gar nicht → Spielplan so schnell wie ohne Zählung, kein Hinweis).
 * Server-Funktion `public_tournament` als Stub (`payloadFixtures.ts`), Versandweg der Zählung als Attrappe.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';

import type { PublicRpcArgs, PublicRpcResponse } from '../../features/public-view/rpcPublicSource';
import type { ViewCountArgs } from '../../core/viewCount/publicViewCount';

const { rpcCall, zaehlWeg } = vi.hoisted(() => ({
  rpcCall: vi.fn<(args: PublicRpcArgs) => Promise<PublicRpcResponse>>(),
  zaehlWeg: vi.fn<(args: ViewCountArgs, signal: AbortSignal) => Promise<unknown>>(),
}));
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createRpcPublicSource } = await import('../../features/public-view/rpcPublicSource');
  return { defaultPublicTournamentSource: createRpcPublicSource({ call: rpcCall }) };
});
vi.mock('../../features/public-view/viewCountTransport', () => ({ defaultViewCountTransport: zaehlWeg }));

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { fullReply } from '../../features/public-view/__tests__/payloadFixtures';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

function Ort() { const l = useLocation(); return <span data-testid="ort">{`${l.pathname}${l.search}`}</span>; }
const ort = (): string => screen.getByTestId('ort').textContent ?? '';

async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
function seite(adresse: string) {
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={[adresse]}>
        <Ort />
        <LiveViewScreen shareCode="NIK6ST" />
      </MemoryRouter>
    </RepositoryProvider>,
  );
}
const aufrufe = () => zaehlWeg.mock.calls.map((c) => c[0]).filter((a) => a.p_art === 'aufruf');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-21T10:00:00Z'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  localStorage.clear();
  zaehlWeg.mockImplementation(() => Promise.resolve(null));
});
afterEach(() => { vi.useRealTimers(); });

describe('@RZ-024 Zuschauer-Seite zählt nach dem Laden', () => {
  it('geladenes öffentliches Turnier über /live/NIK6ST?k=q: genau ein Aufruf mit Kanal qr, Zusatz aus der Adresse entfernt', async () => {
    rpcCall.mockResolvedValue({ data: fullReply(), error: null });
    seite('/live/NIK6ST?k=q');
    await advance(0);
    expect(screen.getAllByTestId('match-clock').length).toBeGreaterThan(0);
    expect(aufrufe()).toEqual([{ p_share_code: 'NIK6ST', p_art: 'aufruf', p_kanal: 'qr', p_geraet: expect.any(String), p_installiert: false }]);
    expect(ort()).toBe('/live/NIK6ST');
    await advance(30_000);
    expect(aufrufe()).toHaveLength(1);
  });
});

describe('@RZ-028 nicht gezählt, was nicht geladen ist', () => {
  it('Code unbekannt oder nicht öffentlich ({state: not_found}): kein Aufruf, kein Lebenszeichen', async () => {
    rpcCall.mockResolvedValue({ data: { state: 'not_found' }, error: null });
    seite('/live/NIK6ST?k=q');
    await advance(3 * 60_000);
    expect(zaehlWeg).not.toHaveBeenCalled();
  });

  it('Server nicht erreichbar (Fehler beim Laden): nichts gezählt', async () => {
    rpcCall.mockResolvedValue({ data: null, error: { message: 'down' } });
    seite('/live/NIK6ST');
    await advance(3 * 60_000);
    expect(zaehlWeg).not.toHaveBeenCalled();
  });
});

describe('@RZ-026 Das Zählen stört die Zuschauer-Seite nie', () => {
  it.each([
    ['nimmt Zählmeldungen nicht an (404)', () => Promise.reject(new Error('404 PGRST202'))],
    ['antwortet nicht (10 Sekunden und länger)', () => new Promise<never>(() => undefined)],
  ])('Server %s: Spielplan steht ohne Verzögerung, kein Hinweis, kein Fehler, kein Wiederholen', async (_name, antwort) => {
    const fehler = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    rpcCall.mockResolvedValue({ data: fullReply(), error: null });
    zaehlWeg.mockImplementation(antwort);
    seite('/live/NIK6ST?k=l');
    await advance(0);
    expect(screen.getAllByTestId('match-clock').length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByTestId('public-connection-hint')).toBeNull();
    await advance(10_000);
    expect(aufrufe()).toHaveLength(1);
    expect(screen.getAllByTestId('match-clock').length).toBeGreaterThan(0);
    expect(fehler).not.toHaveBeenCalled();
    fehler.mockRestore();
  });
});
