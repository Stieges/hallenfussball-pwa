/**
 * Task C2a-Fixrunde 1, Befund I1: je Spiel hoechstens EIN Aufruf gleichzeitig --
 * auch ueber doppeltes `start()`, `stop()`/`start()` und Kontowechsel hinweg. Alte
 * Timer und Laeufe einer frueheren Runde duerfen weder senden noch buchen.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AppendableEvent } from '../../../repositories/appendMatchEventsRpc';
import { ctx, ev } from './fixtures';
import { acceptAll, idsIn, makeHarness, networkError, sentMatches } from './outboxHarness';

/**
 * Laesst bereits laufende asynchrone Arbeit (IndexedDB-Anfragen ueber `fake-indexeddb`
 * laufen ueber echtes `setImmediate`, nicht nur Microtasks) ein paar Runden weiterlaufen,
 * OHNE die gefakten Timer (`setTimeout`) vorzuspulen -- damit ein noch haengender
 * `api`-Aufruf haengen bleibt, aber vorgelagerte IndexedDB-Schritte fertig werden.
 */
async function flush(rounds = 10): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
  }
}

/** Haelt den naechsten Aufruf an, bis `release()` gerufen wird. */
function holdCalls(h: ReturnType<typeof makeHarness>): { release: () => void } {
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  h.api.mockImplementation(async (_matchId: string, events: readonly AppendableEvent[]) => {
    await gate;
    return acceptAll(events);
  });
  return {
    release: () => release(),
  };
}

describe('OutboxSender: hoechstens ein Aufruf je Spiel (I1)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('I1a: zweites start() waehrend eines laufenden Aufrufs erzeugt keinen zweiten Aufruf', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm1', ctx);
    await h.store.addPending('acc', 'm1', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    const hold = holdCalls(h);

    const first = h.sender.start('acc');
    await flush();
    expect(h.api).toHaveBeenCalledTimes(1);

    // Zweites start(), WAEHREND der erste Aufruf noch haengt (nicht freigegeben).
    const second = h.sender.start('acc');
    await flush();
    expect(h.api).toHaveBeenCalledTimes(1);

    hold.release();
    await Promise.all([first, second]);
    await h.settle();

    expect(h.api).toHaveBeenCalledTimes(1);
    expect(await idsIn(h, 'acc', 'm1', 'acked')).toEqual(['e1']);
    expect(await idsIn(h, 'acc', 'm1', 'pending')).toEqual([]);
  });

  it('I1b: stop() und erneutes start() waehrend eines laufenden Aufrufs -- kein zweiter paralleler Aufruf', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm2', ctx);
    await h.store.addPending('acc', 'm2', ev({ id: 'e2', type: 'GOAL', at: 1 }));
    let running = 0;
    let peak = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.api.mockImplementation(async (_matchId: string, events: readonly AppendableEvent[]) => {
      running += 1;
      peak = Math.max(peak, running);
      await gate;
      running -= 1;
      return acceptAll(events);
    });

    const first = h.sender.start('acc');
    await flush();
    expect(h.api).toHaveBeenCalledTimes(1);

    h.sender.stop();
    const second = h.sender.start('acc');
    await flush();
    expect(h.api).toHaveBeenCalledTimes(1);

    release();
    await Promise.all([first, second]);
    await h.settle();

    expect(peak).toBe(1);
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(await idsIn(h, 'acc', 'm2', 'acked')).toEqual(['e2']);
  });

  it('I1c: ein Backoff-Timer, der ERST nach stop() entsteht, darf beim naechsten start() nicht parallel feuern', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm3', ctx);
    await h.store.addPending('acc', 'm3', ev({ id: 'e3', type: 'GOAL', at: 1 }));

    // Erster Aufruf haengt zunaechst (RPC unterwegs) -- stop() passiert, WAEHREND er
    // noch laeuft; er schlaegt erst DANACH fehl (genau das Szenario aus dem Review: der
    // Backoff-Timer entsteht NACH dem `stop()`, ein simples `haltAll()` bei `stop()`
    // allein kann ihn also nicht vorab entschaerft haben).
    let releaseFirstFailure: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirstFailure = resolve;
    });
    let running = 0;
    let peak = 0;
    let releaseSecond: () => void = () => undefined;
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    let callCount = 0;
    h.api.mockImplementation(async () => {
      callCount += 1;
      running += 1;
      peak = Math.max(peak, running);
      if (callCount === 1) {
        await firstGate;
        running -= 1;
        throw networkError();
      }
      await secondGate;
      running -= 1;
      return acceptAll([ev({ id: 'e3', type: 'GOAL', at: 1 })]);
    });

    const first = h.sender.start('acc');
    await flush();
    expect(h.api).toHaveBeenCalledTimes(1);

    h.sender.stop(); // haltAll() jetzt: die Warteschlange ist noch nicht pausiert (kein Timer)

    releaseFirstFailure(); // erst JETZT schlaegt der erste Aufruf fehl -> Backoff wird geplant
    await first;
    expect(h.delays).toEqual([1000]);

    const restart = h.sender.start('acc'); // sofortiger neuer Versuch, haengt selbst
    await flush();
    expect(callCount).toBe(2);

    // Der Backoff-Timer der ERSTEN Runde wuerde jetzt faellig, WAEHREND der zweite
    // Aufruf noch haengt -- hoechstens ein Aufruf darf je gleichzeitig laufen. Bewusst
    // OHNE `h.settle()` vorspulen: ein verwaister Aufruf wuerde sonst selbst auf
    // `secondGate` haengen und den Test zum Stillstand bringen (er ist ja der Defekt).
    await vi.advanceTimersByTimeAsync(1500);

    releaseSecond();
    await restart;
    await h.settle();

    expect(peak).toBe(1); // nie zwei gleichzeitig laufende Aufrufe fuer m3
    expect(callCount).toBe(2); // kein dritter, verwaister Aufruf durch den alten Timer
    expect(await idsIn(h, 'acc', 'm3', 'pending')).toEqual([]);
    expect(await idsIn(h, 'acc', 'm3', 'acked')).toEqual(['e3']);
  });

  it('I1d: Kontowechsel A->B waehrend eines laufenden Aufrufs -- Ergebnis bucht nur gegen das urspruengliche Konto', async () => {
    const h = makeHarness();
    // Bewusst dieselbe matchId unter beiden Konten (der im Review beschriebene Grenzfall):
    // eine verwaiste Warteschlange darf niemals mit dem NEUEN Konto laden/buchen.
    const matchId = 'm-shared';
    await h.store.create('accA', matchId, ctx);
    await h.store.addPending('accA', matchId, ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.create('accB', matchId, ctx);
    await h.store.addPending('accB', matchId, ev({ id: 'b1', type: 'GOAL', at: 1 }));

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    h.api.mockImplementation(async (_matchId: string, events: readonly AppendableEvent[]) => {
      await gate;
      return acceptAll(events);
    });

    const first = h.sender.start('accA');
    await flush();
    expect(sentMatches(h.api)).toEqual([matchId]);

    const second = h.sender.start('accB');
    release();
    await Promise.all([first, second]);
    await h.settle();

    // A's Ergebnis (a1 -> accepted) darf NUR gegen A gebucht sein.
    expect(await idsIn(h, 'accA', matchId, 'acked')).toEqual(['a1']);
    expect(await idsIn(h, 'accA', matchId, 'pending')).toEqual([]);
    // B's Kopie darf durch A's (verwaisten) Aufruf nicht veraendert worden sein --
    // B wurde ueber ihre EIGENE Warteschlange gesendet.
    expect(await idsIn(h, 'accB', matchId, 'acked')).toEqual(['b1']);
    expect(await idsIn(h, 'accB', matchId, 'pending')).toEqual([]);
  });

  it('I1-R (a): stop() WAEHREND der store.load()-Leseanfrage -- danach KEIN Aufruf mehr', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm-ir1', ctx);
    await h.store.addPending('acc', 'm-ir1', ev({ id: 'e1', type: 'GOAL', at: 1 }));

    let releaseLoad: () => void = () => undefined;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const originalLoad = h.store.load.bind(h.store);
    vi.spyOn(h.store, 'load').mockImplementation(async (accountId: string, matchId: string) => {
      await loadGate;
      return originalLoad(accountId, matchId);
    });

    const first = h.sender.start('acc');
    await flush(); // tryOneBatch haengt jetzt in store.load()

    h.sender.stop(); // Zeitfenster: die Pruefung in pump() liegt VOR diesem load()

    releaseLoad();
    await first;
    await h.settle();

    // Die zweite Pruefung direkt vor appendMatchEvents (I1-R) muss abbrechen.
    expect(h.api).not.toHaveBeenCalled();
    expect(await idsIn(h, 'acc', 'm-ir1', 'pending')).toEqual(['e1']);
  });

  it('I1-R (b): Kontowechsel A->B WAEHREND der store.load()-Leseanfrage -- A ruft danach nicht mehr auf', async () => {
    const h = makeHarness();
    await h.store.create('accA', 'mA-ir2', ctx);
    await h.store.addPending('accA', 'mA-ir2', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.create('accB', 'mB-ir2', ctx);
    await h.store.addPending('accB', 'mB-ir2', ev({ id: 'b1', type: 'GOAL', at: 1 }));

    let releaseLoad: () => void = () => undefined;
    const loadGate = new Promise<void>((resolve) => {
      releaseLoad = resolve;
    });
    const originalLoad = h.store.load.bind(h.store);
    vi.spyOn(h.store, 'load').mockImplementation(async (accountId: string, matchId: string) => {
      if (accountId === 'accA') {
        await loadGate; // nur A's Leseanfrage haengt -- B darf ungehindert laufen
      }
      return originalLoad(accountId, matchId);
    });

    const first = h.sender.start('accA');
    await flush(); // A haengt jetzt in store.load()

    await h.sender.start('accB'); // Kontowechsel WAEHREND A's Leseanfrage noch aussteht

    releaseLoad();
    await first;
    await h.settle();

    // A darf nach dem Kontowechsel NICHT mehr senden -- weder ihr Eintrag noch ein Aufruf.
    expect(sentMatches(h.api)).toEqual(['mB-ir2']);
    expect(await idsIn(h, 'accA', 'mA-ir2', 'pending')).toEqual(['a1']);
    expect(await idsIn(h, 'accB', 'mB-ir2', 'acked')).toEqual(['b1']);
  });

  it('N1: Kontowechsel ZWISCHEN zwei Staffeln desselben Spiels -- die zweite Staffel wird nicht mehr gesendet', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm-n1', ctx);
    for (let i = 1; i <= 60; i += 1) {
      await h.store.addPending('acc', 'm-n1', ev({ id: `p${i}`, type: 'GOAL', at: i }));
    }

    let releaseFirstBatch: () => void = () => undefined;
    const firstBatchGate = new Promise<void>((resolve) => {
      releaseFirstBatch = resolve;
    });
    h.api.mockImplementation(async (_matchId: string, events: readonly AppendableEvent[]) => {
      await firstBatchGate;
      return acceptAll(events);
    });

    const first = h.sender.start('acc');
    await flush(); // erste Staffel (50) haengt im Aufruf
    expect(h.api).toHaveBeenCalledTimes(1);

    await h.sender.start('accB'); // Kontowechsel, WAEHREND die erste Staffel noch laeuft

    releaseFirstBatch(); // erste Staffel wird jetzt angenommen -- die Schleife wuerde ohne
    // die Konto-Pruefung in pump() (N1) sofort die zweite Staffel (10 Eintraege) senden.
    await first;
    await h.settle();

    expect(h.api).toHaveBeenCalledTimes(1); // kein zweiter Aufruf fuer die restlichen 10
    expect(await idsIn(h, 'acc', 'm-n1', 'acked')).toHaveLength(50);
    expect(await idsIn(h, 'acc', 'm-n1', 'pending')).toHaveLength(10);
  });
});
