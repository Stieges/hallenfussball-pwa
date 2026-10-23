/**
 * MeasuredServerClock (Adapter (a), B-15 Review A4, @ZM-026): die Restzeit hängt nicht von der Uhr des Handys ab.
 * Gemockt ist nur der Aufruf `server_time`; Fake-Timer.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const { callServerTime } = vi.hoisted(() => ({ callServerTime: vi.fn<() => Promise<number>>() }));
vi.mock('../../../core/repositories/appendMatchEventsRpc', () => ({ callServerTime }));
vi.mock('../../../lib/supabase', () => ({ supabase: {}, isSupabaseConfigured: true }));

import { MeasuredServerClock } from '../serverClock';

const SERVER = Date.parse('2026-10-10T12:32:00Z');
const MINUTE = 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(SERVER + 40_000); // die Uhr des Handys geht 40 Sekunden vor
  callServerTime.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('MeasuredServerClock', () => {
  it('@ZM-026 Handy-Uhr 40 s vor: nach der Messung weicht die Serverzeit höchstens 2 s ab, vorher nicht', async () => {
    callServerTime.mockImplementation(() => Promise.resolve(Date.now() - 40_000));
    const clock = new MeasuredServerClock();
    expect(clock.nowMs() - SERVER).toBe(40_000);
    await clock.ensureMeasured();
    expect(Math.abs(clock.nowMs() - (Date.now() - 40_000))).toBeLessThanOrEqual(2000);
  });

  it('@ZM-026 Gegenbeispiel: ohne Messung (Aufruf scheitert) bleibt die Geräteuhr', async () => {
    callServerTime.mockRejectedValue(new Error('offline'));
    const clock = new MeasuredServerClock();
    await clock.ensureMeasured();
    expect(clock.nowMs()).toBe(Date.now());
  });

  it('misst höchstens alle 10 Minuten', async () => {
    callServerTime.mockImplementation(() => Promise.resolve(Date.now() - 40_000));
    const clock = new MeasuredServerClock();
    await clock.ensureMeasured();
    vi.setSystemTime(Date.now() + 9 * MINUTE);
    await clock.ensureMeasured();
    expect(callServerTime).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 2 * MINUTE);
    await clock.ensureMeasured();
    expect(callServerTime).toHaveBeenCalledTimes(2);
  });

  it('nach einem Fehlschlag frühestens nach 60 Sekunden wieder', async () => {
    callServerTime.mockRejectedValue(new Error('offline'));
    const clock = new MeasuredServerClock();
    await clock.ensureMeasured();
    vi.setSystemTime(Date.now() + 30_000);
    await clock.ensureMeasured();
    expect(callServerTime).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + 31_000);
    await clock.ensureMeasured();
    expect(callServerTime).toHaveBeenCalledTimes(2);
  });

  it('eine hängende Messung hält den Abruf höchstens 2,5 Sekunden auf', async () => {
    callServerTime.mockImplementation(() => new Promise<number>(() => undefined));
    const clock = new MeasuredServerClock();
    const done = clock.ensureMeasured();
    await vi.advanceTimersByTimeAsync(2500);
    await done;
    expect(clock.nowMs()).toBe(Date.now());
  });
});
