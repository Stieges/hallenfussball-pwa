/**
 * R3-7 Lesepfad des Monitors zum gespeicherten Endstand (@LZ-076, @LZ-077, @ZM-012 Z. 2, @ET-045, @ZM-180, @ZM-121 Z. 1/2): jede Antwort
 * hat die Form der ECHTEN Server-Antwort von `display_final_standings(tournament_id, monitor_id)` (Migration 20261118_008:
 * `{status:'none'}` bzw. `{status:'final', finishedAt, standings}`, Torschützen nur mit Schalter; nach dem Wiederöffnen über den
 * Betreiber dieselbe Antwort wie vorher). Beendet bleibt beendet: Störung und unlesbare Antwort lassen den Stand stehen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { FINAL_HELD_POLL_MS, FINAL_WAIT_POLL_MS, useMonitorFinalStandings, type FinalStandingsAsk } from '../useMonitorFinalStandings';
import { serverEndstand, SERVER_NONE } from './endstandFixture';

beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] }); });
afterEach(() => { vi.useRealTimers(); });

async function tick(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

describe('useMonitorFinalStandings', () => {
  it('@LZ-076 @ZM-121 Z. 1: nach dem Abschluss liest der Monitor den gespeicherten Endstand über seinen Link (Turnier + Monitor-Kennung, sofort)', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'finished', read));
    await tick(0);
    expect(read).toHaveBeenCalledWith('tour-1', 'mon-1');
    expect(result.current.status).toBe('final');
  });

  it('aus (Kindermodus, nur auf diesem Gerät): es wird nie gefragt und es gibt keinen Endstand', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'off', read));
    await tick(30_000);
    expect(read).not.toHaveBeenCalled();
    expect(result.current).toEqual({ status: 'none' });
  });

  it('@LZ-075: vor dem Abschluss fragt der Monitor einmal beim Öffnen (wieder geöffnet?) – der Server meldet none, kein Abruf-Takt während des Turniers', async () => {
    const read = vi.fn().mockResolvedValue(SERVER_NONE);
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'open', read));
    await tick(0);
    await tick(60_000);
    expect(read).toHaveBeenCalledTimes(1);
    expect(result.current).toEqual({ status: 'none' });
  });

  it('meldet der Server erst „none“ (Abschluss gerade erst), fragt der Monitor nach 2 Sekunden erneut und zeigt dann den Endstand (≤ 10 s)', async () => {
    const read = vi.fn().mockResolvedValueOnce(SERVER_NONE).mockResolvedValue(serverEndstand());
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'finished', read));
    await tick(0);
    expect(result.current.status).toBe('none');
    await tick(FINAL_WAIT_POLL_MS);
    expect(result.current.status).toBe('final');
  });

  it('@ZM-180: eine Störung lässt den Endstand stehen („nicht erreichbar“ ist nie „kein Endstand“)', async () => {
    const read = vi.fn().mockResolvedValueOnce(serverEndstand()).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'finished', read));
    await tick(0);
    await tick(FINAL_HELD_POLL_MS * 2);
    expect(read.mock.calls.length).toBeGreaterThan(1);
    expect(result.current.status).toBe('final');
  });

  it('@ZM-180: eine unlesbare Antwort lässt den Endstand stehen', async () => {
    const read = vi.fn().mockResolvedValueOnce(serverEndstand()).mockResolvedValue({ status: 'irgendwas' });
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'finished', read));
    await tick(0);
    await tick(FINAL_HELD_POLL_MS);
    expect(result.current.status).toBe('final');
  });

  it('@ZM-012 Z. 2: ohne Torschützen-Schalter trägt die Antwort keine Liste – der Monitor liest „Schalter aus“', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand({ scorersPublic: false }));
    const { result } = renderHook(() => useMonitorFinalStandings('tour-1', 'mon-1', 'finished', read));
    await tick(0);
    expect(result.current).toMatchObject({ status: 'final', scorersPublic: false });
  });

  it('@ZM-121 Z. 2: nach dem Wiederöffnen über den Betreiber bleibt der Endstand von vorher – der Monitor fragt sofort nach, der Server liefert ihn unverändert', async () => {
    const vorher = serverEndstand({ scorersPublic: false });
    const read = vi.fn().mockResolvedValue(vorher);
    const { result, rerender } = renderHook(({ ask }: { ask: FinalStandingsAsk }) => useMonitorFinalStandings('tour-1', 'mon-1', ask, read), {
      initialProps: { ask: 'finished' },
    });
    await tick(0);
    const davor = result.current;
    const aufrufe = read.mock.calls.length;
    rerender({ ask: 'open' });
    expect(result.current).toEqual(davor);
    await tick(0);
    expect(read.mock.calls.length).toBe(aufrufe + 1);
    await tick(FINAL_HELD_POLL_MS * 3);
    expect(result.current).toEqual(davor);
  });

  it('@ZM-121 Z. 2 Gegenbeispiel: meldet der Server nach dem Wiederöffnen keinen Endstand mehr (z. B. Kindermodus eingeschaltet), gilt er nicht mehr', async () => {
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result, rerender } = renderHook(({ ask }: { ask: FinalStandingsAsk }) => useMonitorFinalStandings('tour-1', 'mon-1', ask, read), {
      initialProps: { ask: 'finished' },
    });
    await tick(0);
    expect(result.current.status).toBe('final');
    read.mockResolvedValue(SERVER_NONE);
    rerender({ ask: 'open' });
    await tick(0);
    expect(result.current.status).toBe('none');
  });

  it('@LZ-091 letzte Zeile: wird nach dem Wiederöffnen neu abgeschlossen, steht der neue Endstand sofort da (nicht erst im 10-Sekunden-Takt)', async () => {
    const neu = { ...(serverEndstand() as Record<string, unknown>), finishedAt: '2026-11-28T13:00:00+00:00' };
    const read = vi.fn().mockResolvedValue(serverEndstand());
    const { result, rerender } = renderHook(({ ask }: { ask: FinalStandingsAsk }) => useMonitorFinalStandings('tour-1', 'mon-1', ask, read), {
      initialProps: { ask: 'open' },
    });
    await tick(0);
    expect(result.current.status).toBe('final');
    read.mockResolvedValue(neu);
    rerender({ ask: 'finished' });
    await tick(0);
    expect(result.current).toMatchObject({ status: 'final', finishedAt: '2026-11-28T13:00:00+00:00' });
  });
});
