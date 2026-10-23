/**
 * B-49 Fixrunde (Review #341 N3): Abfrage-Takt der Steuer je Feld (`useFieldControl`): beim Öffnen und alle 5 s, im Hintergrund
 * und ohne Netz keine Anfrage, beim Zurückkehren sofort, beim Verlassen (Aushängen) aufgeräumt. Der Spielplan liest ohne Takt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('../../../core/device/deviceId', () => ({ getDeviceId: () => 'olli-tablet' }));
const server = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { rpc: server.rpc } }));

import { MatchEngineContext, type MatchEngineContextValue } from '../matchEngineContextInstance';
import { FIELD_CONTROL_POLL_MS, useFieldControl } from '../useFieldControl';

const engine = { sender: { subscribe: () => () => undefined, kick: () => Promise.resolve() }, accountId: 'olli' } as unknown as MatchEngineContextValue;
const wrapper = ({ children }: { children: ReactNode }) => <MatchEngineContext.Provider value={engine}>{children}</MatchEngineContext.Provider>;

let sichtbar: DocumentVisibilityState = 'visible';
let online = true;
const lesungen = () => server.rpc.mock.calls.filter(([fn]) => fn === 'field_control_state').length;
const weiter = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

beforeEach(() => {
  vi.useFakeTimers();
  sichtbar = 'visible';
  online = true;
  server.rpc.mockReset();
  server.rpc.mockResolvedValue({ data: [], error: null });
  vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => sichtbar);
  vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useFieldControl: Abfrage-Takt (N3)', () => {
  it('liest beim Öffnen und danach alle 5 Sekunden', async () => {
    renderHook(() => useFieldControl('live-cup'), { wrapper });
    await weiter(0);
    expect(lesungen()).toBe(1);
    await weiter(FIELD_CONTROL_POLL_MS);
    expect(lesungen()).toBe(2);
    await weiter(2 * FIELD_CONTROL_POLL_MS);
    expect(lesungen()).toBe(4);
  });

  it('im Hintergrund (Tab verdeckt) keine Anfrage; zurück im Vordergrund sofort', async () => {
    renderHook(() => useFieldControl('live-cup'), { wrapper });
    await weiter(0);
    sichtbar = 'hidden';
    await weiter(3 * FIELD_CONTROL_POLL_MS);
    expect(lesungen()).toBe(1);
    sichtbar = 'visible';
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await weiter(0);
    expect(lesungen()).toBe(2);
  });

  it('ohne Netz keine Anfrage; beim Wiederverbinden sofort', async () => {
    renderHook(() => useFieldControl('live-cup'), { wrapper });
    await weiter(0);
    online = false;
    await weiter(2 * FIELD_CONTROL_POLL_MS);
    expect(lesungen()).toBe(1);
    online = true;
    act(() => { window.dispatchEvent(new Event('online')); });
    await weiter(0);
    expect(lesungen()).toBe(2);
  });

  it('beim Verlassen des Cockpits (Aushängen) aufgeräumt: kein Takt, keine Reaktion auf Vordergrund oder Netz', async () => {
    const hook = renderHook(() => useFieldControl('live-cup'), { wrapper });
    await weiter(0);
    hook.unmount();
    await weiter(3 * FIELD_CONTROL_POLL_MS);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('online'));
    });
    await weiter(0);
    expect(lesungen()).toBe(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('Gegenbeispiel Spielplan (`poll: false`): kein Takt, nur auf Anfrage', async () => {
    const hook = renderHook(() => useFieldControl('live-cup', { poll: false }), { wrapper });
    await weiter(3 * FIELD_CONTROL_POLL_MS);
    expect(lesungen()).toBe(0);
    await act(async () => { await hook.result.current.refresh(); });
    expect(lesungen()).toBe(1);
  });
});
