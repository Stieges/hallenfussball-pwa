/**
 * Task C2a, Aufgabe 3 (3, 4, 5): Stapel ≤ 50 und Folgeablehnung -- B3 ueber
 * Stapelgrenzen (RC8) und W4 (Ziel-Verweis auf einen Abgelehnten).
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ctx, ev } from './fixtures';
import { idsIn, makeHarness, rejectedIn, resultOf, sentIds, success } from './outboxHarness';

describe('OutboxSender: Stapel und Folgeablehnung', () => {
  beforeEach(() => {
    // Eigene IndexedDB je Test -- dieselben Schluessel duerfen nicht erben.
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('3: Folgeablehnung ueber Stapelgrenzen -- 60 pending, MATCH_START abgelehnt', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm3', ctx);
    await h.store.addPending('acc', 'm3', ev({ id: 'e1', type: 'MATCH_START', at: 1 }));
    for (let i = 2; i <= 60; i += 1) {
      await h.store.addPending('acc', 'm3', ev({ id: `e${i}`, type: 'GOAL', at: i }));
    }
    // Server-Kaskade im Stapel: nach dem abgelehnten MATCH_START ist alles DEPENDS_ON_REJECTED.
    h.api.mockImplementation(async (_matchId, events) =>
      success(
        events.map((event, index) =>
          index === 0
            ? resultOf(event.id, 'rejected', 'INVALID_TRANSITION')
            : resultOf(event.id, 'rejected', 'DEPENDS_ON_REJECTED'),
        ),
      ),
    );

    await h.sender.start('acc');

    expect(h.api).toHaveBeenCalledTimes(1);
    expect(sentIds(h.api)[0]).toHaveLength(50);
    const rejected = await rejectedIn(h, 'acc', 'm3');
    expect(rejected).toHaveLength(60);
    expect(rejected[0]).toEqual(['e1', 'INVALID_TRANSITION']);
    for (const [id, code] of rejected.slice(1)) {
      expect(code).toBe('DEPENDS_ON_REJECTED');
      expect(id).toMatch(/^e\d+$/);
    }
    // die 10 nicht gesendeten (e51..e60) sind ebenfalls abgelehnt, ohne zweiten Aufruf
    const rejectedIds = new Set(rejected.map(([id]) => id));
    for (let i = 51; i <= 60; i += 1) {
      expect(rejectedIds.has(`e${i}`)).toBe(true);
    }
    expect(await idsIn(h, 'acc', 'm3', 'pending')).toEqual([]);
    expect(h.catchUps).toEqual([]);
  });

  it('4a: W4 -- RETRACT auf ein abgelehntes Ziel derselben Sendung behaelt seinen eigenen Server-Code (Minor c)', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm4a', ctx);
    await h.store.addPending('acc', 'm4a', ev({ id: 'g1', type: 'GOAL', at: 1 }));
    await h.store.addPending('acc', 'm4a', ev({ id: 'r1', type: 'RETRACT', at: 2, targetId: 'g1' }));
    h.api.mockImplementation(async (_matchId, events) =>
      success([
        resultOf(events[0].id, 'rejected', 'INVALID_TRANSITION'),
        resultOf(events[1].id, 'rejected', 'UNKNOWN_TARGET'),
      ]),
    );

    await h.sender.start('acc');

    // Der Server-Code von r1 (UNKNOWN_TARGET) bleibt erhalten -- W4 haengt nur einen
    // Verweis auf den auslösenden Eintrag in `detail` an, statt den Grund zu verlieren.
    expect(await rejectedIn(h, 'acc', 'm4a')).toEqual([
      ['g1', 'INVALID_TRANSITION'],
      ['r1', 'UNKNOWN_TARGET'],
    ]);
    const copy = await h.store.load('acc', 'm4a');
    const r1Entry = copy?.rejected.find((entry) => entry.event.id === 'r1');
    expect(r1Entry?.detail).toEqual({ dependsOnEventId: 'g1' });
  });

  it('4b: W4 -- RETRACT auf ein abgelehntes Ziel ausserhalb des Stapels wird abgelehnt und nicht gesendet', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm4b', ctx);
    for (let i = 1; i <= 49; i += 1) {
      await h.store.addPending('acc', 'm4b', ev({ id: `f${i}`, type: 'GOAL', at: i }));
    }
    await h.store.addPending('acc', 'm4b', ev({ id: 'g1', type: 'GOAL', at: 50 }));
    await h.store.addPending('acc', 'm4b', ev({ id: 'r1', type: 'RETRACT', at: 51, targetId: 'g1' }));
    h.api.mockImplementation(async (_matchId, events) =>
      success(
        events.map((event) =>
          event.id === 'g1' ? resultOf(event.id, 'rejected', 'INVALID_TRANSITION') : resultOf(event.id, 'accepted'),
        ),
      ),
    );

    await h.sender.start('acc');

    expect(h.api).toHaveBeenCalledTimes(1);
    expect(sentIds(h.api)[0]).toHaveLength(50);
    expect(sentIds(h.api)[0]).not.toContain('r1');
    expect(await rejectedIn(h, 'acc', 'm4b')).toEqual([
      ['g1', 'INVALID_TRANSITION'],
      ['r1', 'DEPENDS_ON_REJECTED'],
    ]);
    expect(await idsIn(h, 'acc', 'm4b', 'pending')).toEqual([]);
  });

  it('5: Stapelgrenze -- 120 pending ergeben 3 Aufrufe (50/50/20) in Einfuegereihenfolge', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'm5', ctx);
    for (let i = 1; i <= 120; i += 1) {
      await h.store.addPending('acc', 'm5', ev({ id: `p${i}`, type: 'GOAL', at: i }));
    }

    await h.sender.start('acc');

    const batches = sentIds(h.api);
    expect(batches.map((ids) => ids.length)).toEqual([50, 50, 20]);
    expect(batches.flat()).toEqual(Array.from({ length: 120 }, (_, i) => `p${i + 1}`));
    expect(await idsIn(h, 'acc', 'm5', 'acked')).toHaveLength(120);
    expect(h.catchUps).toEqual(['m5', 'm5', 'm5']);
  });
});
