/**
 * Task C2a, Aufgabe 3 (1, 2, 6, 7, 13, 14, 16): Grundverhalten des Ausgangs --
 * Ergebnis je Eintrag, Parallelitaet je Spiel, Backoff, Neustart, Gast.
 * Stapel und Folgeablehnung: siehe OutboxSender.cascade.test.ts.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import {
  acceptAll,
  clientOutdatedResult,
  idsIn,
  makeHarness,
  networkError,
  resultOf,
  sentIds,
  sentMatches,
  success,
  CLOCK_START,
} from './outboxHarness';

describe('OutboxSender: Grundverhalten', () => {
  beforeEach(() => {
    // Eigene IndexedDB je Test -- dieselben Schluessel duerfen nicht erben.
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('1: accepted/duplicate/noop -> acked, requestCatchUp genau einmal je Stapel, Wasserstand unveraendert', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm1', ctx, 't1');
    for (const id of ['e1', 'e2', 'e3']) {
      await h.store.addPending('acc', 'm1', ev({ id, type: 'GOAL', at: 1 }));
    }
    await h.store.applyConfirmed('acc', 'm1', [], 7);
    h.api.mockImplementation(async (_matchId, events) =>
      success([
        resultOf(events[0].id, 'accepted'),
        resultOf(events[1].id, 'duplicate'),
        resultOf(events[2].id, 'noop'),
      ]),
    );

    await h.sender.start('acc');

    expect(await idsIn(h, 'acc', 'm1', 'acked')).toEqual(['e1', 'e2', 'e3']);
    expect(await idsIn(h, 'acc', 'm1', 'pending')).toEqual([]);
    expect(h.catchUps).toEqual(['m1']);
    // m7: resolveBatch benachrichtigt die MatchEngine (Ansicht aktualisiert sich ohne Neuladen).
    expect(h.storeChanges).toEqual(['m1']);
    const copy = await h.store.load('acc', 'm1');
    expect(copy?.watermarkSeq).toBe(7);
    expect(copy?.confirmed).toEqual([]);
    expect(h.api.mock.calls[0]?.[2]).toEqual({ clientFormat: 3, deviceId: 'device-1' });
    expect(sentIds(h.api)).toEqual([['e1', 'e2', 'e3']]);
  });

  it('2: rejected -> rejected mit Code und Detail, der Rest des Stapels bleibt unberuehrt', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm2', ctx);
    for (const id of ['e1', 'e2', 'e3']) {
      await h.store.addPending('acc', 'm2', ev({ id, type: 'GOAL', at: 1 }));
    }
    h.api.mockImplementation(async (_matchId, events) =>
      success([
        resultOf(events[0].id, 'accepted'),
        resultOf(events[1].id, 'rejected', 'INVALID_TRANSITION', { from: 'scheduled' }),
        resultOf(events[2].id, 'accepted'),
      ]),
    );

    await h.sender.start('acc');

    expect(await idsIn(h, 'acc', 'm2', 'acked')).toEqual(['e1', 'e3']);
    const copy = await h.store.load('acc', 'm2');
    expect(copy?.rejected.map((entry) => [entry.event.id, entry.code])).toEqual([['e2', 'INVALID_TRANSITION']]);
    expect(copy?.rejected[0]?.detail).toEqual({ from: 'scheduled' });
    expect(copy?.rejected[0]?.rejectedAt).toBe(CLOCK_START);
    expect(h.catchUps).toEqual(['m2']);
  });

  it('M-f: eine abweichende id im Ergebnis wird in lastError sichtbar, aendert aber nichts an der Buchung', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm-mf', ctx);
    await h.store.addPending('acc', 'm-mf', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementation(async () => success([resultOf('unerwartete-id', 'accepted')]));

    await h.sender.start('acc');

    // Trotz abweichender id wird ueber den Index gebucht -- nichts geht verloren.
    expect(await idsIn(h, 'acc', 'm-mf', 'acked')).toEqual(['e1']);
    expect(await idsIn(h, 'acc', 'm-mf', 'pending')).toEqual([]);
    // Die Abweichung ist im Status sichtbar (nicht still verworfen).
    expect(h.sender.getStatus().lastError).toMatch(/e1/);
    expect(h.sender.getStatus().lastError).toMatch(/unerwartete-id/);
  });

  it('I2/M21: review -> Liste review, nicht acked, kein requestCatchUp, Status reviewByMatch', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm-review', ctx);
    await h.store.addPending('acc', 'm-review', ev({ id: 'v1', type: 'FOUL', at: 1 }));
    h.api.mockImplementation(async (_matchId, events) => success([resultOf(events[0].id, 'review')]));

    await h.sender.start('acc');

    expect(await idsIn(h, 'acc', 'm-review', 'review')).toEqual(['v1']);
    expect(await idsIn(h, 'acc', 'm-review', 'acked')).toEqual([]);
    expect(await idsIn(h, 'acc', 'm-review', 'pending')).toEqual([]);
    // review ist kein "angenommen" -- kein Nachladen ausgeloest.
    expect(h.catchUps).toEqual([]);
    expect(h.sender.getStatus().reviewByMatch).toEqual({ 'm-review': 1 });
  });

  it('6: ein dauerhaft gestoertes Spiel blockiert die anderen nicht', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mA', ctx);
    await h.store.create('acc', 'mB', ctx);
    await h.store.addPending('acc', 'mA', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.addPending('acc', 'mB', ev({ id: 'b1', type: 'GOAL', at: 1 }));
    h.api.mockImplementation(async (matchId, events) => {
      if (matchId === 'mA') {
        throw networkError();
      }
      return acceptAll(events);
    });

    await h.sender.start('acc');

    expect(sentMatches(h.api).sort()).toEqual(['mA', 'mB']);
    expect(await idsIn(h, 'acc', 'mB', 'acked')).toEqual(['b1']);
    expect(await idsIn(h, 'acc', 'mA', 'pending')).toEqual(['a1']);
    expect(h.delays).toEqual([1000]);
  });

  it('7: Backoff 1/2/5/10/30/30 s, ein Erfolg setzt zurueck', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm7', ctx);
    await h.store.addPending('acc', 'm7', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementation(async () => {
      throw networkError();
    });

    await h.sender.start('acc');
    expect(h.delays).toEqual([1000]);

    await h.tick(1000);
    expect(h.delays).toEqual([1000, 2000]);
    await h.tick(2000);
    await h.tick(5000);
    await h.tick(10000);
    await h.tick(30000);
    expect(h.delays).toEqual([1000, 2000, 5000, 10000, 30000, 30000]);

    // Erfolg setzt den Backoff zurueck
    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.tick(30000);
    expect(await idsIn(h, 'acc', 'm7', 'acked')).toEqual(['e1']);

    await h.store.addPending('acc', 'm7', ev({ id: 'e2', type: 'GOAL', at: 2 }));
    h.api.mockImplementation(async () => {
      throw networkError();
    });
    await h.sender.kick('m7');
    expect(h.delays[h.delays.length - 1]).toBe(1000);
  });

  it('M19: kick() hebt eine bestehende Backoff-Pause sofort auf, statt auf den Timer zu warten', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm19', ctx);
    await h.store.addPending('acc', 'm19', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockImplementation(async () => {
      throw networkError();
    });

    await h.sender.start('acc');
    expect(h.delays).toEqual([1000]); // Backoff aktiv, Timer (1s) noch nicht gefeuert

    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.kick('m19'); // muss SOFORT senden, nicht erst nach den 1000ms

    expect(h.api).toHaveBeenCalledTimes(2);
    expect(await idsIn(h, 'acc', 'm19', 'acked')).toEqual(['e1']);
  });

  it('13: Abbruch nach dem Senden -- erneuter Versuch, duplicate zaehlt wie accepted', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm13', ctx);
    await h.store.addPending('acc', 'm13', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockRejectedValueOnce(networkError()).mockImplementation(async (_matchId, events) =>
      success(events.map((event) => resultOf(event.id, 'duplicate'))),
    );

    await h.sender.start('acc');
    expect(await idsIn(h, 'acc', 'm13', 'pending')).toEqual(['e1']);

    await h.tick(1000);

    expect(h.api).toHaveBeenCalledTimes(2);
    expect(await idsIn(h, 'acc', 'm13', 'acked')).toEqual(['e1']);
    expect(h.catchUps).toEqual(['m13']);
  });

  it('14: Neustart -- neue Store- und Sender-Instanz findet pending wieder und sendet', async () => {
    const first = makeHarness();
    await first.store.create('acc', 'm14', ctx);
    await first.store.addPending('acc', 'm14', ev({ id: 'n1', type: 'GOAL', at: 1 }));
    first.sender.stop();

    const second = makeHarness();
    await second.sender.start('acc');

    expect(sentIds(second.api)).toEqual([['n1']]);
    expect(await idsIn(second, 'acc', 'm14', 'acked')).toEqual(['n1']);
  });

  it('16: Gast -- der Sender ruft die API nie auf', async () => {
    const h = makeHarness();
    await h.store.create('guest', 'mG', ctx);
    await h.store.addPending('guest', 'mG', ev({ id: 'g1', type: 'GOAL', at: 1 }));

    await h.sender.start('guest');
    await h.sender.kick('mG');
    await h.sender.kick();
    await h.tick(120000);

    expect(h.api).not.toHaveBeenCalled();
    expect(await idsIn(h, 'guest', 'mG', 'pending')).toEqual(['g1']);
  });

  it('CLIENT_OUTDATED-Ergebnis haelt alles an (Grundlage fuer Test 9)', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mX', ctx);
    await h.store.addPending('acc', 'mX', ev({ id: 'x1', type: 'GOAL', at: 1 }));
    h.api.mockResolvedValueOnce(clientOutdatedResult());

    await h.sender.start('acc');

    expect(h.sender.getStatus().clientOutdated).toBe(true);
    expect(await idsIn(h, 'acc', 'mX', 'pending')).toEqual(['x1']);
  });
});
