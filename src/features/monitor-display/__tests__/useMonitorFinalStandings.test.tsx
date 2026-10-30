/**
 * R3-7 Lesepfad des Monitors zum gespeicherten Endstand (@LZ-076, @LZ-077, @ZM-012 Z. 2, @ET-045, @ZM-180): jede Antwort hat die Form der
 * ECHTEN Server-Antwort von `display_final_standings` (`{status:'none'}` bzw. `{status:'final', finishedAt, standings}`, Torschützen
 * nur mit Schalter). Beendet bleibt beendet: Störung und unlesbare Antwort lassen den Stand stehen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { FINAL_HELD_POLL_MS, FINAL_WAIT_POLL_MS, useMonitorFinalStandings } from '../useMonitorFinalStandings';
import { serverEndstand, SERVER_NONE } from './endstandFixture';

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] }); });
afterEach(() => { vi.useRealTimers(); });

async function tick(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('useMonitorFinalStandings', () => {
  it('@LZ-076: nach dem Abschluss liest der Monitor den gespeicherten Endstand (ein Aufruf mit der Turnier-Id, sofort)', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', true, read));
    await tick(0);
    expect(read).toHaveBeenCalledWith('tour-1');
    expect(result.current.status).toBe('final');
  });

  it('@LZ-075 Gegenbeispiel: ohne Abschluss (enabled aus) wird nie gefragt und es gibt keinen Endstand', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', false, read));
    await tick(30_000);
    expect(read).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: 'none' });
  });

  it('meldet der Server erst „none“ (Abschluss gerade erst), fragt der Monitor nach 2 Sekunden erneut und zeigt dann den Endstand (≤ 10 s)', async () => {
    const read = vi.fn().mockResolvedValueOnce(SERVER_NONE).mockResolvedValue(serverEndstand());
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', true, read));
    await tick(0);
    expect(result.current.status).toBe('none');
    await tick(FINAL_WAIT_POLL_MS);
    expect(result.current.status).toBe('final');
  });

  it('@ZM-180: eine Störung lässt den Endstand stehen („nicht erreichbar“ ist nie „kein Endstand“)', async () => {
    const read = vi.fn().mockResolvedValueOnce(serverEndstand()).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', true, read));
    await tick(0);
    await tick(FINAL_HELD_POLL_MS * 2);
    expect(read.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.status).toBe('final');
  });

  it('@ZM-180: eine unlesbare Antwort lässt den Endstand stehen', async () => {
    const read = vi.fn().mockResolvedValueOnce(serverEndstand()).mockResolvedValue({ status: 'irgendwas' });
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', true, read));
    await tick(0);
    await tick(FINAL_HELD_POLL_MS);
    expect(result.current.status).toBe('final');
  });

  it('@ZM-012 Z. 2: ohne Torschützen-Schalter trägt die Antwort keine Liste – der Monitor liest „Schalter aus“', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand({ scorersPublic: false }));
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', true, read));
    await tick(0);
    expect(result.current).toMatchObject({ status: 'final', scorersPublic: false });
  });

  it('nach dem Wiederöffnen (enabled aus) gilt der alte Endstand nicht mehr', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result, rerender } = renderHook(({ on }) => useMonitorFinalStandings('tour-1', on, read), { initialProps: { on: true } });
    await tick(0);
    expect(result.current.status).toBe('final');
    rerender({ on: false });
    expect(result.current.status).toBe('none');
  });
});
