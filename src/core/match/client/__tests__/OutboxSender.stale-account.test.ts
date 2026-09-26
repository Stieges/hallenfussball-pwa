/**
 * Task C2a-Fixrunde 2, Befund N-1: ein Aufruf, der beim Kontowechsel noch
 * "unterwegs" war (`queue.accountId !== this.accountId`, wenn Ergebnis/Fehler
 * eintreffen), darf den GLOBALEN Status (authRequired, lastError,
 * clientOutdated) nicht mehr setzen und kein requestCatchUp mehr ausloesen.
 * Die Buchung in den Store des EIGENEN (alten) Kontos bleibt erlaubt.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { acceptAll, idsIn, makeHarness, rpcError, success, resultOf } from './outboxHarness';

describe('OutboxSender: veraltete Auslaeufer aendern nie den globalen Status (N-1)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('N-1 (a): auth-Fehler eines veralteten A-Aufrufs setzt authRequired NICHT fuer das jetzt aktive Konto B', async () => {
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
        throw rpcError('42501', 'permission denied for function append_match_events');
      }
      return acceptAll(events);
    });

    const first = h.sender.start('accA');
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await h.sender.start('accB'); // Kontowechsel WAEHREND A's Aufruf noch haengt

    // B wurde ganz normal gesendet.
    expect(await idsIn(h, 'accB', 'mB', 'acked')).toEqual(['b1']);
    expect(h.sender.getStatus().authRequired).toBe(false);

    releaseA(); // A's (veralteter) Aufruf schlaegt JETZT mit auth fehl
    await first;
    await h.settle();

    // Der auth-Fehler des veralteten A-Aufrufs darf den (jetzt aktiven) Status von B nicht umschalten.
    expect(h.sender.getStatus().authRequired).toBe(false);
    expect(h.sender.getStatus().lastError).toBeNull();
    // A's Eintrag bleibt unangetastet pending (kein Aufruf haette ihn je acken duerfen).
    expect(await idsIn(h, 'accA', 'mA', 'pending')).toEqual(['a1']);
  });

  it('N-1 (b): ein Erfolg eines veralteten A-Aufrufs bucht noch in As eigenen Store, loest aber kein requestCatchUp mehr aus', async () => {
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
        return success(events.map((event) => resultOf(event.id, 'accepted')));
      }
      return acceptAll(events);
    });

    const first = h.sender.start('accA');
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    await h.sender.start('accB');

    expect(h.catchUps).toEqual(['mB']);

    releaseA(); // A's veralteter Aufruf wird jetzt VOM SERVER angenommen
    await first;
    await h.settle();

    // Buchung in As eigene Kopie bleibt erlaubt (kein Datenverlust).
    expect(await idsIn(h, 'accA', 'mA', 'acked')).toEqual(['a1']);
    // Aber kein requestCatchUp fuer mA -- das gehoert nicht mehr zum aktiven Konto/Lauf.
    expect(h.catchUps).toEqual(['mB']);
  });
});
