/**
 * OutboxSender.reconnect (A-06b, @FU-013, @FU-016): Zeitlimit 15 s je Anfrage und
 * Wiedervernahme nach Netz-Rueckkehr. Testmuster Brief A3 gegen den Harness-Deadlock:
 * haengende Anfragen nur per `mockImplementationOnce`, `start()` nicht direkt awaiten
 * (`const run = ...; await h.tick(...); await run;`) und den Schritt, der einen
 * haengenden Aufruf aus einem Wiederholungs-Timer startet, per
 * `vi.advanceTimersByTimeAsync` statt `h.tick` vorspulen. Vor dem Ticken laeuft die
 * asynchrone Kette (IndexedDB) per `untilApiCalls` an, damit der Zeitlimit-Timer
 * registriert ist, bevor die Fake-Zeit springt.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RepositoryError } from '../../../errors';
import type { AppendResult } from '../../../repositories/appendMatchEventsRpc';
import { ctx, ev } from './fixtures';
import { acceptAll, idsIn, makeHarness, networkError, type Harness } from './outboxHarness';

/** Echte postgrest-Form, wie sie nach dem Abbruch durchkommt. */
function abortError(): RepositoryError {
  return new RepositoryError('appendMatchEvents', 'AbortError: This operation was aborted', {
    code: '',
    message: 'AbortError: This operation was aborted',
    details: '',
    hint: '',
  });
}

/** Laesst echte asynchrone Arbeit (IndexedDB) laufen, ohne Fake-Zeit zu bewegen. */
async function untilApiCalls(h: Harness, count: number): Promise<void> {
  while (h.api.mock.calls.length < count) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}

describe('OutboxSender: Zeitlimit und Wiederverbindung (A-06b)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('2 @FU-013 @FU-016: hängende Anfrage -> nach 15 s abgebrochen, nächster Versuch acked', { timeout: 5000 }, async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mT2', ctx);
    await h.store.addPending('acc', 'mT2', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementationOnce(
      (_matchId, _events, options) =>
        new Promise<AppendResult>((_resolve, reject) => {
          options.signal?.addEventListener('abort', () => reject(abortError()));
        }),
    );

    const run = h.sender.start('acc');
    await untilApiCalls(h, 1);
    await h.tick(15000);
    await run;

    expect(h.limitDelays).toEqual([15000]);
    expect(h.api.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
    expect(h.delays[h.delays.length - 1]).toBe(1000);

    await h.tick(1000);
    expect(h.api.mock.calls.length).toBe(2);
    expect(h.api.mock.calls[1]?.[2]?.signal?.aborted).toBe(false);
    expect(await idsIn(h, 'acc', 'mT2', 'acked')).toEqual(['e1']);
  });

  it('3 @FU-013 @FU-016: Anfrage ignoriert das Signal -> nach 15 s trotzdem transient und Wiederholung', { timeout: 5000 }, async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mT3', ctx);
    await h.store.addPending('acc', 'mT3', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementationOnce(() => new Promise<AppendResult>(() => undefined));

    const run = h.sender.start('acc');
    await untilApiCalls(h, 1);
    await h.tick(15000);
    await run;

    expect(h.limitDelays).toEqual([15000]);
    expect(h.delays[h.delays.length - 1]).toBe(1000);

    await h.tick(1000);
    expect(h.api.mock.calls.length).toBe(2);
    expect(h.api.mock.calls[0]?.[2]?.signal?.aborted).toBe(true);
    expect(h.api.mock.calls[1]?.[2]?.signal?.aborted).toBe(false);
    expect(await idsIn(h, 'acc', 'mT3', 'acked')).toEqual(['e1']);
  });

  it('4 @FU-013 @FU-016 Gegenbeispiel: Antwort bei 14900 ms -> acked, Signal nicht abgebrochen, kein 2. Aufruf', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mT4', ctx);
    await h.store.addPending('acc', 'mT4', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementationOnce(
      (_matchId, events) =>
        new Promise<AppendResult>((resolve) => {
          setTimeout(() => resolve(acceptAll(events)), 14900);
        }),
    );

    const run = h.sender.start('acc');
    await untilApiCalls(h, 1);
    await h.tick(14900);
    await run;

    expect(await idsIn(h, 'acc', 'mT4', 'acked')).toEqual(['e1']);
    expect(h.api.mock.calls[0]?.[2]?.signal?.aborted).toBe(false);

    await h.tick(20000);
    expect(h.api.mock.calls[0]?.[2]?.signal?.aborted).toBe(false);
    expect(h.api.mock.calls.length).toBe(1);
  });

  it('5 @FU-013 @FU-016: Obergrenze bei hängender Anfrage höchstens 20 s ab deren Start', { timeout: 5000 }, async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mT5', ctx);
    await h.store.addPending('acc', 'mT5', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementation(async () => {
      throw networkError();
    });

    await h.sender.start('acc');
    await h.tick(1000);
    await h.tick(2000);
    await h.tick(5000);
    await h.tick(5000);
    await h.tick(5000);
    expect(h.api.mock.calls.length).toBe(6);

    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    h.api.mockImplementationOnce(() => new Promise<AppendResult>(() => undefined));
    await vi.advanceTimersByTimeAsync(5000);
    await untilApiCalls(h, 7);
    expect(h.api.mock.calls.length).toBe(7);

    await h.tick(15000 + 4999);
    expect(await idsIn(h, 'acc', 'mT5', 'acked')).toEqual([]);
    await h.tick(1);
    expect(await idsIn(h, 'acc', 'mT5', 'acked')).toEqual(['e1']);
  });
});
