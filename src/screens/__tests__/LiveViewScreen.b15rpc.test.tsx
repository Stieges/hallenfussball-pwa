/**
 * B-15, Weg (b): die Zuschauer-Seite liest über die Server-Funktion `public_tournament` (Stub des Vertrags) – Tor → Handy
 * ohne Neuladen (@ZM-021), Restzeit unabhängig von der Uhr des Handys (@ZM-026, @ZM-025). Nikolaus-Turnier aus den echt
 * erzeugten Zeilen (`payloadFixtures.ts`), Spiel 9 läuft. Fake-Timer; die Uhr des Handys geht 40 Sekunden vor.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import type { PublicRpcArgs, PublicRpcResponse } from '../../features/public-view/rpcPublicSource';

const { rpcCall } = vi.hoisted(() => ({ rpcCall: vi.fn<(args: PublicRpcArgs) => Promise<PublicRpcResponse>>() }));
vi.mock('../../features/public-view/defaultPublicSource', async () => {
  const { createRpcPublicSource } = await import('../../features/public-view/rpcPublicSource');
  return { defaultPublicTournamentSource: createRpcPublicSource({ call: rpcCall }) };
});

import { LiveViewScreen } from '../LiveViewScreen';
import { RepositoryProvider } from '../../core/contexts/RepositoryContext';
import { deltaOneGoalReply, fullReply, RUNNING_MATCH_NUMBER, STUB_VERSION, unchangedReply } from '../../features/public-view/__tests__/payloadFixtures';

vi.unmock('i18next'); vi.unmock('react-i18next');
await (await import('../../test/realDeI18n')).initRealDeI18n();

const TAKT = 10_000;
const PHONE_AHEAD_MS = 40_000;
const PLAYED_BEFORE_FETCH_MS = 253_000;
const SINCE_ANCHOR_MS = 61_000;

type Row = Record<string, unknown>;

/** Serverzeit aus Sicht des Stubs: die Uhr des Handys geht 40 Sekunden vor. */
const serverNow = (): number => Date.now() - PHONE_AHEAD_MS;

/** Voll-Antwort, in der Spiel 9 vor 61 Sekunden (Serverzeit) angepfiffen wurde; `liveState` überschreibt den Feinstatus. */
function fullNow(liveState: Row = {}, version = STUB_VERSION): Row {
  const reply = fullReply(version);
  reply.server_now = serverNow();
  reply.matches = (reply.matches as Row[]).map((m) => (Number(m.match_number) === RUNNING_MATCH_NUMBER
    ? { ...m, live_state: { ...(m.live_state as Row), elapsedMs: PLAYED_BEFORE_FETCH_MS, anchorAt: serverNow() - SINCE_ANCHOR_MS, ...liveState } }
    : m));
  return reply;
}

const spiel9 = () => ({ clock: screen.getAllByTestId('match-clock')[0].textContent });

/** Tore der Heimseite des laufenden Spiels (die Karte mit der Restzeit). */
const heimTore = (): Array<string | null> => {
  const card = screen.getAllByTestId('match-clock')[0].closest('[data-match-card]');
  return Array.from(card?.querySelectorAll('[data-testid^="match-goals-"][data-testid$="-home"]') ?? []).map((el) => el.textContent);
};

async function advance(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-21T10:00:00Z'));
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
});

function seite() {
  return render(
    <RepositoryProvider user={null}>
      <MemoryRouter initialEntries={['/live/NIK6ST']}>
        <LiveViewScreen shareCode="NIK6ST" />
      </MemoryRouter>
    </RepositoryProvider>,
  );
}

describe('Weg (b) an der Zuschauer-Seite', () => {
  it('@ZM-026 @ZM-025 Handy-Uhr 40 s vor: die Restzeit von Spiel 9 stimmt (314 s von 600 s gespielt = 4:46) und zählt weiter herunter', async () => {
    rpcCall.mockImplementation(() => Promise.resolve({ data: fullNow(), error: null }));
    seite();
    await advance(0);
    // gespielt: 253 s + 61 s seit dem Anpfiff der Uhr = 314 s von 600 s → Restzeit 4:46 (mit der falschen Handy-Uhr stünde 4:06 da)
    expect(spiel9().clock).toMatch(/^4:(46|45)$/);
    await advance(7000);
    expect(spiel9().clock).toMatch(/^4:(39|38)$/);
  });

  it('@ZM-027 zwischen zwei Abrufen zählt die Restzeit nicht unter 0:00: letzter Abruf 0:05, 8 Sekunden ohne Abruf → 0:00, keine negative Restzeit', async () => {
    // 595 s von 600 s gespielt, die Uhr läuft; Abschnitte: 2 (1. Halbzeit), also keine „Spielzeit abgelaufen“-Meldung
    rpcCall.mockImplementation(() => Promise.resolve({ data: fullNow({ elapsedMs: 595_000, anchorAt: serverNow(), sections: 2, sectionSeconds: 600 }), error: null }));
    seite();
    await advance(0);
    expect(spiel9().clock).toBe('0:05');
    await advance(8000);
    expect(spiel9().clock).toBe('0:00');
    expect(document.body.textContent).not.toMatch(/-\d:\d\d/);
  });

  it('@ZM-028 nach einer angehaltenen Uhr springt die Restzeit beim nächsten Abruf zurück: lokal 2:13, der Abruf meldet 2:20 angehalten', async () => {
    // Abruf 1: läuft, Restzeit 2:22 (458 s von 600 s gespielt); Tom hält die Uhr bei 2:20 an (460 s)
    let angehalten = false;
    rpcCall.mockImplementation(() => Promise.resolve({
      data: angehalten
        ? fullNow({ status: 'paused', elapsedMs: 460_000, anchorAt: null, sections: 2, sectionSeconds: 600 }, STUB_VERSION + 1)
        : fullNow({ elapsedMs: 458_000, anchorAt: serverNow(), sections: 2, sectionSeconds: 600 }),
      error: null,
    }));
    seite();
    await advance(0);
    expect(spiel9().clock).toBe('2:22');
    await advance(9000);
    expect(spiel9().clock).toBe('2:13');
    angehalten = true;
    await advance(1000); // der nächste Abruf nach 10 Sekunden
    expect(spiel9().clock).toBe('2:20');
    expect(screen.getAllByTestId('match-clock')[0].getAttribute('data-stopped')).toBe('true');
  });

  it('@ZM-021 Tom trägt in Spiel 9 ein Tor ein: nach höchstens 10 Sekunden steht 2:0 da, über ein Delta, ohne Neuladen', async () => {
    let tor = false;
    rpcCall.mockImplementation((args) => {
      if (args.since_version === null) {
        return Promise.resolve({ data: fullNow(), error: null });
      }
      return Promise.resolve({ data: tor ? { ...deltaOneGoalReply(args.since_version), server_now: serverNow() } : { ...unchangedReply(args.since_version), server_now: serverNow() }, error: null });
    });
    seite();
    await advance(0);
    expect(heimTore()).toEqual(['1']);

    tor = true;
    await advance(TAKT - 1);
    expect(heimTore()).toEqual(['1']);
    await advance(1);
    expect(heimTore()).toEqual(['2']);
    expect(rpcCall.mock.calls.map(([args]) => args.since_version)).toEqual([null, STUB_VERSION]);
  });

  it('@ZM-109 Gegenbeispiel: antwortet der Server mit einem Fehler, bleibt der Stand stehen und die Seite sagt nicht „nicht gefunden“', async () => {
    let ok = true;
    rpcCall.mockImplementation(() => (ok ? Promise.resolve({ data: fullNow(), error: null }) : Promise.resolve({ data: null, error: { message: 'upstream request timeout', code: '504' } })));
    seite();
    await advance(0);
    const vorher = heimTore();
    ok = false;
    await advance(3 * TAKT);
    expect(screen.queryByText('Turnier nicht gefunden')).toBeNull();
    expect(heimTore()).toEqual(vorher);
    expect(screen.getByTestId('public-connection-hint')).toBeTruthy();
  });

  it('@ZM-109 nur „not_found“ vom Server zeigt „Turnier nicht gefunden“', async () => {
    rpcCall.mockResolvedValue({ data: { state: 'not_found' }, error: null });
    seite();
    await advance(0);
    expect(screen.getByText('Turnier nicht gefunden')).toBeTruthy();
  });
});
