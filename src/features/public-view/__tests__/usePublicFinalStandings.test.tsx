/**
 * R3-6 Zuschauer-Seite fragt den gespeicherten Endstand im 10-Sekunden-Takt (@LZ-077 Z. 1, @ZM-011, @ZM-069, @ZM-109).
 * Fake-Timer; die Abfrage ist eine Attrappe. Der Wechsel kommt ohne Neuladen nach höchstens einem Takt.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { usePublicFinalStandings } from '../usePublicFinalStandings';
import { testUuid } from '../../../test/matchSlotFixtures';

const FINAL = {
  status: 'final', finishedAt: '2026-11-28T12:10:00+00:00',
  standings: { format: 1, scorers: [], appVersion: '1', computedAt: '2026-11-28T13:10:00+01:00',
    ranking: [{ place: 1, teamId: testUuid(1), teamName: 'FC Nord', origin: { kind: 'groupPlace', group: '', place: 1 } }] },
};
const advance = async (ms: number): Promise<void> => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

describe('usePublicFinalStandings', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });
  afterEach(() => { vi.useRealTimers(); });

  it('@LZ-077 Z. 1: Läuft → Abschluss: nach höchstens 10 Sekunden steht der Endstand da, ohne Neuladen', async () => {
    let reply: unknown = { status: 'none' };
    const read = vi.fn(() => Promise.resolve(reply));
    const { result } = renderHook(() => usePublicFinalStandings('ABC123', true, read));
    await advance(0);
    expect(result.current.status).toBe('none');
    reply = FINAL;
    await advance(10_000);
    expect(result.current.status).toBe('final');
    expect(read).toHaveBeenCalledWith('ABC123');
  });

  it('@ZM-069: nach dem Wiederöffnen gilt derselbe Link weiter – der Endstand verschwindet nach höchstens 10 Sekunden', async () => {
    let reply: unknown = FINAL;
    const read = vi.fn(() => Promise.resolve(reply));
    const { result } = renderHook(() => usePublicFinalStandings('ABC123', true, read));
    await advance(0);
    expect(result.current.status).toBe('final');
    reply = { status: 'none' };
    await advance(10_000);
    expect(result.current.status).toBe('none');
    expect(read).toHaveBeenLastCalledWith('ABC123');
  });

  it('@ZM-109 Gegenbeispiel: eine Störung oder unlesbare Antwort löscht den Endstand nicht', async () => {
    const replies: Array<() => Promise<unknown>> = [() => Promise.resolve(FINAL), () => Promise.reject(new Error('Netz')), () => Promise.resolve({ unsinn: true })];
    const read = vi.fn(() => (replies.shift() ?? (() => Promise.resolve(FINAL)))());
    const { result } = renderHook(() => usePublicFinalStandings('ABC123', true, read));
    await advance(0);
    await advance(10_000);
    await advance(10_000);
    expect(read).toHaveBeenCalledTimes(3);
    expect(result.current.status).toBe('final');
  });

  it('ohne geladenes Turnier (enabled aus) wird nicht gefragt', async () => {
    const read = vi.fn(() => Promise.resolve({ status: 'none' }));
    renderHook(() => usePublicFinalStandings('ABC123', false, read));
    await advance(30_000);
    expect(read).not.toHaveBeenCalled();
  });
});
