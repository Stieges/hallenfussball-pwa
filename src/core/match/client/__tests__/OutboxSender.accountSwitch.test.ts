/**
 * A-07b Punkt 3 (Weg A, @FU-006): Wartende Eintraege von Konto A werden nach dem Wechsel
 * auf Konto B (`start('accB')`) nicht mehr gesendet. Ein bereits laufender A-Aufruf darf
 * seine Antwort nur noch in den eigenen Store von A buchen (`OutboxSender.ts:249-262`).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { acceptAll, idsIn, makeHarness } from './outboxHarness';

describe('OutboxSender: Kopien von A werden nach start(B) nicht gesendet (@FU-006)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('nach dem Kontowechsel geht kein weiterer Aufruf fuer As Eintraege raus; B sendet die eigenen', async () => {
    const h = makeHarness();
    await h.store.create('accA', 'mA', ctx);
    await h.store.addPending('accA', 'mA', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.create('accB', 'mB', ctx);
    await h.store.addPending('accB', 'mB', ev({ id: 'b1', type: 'GOAL', at: 1 }));

    let releaseA: () => void = () => undefined;
    const gateA = new Promise<void>((resolve) => {
      releaseA = resolve;
    });
    h.api.mockImplementation(async (matchId: string, events) => {
      if (matchId === 'mA') {
        await gateA;
      }
      return acceptAll(events);
    });

    const first = h.sender.start('accA');
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    const callsBeforeSwitch = h.api.mock.calls.length;
    expect(callsBeforeSwitch).toBe(1);
    // a2 kommt erst während des laufenden Aufrufs dazu, steht also nicht im gesendeten Stapel.
    await h.store.addPending('accA', 'mA', ev({ id: 'a2', type: 'GOAL', at: 2 }));

    await h.sender.start('accB'); // Kontowechsel, A's Aufruf haengt noch
    await h.settle();

    releaseA(); // A's Antwort kommt nach dem Wechsel
    await first;
    await h.settle();
    await h.tick(60_000); // alle Zeitgeber von A duerfen nichts mehr senden

    // Nach dem Wechsel kein Aufruf mehr fuer mA: As Kopien bleiben unberuehrt.
    const matchesAfterSwitch = h.api.mock.calls.slice(callsBeforeSwitch).map((call) => call[0]);
    expect(matchesAfterSwitch).not.toContain('mA');
    // B hat seine eigenen Eintraege gesendet.
    expect(await idsIn(h, 'accB', 'mB', 'acked')).toEqual(['b1']);
    // a2 bleibt in As Speicher wartend (nie gesendet).
    expect(await idsIn(h, 'accA', 'mA', 'pending')).toEqual(['a2']);
  });
});
