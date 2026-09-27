/**
 * Task C3a-0, N-2 (Fixrunde 2, Minor): Warteschlangen fremder/alter Konten werden
 * beim `start()` eines neuen Kontos entfernt, sobald sie nicht (mehr) laufen --
 * eine noch laufende Warteschlange wird erst nach ihrem Ende entfernt. Zuvor blieb
 * jedes Konto-Spiel-Paar fuer die ganze Sitzung im Speicher (praktisch harmlos,
 * aber unbegrenzt und mit veraltetem Backoff-Zustand behaftet).
 *
 * Beobachtet wird das indirekt ueber den Backoff: eine ENTFERNTE Warteschlange wird
 * bei Bedarf NEU angelegt (Backoff-Schritt 0, erster Versuch 1s) -- eine WEITERHIN
 * VORHANDENE Warteschlange wuerde ihren fortgeschrittenen Backoff-Schritt behalten.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { acceptAll, idsIn, makeHarness, networkError } from './outboxHarness';

describe('OutboxSender: N-2 -- Warteschlangen fremder Konten werden aufgeraeumt', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('nicht laufende Warteschlange: nach Kontowechsel beginnt der Backoff bei Rueckkehr wieder bei 1s', async () => {
    const h = makeHarness();
    await h.store.create('accA', 'm1', ctx);
    await h.store.addPending('accA', 'm1', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.create('accB', 'mB', ctx);

    h.api.mockImplementation(async (matchId, events) => {
      if (matchId === 'm1') {
        throw networkError();
      }
      return acceptAll(events);
    });

    await h.sender.start('accA'); // 1. Fehlversuch -> Backoff-Schritt 0 (1000ms)
    await h.tick(1000); // 2. Fehlversuch -> Backoff-Schritt 1 (2000ms)
    expect(h.delays.slice(0, 2)).toEqual([1000, 2000]);

    // Kontowechsel: accA laeuft nicht (nur pausiert) -- ihre Warteschlange wird
    // sofort entfernt (N-2), statt mit fortgeschrittenem Backoff liegen zu bleiben.
    await h.sender.start('accB');
    await h.sender.start('accA'); // zurueck zu accA -> NEUE Warteschlange

    expect(h.delays.at(-1)).toBe(1000);
  });

  it('Warteschlangen des GLEICHEN Kontos werden nicht angefasst -- Backoff bleibt bei wiederholtem start() desselben Kontos erhalten', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm1', ctx);
    await h.store.addPending('acc', 'm1', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    h.api.mockImplementation(async () => {
      throw networkError();
    });

    await h.sender.start('acc'); // 1. Fehlversuch -> Backoff-Schritt 0 (1000ms)
    // Erneutes start() DESSELBEN Kontos (z. B. ein resumeAuth-Flow) darf die eigene,
    // (nur pausierte, nicht laufende) Warteschlange NICHT als "fremd" entfernen --
    // sonst wuerde der Backoff-Fortschritt bei jedem Neustart verloren gehen.
    await h.sender.start('acc');
    await h.tick(1000); // 2. Fehlversuch -> Backoff-Schritt 1 (2000ms), NICHT wieder 0 (1000ms)

    expect(h.delays.slice(0, 2)).toEqual([1000, 2000]);
  });

  it('laufende Warteschlange wird ERST nach ihrem Ende entfernt -- keine zweite, parallele Sendung fuer dasselbe Spiel (I1/RC8)', async () => {
    const h = makeHarness();
    await h.store.create('accA', 'm1', ctx);
    await h.store.addPending('accA', 'm1', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.create('accB', 'mB', ctx);

    let releaseA: () => void = () => undefined;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    h.api.mockImplementation(async (matchId, events) => {
      if (matchId === 'm1') {
        await gateA;
        return acceptAll(events);
      }
      return acceptAll(events);
    });

    const first = h.sender.start('accA'); // accA's Aufruf haengt im RPC (laeuft noch)
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    // Kontowechsel WAEHREND accA noch laeuft -- die Warteschlange darf NICHT
    // sofort verworfen werden (I1/N-1 gelten weiter), sondern erst nach ihrem Ende.
    await h.sender.start('accB');

    // Sofortige Rueckkehr zu accA, WAEHREND der alte Lauf noch haengt: wuerde die
    // Warteschlange schon geloescht (statt erst nach Ende), legte `queueFor` jetzt
    // eine NEUE an und stiesse einen ZWEITEN, parallelen Aufruf fuer m1 an -- der
    // dann ebenfalls auf `gateA` haengen bliebe. Deshalb hier NICHT awaiten, bevor
    // das Gatter freigegeben ist (sonst Deadlock im fehlerhaften Fall).
    const third = h.sender.start('accA');
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(h.api).toHaveBeenCalledTimes(1); // nur der urspruengliche, haengende Aufruf

    releaseA();
    await first;
    await third;
    await h.settle();

    expect(await idsIn(h, 'accA', 'm1', 'acked')).toEqual(['a1']);
  });
});
