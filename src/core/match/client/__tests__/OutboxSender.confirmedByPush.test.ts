/**
 * A-06m Fixrunde 1 (Produktfehler A-06m-P1, @FU-010): Geht die Antwort des Servers verloren und
 * bestaetigt ein Live-Push (oder die Abfrage) den Eintrag vor der Wiederholung, muss der Zaehler
 * "wartet" mit dem Wiederholungsversuch auf 0 gehen -- ohne weiteren Netzaufruf.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev, withSeq } from './fixtures';
import { acceptAll, makeHarness, networkError } from './outboxHarness';

describe('OutboxSender: Bestaetigung per Push waehrend des Wiederholens (A-06m-P1)', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  async function setup() {
    const h = makeHarness();
    await h.store.create('acc', 'm1', ctx, 't1');
    await h.store.addPending('acc', 'm1', ev({ id: 'e1', type: 'GOAL', at: 1 }));
    h.api.mockRejectedValueOnce(networkError());
    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.start('acc');
    expect(h.api).toHaveBeenCalledTimes(1);
    expect(h.sender.getStatus().pendingByMatch).toEqual({ m1: 1 });
    return h;
  }

  it('Push bestaetigt vor der Wiederholung: Zaehler 0, genau ein Server-Aufruf', async () => {
    const h = await setup();

    await h.store.applyConfirmed('acc', 'm1', [withSeq(ev({ id: 'e1', type: 'GOAL', at: 1 }), 5)], 5);
    await h.tick(1000);

    expect(h.sender.getStatus().pendingByMatch).toEqual({ m1: 0 });
    expect(h.api).toHaveBeenCalledTimes(1);
  });

  it('Gegenbeispiel ohne Bestaetigung: zweiter Aufruf, danach Zaehler 0 ueber den normalen Weg', async () => {
    const h = await setup();

    await h.tick(1000);

    expect(h.api).toHaveBeenCalledTimes(2);
    expect(h.sender.getStatus().pendingByMatch).toEqual({ m1: 0 });
  });
});
