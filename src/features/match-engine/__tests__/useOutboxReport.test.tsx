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
import { resetOwnFieldsForTests } from '../../../core/fieldControl/ownFields';
import { MatchEngineContext, type MatchEngineContextValue } from '../matchEngineContextInstance';
import { OUTBOX_REPORT_INTERVAL_MS, useOutboxReport } from '../useOutboxReport';
import { useFieldControl } from '../useFieldControl';

const CLARA_FELD_2 = { field: 2, epoch: 4, holderName: 'Clara', holderRole: 'helper', holderDeviceLabel: 'phone', isMine: true, claimedAt: 1_790_000_000_000 };

let status: OutboxStatus = emptyOutboxStatus();
const sender = { getStatus: () => status, subscribe: () => () => undefined, kick: () => Promise.resolve() };
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
