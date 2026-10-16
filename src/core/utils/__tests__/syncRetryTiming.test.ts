/**
 * core/utils/syncRetryTiming — A-06a (Brief A1 + A3): gemeinsame Zeitwerte,
 * `createRequestTimeoutError`, `backoffMsFor`, `withRequestTimeout` und `RetryTimers`.
 * Szenarien: @FU-013, @FU-016, @FU-009.
 *
 * Fallen: Fake-Timer nur `vi.useFakeTimers({ toFake: ['setTimeout','clearTimeout'] })`,
 * kein `AbortSignal.timeout()`, keine `DOMException` in Tests.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  RETRY_BACKOFF_MS,
  REQUEST_TIMEOUT_MS,
  PERMANENT_RETRY_MS_QUEUE,
  createRequestTimeoutError,
  backoffMsFor,
  withRequestTimeout,
  type RetryTimers,
} from '../syncRetryTiming';

function makeTimers(): RetryTimers {
  return {
    setTimeout: (cb: () => void, ms: number) => setTimeout(cb, ms),
    clearTimeout: (handle: unknown) => {
      clearTimeout(handle as ReturnType<typeof setTimeout>);
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('syncRetryTiming — Zeitwerte (@FU-013)', () => {
  it('RETRY_BACKOFF_MS ist [1000, 2000, 5000]', () => {
    expect(RETRY_BACKOFF_MS).toEqual([1000, 2000, 5000]);
  });

  it('REQUEST_TIMEOUT_MS ist 15000 und PERMANENT_RETRY_MS_QUEUE ist 30000', () => {
    expect(REQUEST_TIMEOUT_MS).toBe(15000);
    expect(PERMANENT_RETRY_MS_QUEUE).toBe(30000);
  });

  it('backoffMsFor liefert die Stufen und deckelt am letzten Index (@FU-013)', () => {
    expect(backoffMsFor(0)).toBe(1000);
    expect(backoffMsFor(1)).toBe(2000);
    expect(backoffMsFor(2)).toBe(5000);
    expect(backoffMsFor(3)).toBe(5000);
    expect(backoffMsFor(10)).toBe(5000);
  });
});

describe('syncRetryTiming — createRequestTimeoutError (@FU-016)', () => {
  it('trägt name TimeoutError und eine Zeitlimit-Meldung mit der Dauer', () => {
    const error = createRequestTimeoutError(REQUEST_TIMEOUT_MS);
    expect(error.name).toBe('TimeoutError');
    expect(error.message).toContain('Zeitlimit');
    expect(error.message).toContain(String(REQUEST_TIMEOUT_MS));
    expect(error.message).toContain('TimeoutError');
  });
});

describe('syncRetryTiming — withRequestTimeout (@FU-013, @FU-016)', () => {
  it('liefert das Ergebnis von run vor dem Zeitlimit und räumt den Timer ab', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const timers = makeTimers();
    const clearTimeoutSpy = vi.spyOn(timers, 'clearTimeout');

    await expect(
      withRequestTimeout(timers, REQUEST_TIMEOUT_MS, async () => 'ok')
    ).resolves.toBe('ok');
    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);
  });

  it('lehnt nach Ablauf mit TimeoutError ab und bricht das Signal ab (@FU-016)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const timers = makeTimers();
    let seenSignal: AbortSignal | undefined;

    const pending = withRequestTimeout(timers, REQUEST_TIMEOUT_MS, (signal) => {
      seenSignal = signal;
      return new Promise<never>(() => undefined);
    });
    const assertion = expect(pending).rejects.toMatchObject({
      name: 'TimeoutError',
      message: expect.stringContaining('Zeitlimit'),
    });
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    await assertion;
    expect(seenSignal?.aborted).toBe(true);
  });

  it('gibt den Fehler von run weiter, wenn er vor dem Zeitlimit scheitert', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const timers = makeTimers();
    const runError = new Error('boom');

    await expect(
      withRequestTimeout(timers, REQUEST_TIMEOUT_MS, async () => {
        throw runError;
      })
    ).rejects.toBe(runError);
  });
});
