/**
 * R3-2a Geräte-Meldung (Plan F3, Befund C-GERAET-STILL-OHNE-MELDUNG): `useOutboxReport` ruft alle 30 s (sichtbar, mit Netz,
 * angemeldet) `report_device_outbox` mit der Zahl wartender Einträge je Turnier – auf jedem Gerät, auch dem der Leitung.
 * Das gesteuerte Feld kommt aus dem zuletzt gelesenen Stand von `useFieldControl` (auch wenn das Cockpit danach zu ist).
 *
 * Szenarien: @LZ-018 / @FU-068 (Claras bzw. Toms Gerät an Feld 2 hat 3 Einträge noch nicht übertragen → die Warnung „Feld 2:
 * 3 Einträge noch nicht übertragen“ stammt aus dieser Meldung). Plan-Pflichttest „Gerät meldet 0 → keine Warnung ‚still‘“.
 * Gegenbeispiele: 0 wartend ohne Feld → keine Meldung; Gast, verdeckter Tab, ohne Netz → keine Meldung.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('../../../core/device/deviceId', () => ({ getDeviceId: () => 'clara-handy' }));
const server = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));

import { emptyOutboxStatus, type OutboxStatus } from '../../../core/match/client/outboxTypes';
import { ownFieldsByTournament, resetOwnFieldsForTests } from '../../../core/fieldControl/ownFields';
import { MatchEngineContext, type MatchEngineContextValue } from '../matchEngineContextInstance';
import { OUTBOX_REPORT_DEBOUNCE_MS, OUTBOX_REPORT_INTERVAL_MS, useOutboxReport } from '../useOutboxReport';
import { useFieldControl } from '../useFieldControl';

const CLARA_FELD_2 = { field: 2, epoch: 4, holderName: 'Clara', holderRole: 'helper', holderDeviceLabel: 'phone', isMine: true, claimedAt: 1_790_000_000_000 };

let status: OutboxStatus = emptyOutboxStatus();
let statusListener: ((s: OutboxStatus) => void) | null = null;
const sender = {
  getStatus: () => status,
  subscribe: (listener: (s: OutboxStatus) => void) => { statusListener = listener; return () => { statusListener = null; }; },
  kick: () => Promise.resolve(),
};
/** Der Ausgang meldet eine Änderung (wie `OutboxStatusBook` nach jedem Sende-Lauf). */
function ausgangMeldet(): void {
  act(() => { statusListener?.(status); });
}
const engine = { sender, accountId: 'clara' } as unknown as MatchEngineContextValue;
const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={engine}>{children}</MatchEngineContext.Provider>;

let sichtbar: DocumentVisibilityState = 'visible';
let online = true;
const meldungen = () => server.rpc.mock.calls.filter(([fn]) => fn === 'report_device_outbox').map(([, args]) => args as Record<string, unknown>);
const weiter = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

function wartend(pending: number): void {
  status = { ...emptyOutboxStatus(), pendingByTournament: pending > 0 ? { 'live-cup': pending } : {} };
}

beforeEach(() => {
  vi.useFakeTimers();
  sichtbar = 'visible';
  online = true;
  status = emptyOutboxStatus();
  statusListener = null;
  resetOwnFieldsForTests();
  server.rpc.mockReset();
  server.rpc.mockImplementation(async (fn: string) => (fn === 'field_control_state' ? { data: [CLARA_FELD_2], error: null } : { data: null, error: null }));
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => sichtbar);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Claras Gerät hat Feld 2 im Cockpit gelesen (Steuer), danach läuft nur noch die Meldung. */
async function claraSteuertFeld2(): Promise<void> {
  const cockpit = renderHook(() => useFieldControl('live-cup', { poll: true }), { wrapper });
  await weiter(0);
  cockpit.unmount();
}

describe('R3-2a useOutboxReport (@LZ-018, @FU-068)', () => {
  it('@LZ-018 @FU-068 Claras Gerät an Feld 2 mit 3 wartenden Einträgen meldet Feld 2 und 3 – sofort und alle 30 s', async () => {
    await claraSteuertFeld2();
    wartend(3);

    renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(0);

    expect(meldungen()).toEqual([{ p_tournament_id: 'live-cup', p_device_id: 'clara-handy', p_field: 2, p_pending: 3 }]);
    await weiter(OUTBOX_REPORT_INTERVAL_MS);
    expect(meldungen()).toHaveLength(2);
  });

  it('Pflichttest „Gerät meldet 0 → keine Warnung still“: steuerndes Gerät meldet 0 alle 30 s (letzte Meldung nie älter als 2 Minuten)', async () => {
    await claraSteuertFeld2();

    renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(0);
    await weiter(4 * OUTBOX_REPORT_INTERVAL_MS);

    expect(meldungen()).toHaveLength(5);
    expect(meldungen().every((args) => args.p_pending === 0 && args.p_field === 2)).toBe(true);
  });

  it('@FU-068 von 3 auf 0: einmal 0 gemeldet, danach Ruhe (Gerät ohne Feld)', async () => {
    wartend(3);
    renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(0);
    wartend(0);
    await weiter(OUTBOX_REPORT_INTERVAL_MS);
    await weiter(3 * OUTBOX_REPORT_INTERVAL_MS);

    expect(meldungen().map((args) => args.p_pending)).toEqual([3, 0]);
    expect(meldungen()[0]).toMatchObject({ p_field: null });
  });

  it('Gegenbeispiel: 0 wartend und kein Feld → keine Meldung', async () => {
    renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(0);
    await weiter(3 * OUTBOX_REPORT_INTERVAL_MS);

    expect(meldungen()).toEqual([]);
  });

  it('Gegenbeispiel: verdeckter Tab, ohne Netz und Gast melden nichts', async () => {
    wartend(3);
    sichtbar = 'hidden';
    const hook = renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(OUTBOX_REPORT_INTERVAL_MS);
    sichtbar = 'visible';
    online = false;
    await weiter(OUTBOX_REPORT_INTERVAL_MS);
    expect(meldungen()).toEqual([]);
    hook.unmount();

    online = true;
    renderHook(() => useOutboxReport({ sender, accountId: 'guest' }));
    await weiter(2 * OUTBOX_REPORT_INTERVAL_MS);
    expect(meldungen()).toEqual([]);
  });

  it('gescheiterte Meldung zählt nicht als gesendet: nächster Takt meldet erneut; ist bis dahin alles übertragen, bleibt es still', async () => {
    wartend(3);
    server.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(0);
    wartend(0);
    await weiter(OUTBOX_REPORT_INTERVAL_MS);
    await weiter(OUTBOX_REPORT_INTERVAL_MS);

    // 3 (gescheitert), dann 0: der Server hat noch keine Zahl, also gibt es keine Änderung zu melden
    expect(meldungen().map((args) => args.p_pending)).toEqual([3]);
  });

  it('gescheiterte Meldung bei weiter wartenden Einträgen: der nächste Takt meldet die Zahl erneut', async () => {
    wartend(3);
    server.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Failed to fetch' } });
    renderHook(() => useOutboxReport({ sender, accountId: 'clara' }));
    await weiter(0);
    await weiter(OUTBOX_REPORT_INTERVAL_MS);

    expect(meldungen().map((args) => args.p_pending)).toEqual([3, 3]);
  });
});

/**
 * R3-2b, Auflagen aus Review #392: M1 (der Server darf keine veraltete Zahl „noch nicht übertragen“ behalten – bei Änderung
 * sofort melden, beim Start abgleichen) und m1 (Feld-Stand beim Abmelden/Kontowechsel leeren). @LZ-018/@FU-068: die Warnung
 * „Feld 2: 3 Einträge noch nicht übertragen“ darf nur stehen, solange wirklich etwas wartet.
 */
describe('R3-2b Review #392 M1/m1 – keine veraltete Zahl am Server', () => {
  it('M1 @FU-068 Toms 3 Einträge sind übertragen: das Gerät meldet 0 sofort (entprellt), nicht erst nach 30 s', async () => {
    wartend(3);
    renderHook(() => useOutboxReport({ sender, accountId: 'tom' }));
    await weiter(0);
    status = { ...emptyOutboxStatus(), pendingByTournament: { 'live-cup': 0 } };
    ausgangMeldet();
    await weiter(OUTBOX_REPORT_DEBOUNCE_MS);

    expect(meldungen().map((args) => args.p_pending)).toEqual([3, 0]);
    expect(OUTBOX_REPORT_DEBOUNCE_MS).toBeLessThan(OUTBOX_REPORT_INTERVAL_MS);
  });

  it('M1 (a) Tom sperrt das Handy direkt nach dem Senden: die Änderung auf 0 wird trotzdem gemeldet (mit Netz)', async () => {
    wartend(1);
    renderHook(() => useOutboxReport({ sender, accountId: 'tom' }));
    await weiter(0);
    sichtbar = 'hidden';
    status = { ...emptyOutboxStatus(), pendingByTournament: { 'live-cup': 0 } };
    ausgangMeldet();
    await weiter(OUTBOX_REPORT_DEBOUNCE_MS);

    expect(meldungen().map((args) => args.p_pending)).toEqual([1, 0]);
  });

  it('M1 mehrere Änderungen eines Sende-Laufs ergeben eine Meldung', async () => {
    renderHook(() => useOutboxReport({ sender, accountId: 'tom' }));
    await weiter(0);
    for (const n of [3, 2, 1]) {
      status = { ...emptyOutboxStatus(), pendingByTournament: { 'live-cup': n } };
      ausgangMeldet();
      await weiter(100);
    }
    await weiter(OUTBOX_REPORT_DEBOUNCE_MS);

    expect(meldungen().map((args) => args.p_pending)).toEqual([1]);
  });

  it('M1 (b) neu geladen: das Gerät hat Kopien des Live-Cups mit 0 wartend → einmal 0 melden (Abgleich), danach Ruhe', async () => {
    status = { ...emptyOutboxStatus(), pendingByTournament: { 'live-cup': 0 } };
    renderHook(() => useOutboxReport({ sender, accountId: 'tom' }));
    await weiter(0);
    await weiter(3 * OUTBOX_REPORT_INTERVAL_MS);

    expect(meldungen()).toEqual([{ p_tournament_id: 'live-cup', p_device_id: 'clara-handy', p_field: null, p_pending: 0 }]);
  });

  it('M1 (b) die Kopien sind beim Start noch nicht gezählt: der Abgleich folgt, sobald der Ausgang sie meldet', async () => {
    renderHook(() => useOutboxReport({ sender, accountId: 'tom' }));
    await weiter(0);
    expect(meldungen()).toEqual([]);
    status = { ...emptyOutboxStatus(), pendingByTournament: { 'live-cup': 0, 'winter-cup': 0 } };
    ausgangMeldet();
    await weiter(OUTBOX_REPORT_DEBOUNCE_MS);

    expect(meldungen().map((args) => args.p_tournament_id)).toEqual(['live-cup', 'winter-cup']);
  });

  it('Gegenbeispiel M1: ein gescheiterter Abgleich (z. B. kein Recht mehr) wird nicht alle 30 s wiederholt', async () => {
    status = { ...emptyOutboxStatus(), pendingByTournament: { 'alt-cup': 0 } };
    server.rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'keine Berechtigung' } });
    renderHook(() => useOutboxReport({ sender, accountId: 'tom' }));
    await weiter(0);
    await weiter(3 * OUTBOX_REPORT_INTERVAL_MS);

    expect(meldungen()).toHaveLength(1);
  });

  it('m1 Kontowechsel: der Feld-Stand des vorigen Kontos ist weg – das neue Konto meldet kein fremdes Feld', async () => {
    await claraSteuertFeld2();
    expect(ownFieldsByTournament()).toEqual({ 'live-cup': [2] });
    const hook = renderHook(({ accountId }) => useOutboxReport({ sender, accountId }), { initialProps: { accountId: 'clara' } });
    await weiter(0);
    server.rpc.mockClear();

    hook.rerender({ accountId: 'maria' });
    await weiter(0);
    await weiter(OUTBOX_REPORT_INTERVAL_MS);

    expect(ownFieldsByTournament()).toEqual({});
    expect(meldungen()).toEqual([]);
  });

  it('m1 Abmelden (Konto → Gast): der Feld-Stand ist weg', async () => {
    await claraSteuertFeld2();
    const hook = renderHook(({ accountId }) => useOutboxReport({ sender, accountId }), { initialProps: { accountId: 'clara' } });
    await weiter(0);
    hook.rerender({ accountId: 'guest' });
    expect(ownFieldsByTournament()).toEqual({});
  });
});
