/**
 * H4-5 geteilte Abfrage `hall_sound_status` je Turnier: drei Einbindungen → eine Abfrage; die letzte Abmeldung beendet sie.
 * Über den echten Hook `useHallStatus` mit gezähltem RPC-Doppel und falscher Zeit.
 */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const rpc = vi.hoisted(() => ({ aufrufe: [] as string[] }));
vi.mock('../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));
vi.mock('../../../core/device/deviceId', () => ({ getDeviceId: () => 'geraet-1' }));
vi.mock('../../../core/repositories/hallentonRpc', () => ({
  hallSoundStatus: (_c: unknown, args: { p_tournament_id: string }) => {
    rpc.aufrufe.push(args.p_tournament_id);
    return Promise.resolve({ ok: true, sicht: 'schmal', serverNow: 1, speakers: [] });
  },
  hallOutputHeard: vi.fn(), hallTestToneRequest: vi.fn(),
}));

import { useHallStatus } from '../useHallStatus';

beforeEach(() => { vi.useFakeTimers(); rpc.aufrufe.length = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('H4-5 eine Abfrage je Turnier', () => {
  it('drei Einbindungen desselben Turniers → eine Abfrage je Takt (nicht drei)', async () => {
    const a = renderHook(() => useHallStatus('t1'));
    const b = renderHook(() => useHallStatus('t1'));
    const c = renderHook(() => useHallStatus('t1'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(rpc.aufrufe).toHaveLength(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(rpc.aufrufe).toHaveLength(3); // Start + zwei Takte à 5 s
    expect(a.result.current.stand).toBe('aktuell');
    expect(c.result.current.stand).toBe('aktuell');
    a.unmount(); b.unmount(); c.unmount();
  });

  it('die letzte Abmeldung beendet die Abfrage; eine Einbindung weniger tut es nicht', async () => {
    const a = renderHook(() => useHallStatus('t2'));
    const b = renderHook(() => useHallStatus('t2'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    a.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(rpc.aufrufe).toHaveLength(2); // läuft weiter
    b.unmount();
    const bis = rpc.aufrufe.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(rpc.aufrufe).toHaveLength(bis); // beendet
  });

  it('Turniere sind getrennt: je Turnier eine Abfrage', async () => {
    const a = renderHook(() => useHallStatus('t3'));
    const b = renderHook(() => useHallStatus('t4'));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect([...rpc.aufrufe].sort()).toEqual(['t3', 't4']);
    a.unmount(); b.unmount();
  });
});
