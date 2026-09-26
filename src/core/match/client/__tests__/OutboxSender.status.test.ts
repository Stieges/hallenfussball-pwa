/**
 * Task C2a, Aufgabe 3 (15, 17) und PC8: Status-API, Konten-Trennung (D-C2),
 * `stop()` loescht nichts, Persistenz-Anfrage.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { OutboxStatus } from '../outboxTypes';
import { ctx, ev } from './fixtures';
import { acceptAll, makeHarness, sentIds, sentMatches, type Harness } from './outboxHarness';

async function seed(h: Harness, accountId: string, matchId: string, tournamentId?: string): Promise<void> {
  await h.store.create(accountId, matchId, ctx, tournamentId);
}

describe('OutboxSender: Status und Konten', () => {
  beforeEach(() => {
    // Eigene IndexedDB je Test -- dieselben Schluessel duerfen nicht erben.
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('15: Konten-Trennung -- Konto B sendet nur eigene Eintraege, stop() loescht nichts', async () => {
    const h = makeHarness();
    await seed(h, 'accA', 'mA');
    await seed(h, 'accB', 'mB');
    await h.store.addPending('accA', 'mA', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await h.store.addPending('accB', 'mB', ev({ id: 'b1', type: 'GOAL', at: 1 }));

    await h.sender.start('accB');

    expect(sentIds(h.api)).toEqual([['b1']]);
    expect(sentMatches(h.api)).toEqual(['mB']);
    expect(h.sender.getStatus().pendingByMatch).toEqual({ mB: 0 });

    h.sender.stop();

    const copiesA = await h.store.forAccount('accA');
    expect(copiesA.map((copy) => copy.matchId)).toEqual(['mA']);
    expect(copiesA[0]?.pending.map((event) => event.id)).toEqual(['a1']);
    const copiesB = await h.store.forAccount('accB');
    expect(copiesB[0]?.acked.map((event) => event.id)).toEqual(['b1']);
    expect(copiesB[0]?.pending).toEqual([]);

    // Wechsel zurueck auf A: jetzt werden As Eintraege gesendet, B bleibt wie es ist
    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.start('accA');
    expect(sentMatches(h.api)[sentMatches(h.api).length - 1]).toBe('mA');
    const afterA = await h.store.load('accB', 'mB');
    expect(afterA?.acked.map((event) => event.id)).toEqual(['b1']);
  });

  it('17: pendingByTournament stimmt nach Einfuegen und Senden, jeder Listener wird gerufen', async () => {
    const h = makeHarness();
    const seen: OutboxStatus[] = [];
    const unsubscribe = h.sender.subscribe((status) => seen.push(status));
    await seed(h, 'acc', 'm1', 't1');
    await seed(h, 'acc', 'm2');

    await h.sender.start('acc');
    expect(h.sender.getStatus().pendingByTournament).toEqual({ t1: 0, '': 0 });

    await h.store.addPending('acc', 'm1', ev({ id: 'p1', type: 'GOAL', at: 1 }));
    await h.store.addPending('acc', 'm1', ev({ id: 'p2', type: 'GOAL', at: 2 }));
    await h.sender.kick('m1');

    const counts = seen.map((status) => status.pendingByTournament['t1'] ?? 0);
    expect(counts).toContain(2);
    expect(counts[counts.length - 1]).toBe(0);
    expect(seen.length).toBeGreaterThanOrEqual(3);
    expect(h.sender.getStatus().pendingByTournament).toEqual({ t1: 0, '': 0 });
    expect(h.sender.getStatus().pendingByMatch).toEqual({ m1: 0, m2: 0 });

    unsubscribe();
    await h.store.addPending('acc', 'm1', ev({ id: 'p3', type: 'GOAL', at: 3 }));
    await h.sender.kick('m1');
    expect(seen).toHaveLength(counts.length);
  });

  it('Status meldet rejected/review je Spiel und leere Listen bei leerem Konto', async () => {
    const h = makeHarness();
    await h.sender.start('leer');
    const empty = h.sender.getStatus();
    expect(empty.pendingByTournament).toEqual({});
    expect(empty.pendingByMatch).toEqual({});
    expect(empty.rejectedByMatch).toEqual({});
    expect(empty.reviewByMatch).toEqual({});
    expect(empty.pausedMatches).toEqual({});
    expect(empty.authRequired).toBe(false);
    expect(empty.clientOutdated).toBe(false);
    expect(empty.lastError).toBeNull();
  });

  it('storagePersisted zeigt das Ergebnis von navigator.storage.persist', async () => {
    const h = makeHarness();
    expect(h.sender.getStatus().storagePersisted).toBeNull();
    await h.sender.start('acc');
    expect(h.persist).toHaveBeenCalledTimes(1);
    expect(h.sender.getStatus().storagePersisted).toBe(true);
    await h.sender.start('acc');
    expect(h.persist).toHaveBeenCalledTimes(1);
  });

  it('fehlende Persistenz-API ist kein Fehler (storagePersisted bleibt null)', async () => {
    const h = makeHarness();
    vi.stubGlobal('navigator', {});
    await h.sender.start('acc');
    expect(h.persist).not.toHaveBeenCalled();
    expect(h.sender.getStatus().storagePersisted).toBeNull();
  });
});
