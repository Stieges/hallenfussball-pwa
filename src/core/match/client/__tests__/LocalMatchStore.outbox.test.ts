/**
 * Task C2a, PC7: atomare Uebergaenge am Ausgang (pending -> acked/rejected/review).
 * `resolveBatch` in EINER Transaktion, `rejectAllPending`/`dismissRejected` fuer
 * D-C1 und die Fehlerklassen 54000/55000.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalMatchStore } from '../LocalMatchStore';
import { matchCopyKey, type RejectedEntry } from '../matchCopy';
import { ctx, ev } from './fixtures';

/** Bricht die Transaktion nach jedem erfolgreichen `put` ab (Abbruch beim Commit). */
function failCommitAfterPutSuccess(): void {
  const originalPut = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value: object,
    key?: IDBValidKey,
  ) {
    const req = key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    req.addEventListener('success', () => this.transaction.abort(), { once: true });
    return req;
  });
}

function rejectedEntry(id: string, code: string, rejectedAt = 4711): RejectedEntry {
  return { event: ev({ id, type: 'GOAL', at: 1000, teamId: 'teamA' }), code, rejectedAt };
}

describe('LocalMatchStore: Ausgang', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('create speichert tournamentId und ergaenzt es spaeter nur bei Uebergabe', async () => {
    await store.create('acc-t', 'ob-1', ctx, 'turn-1');
    let copy = await store.load('acc-t', 'ob-1');
    expect(copy?.tournamentId).toBe('turn-1');

    await store.create('acc-t', 'ob-1', { ...ctx, teamAId: 'teamX' });
    copy = await store.load('acc-t', 'ob-1');
    expect(copy?.tournamentId).toBe('turn-1');
    expect(copy?.ctx.teamAId).toBe('teamX');

    await store.create('acc-t', 'ob-2', ctx);
    copy = await store.load('acc-t', 'ob-2');
    expect(copy?.tournamentId).toBeUndefined();
  });

  it('resolveBatch verschiebt acked, rejected und review in einem Schritt', async () => {
    await store.create('acc-r', 'ob-3', ctx);
    await store.addPending('acc-r', 'ob-3', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await store.addPending('acc-r', 'ob-3', ev({ id: 'r1', type: 'RETRACT', at: 2, targetId: 'a1' }));
    await store.addPending('acc-r', 'ob-3', ev({ id: 'v1', type: 'REVIEW_ACCEPT', at: 3, targetId: 'a1' }));
    await store.addPending('acc-r', 'ob-3', ev({ id: 'p1', type: 'FOUL', at: 4 }));

    await store.resolveBatch(matchCopyKey('acc-r', 'ob-3'), {
      ackedIds: ['a1'],
      rejected: [{ event: ev({ id: 'r1', type: 'RETRACT', at: 2, targetId: 'a1' }), code: 'UNKNOWN_TARGET', rejectedAt: 77 }],
      reviewIds: ['v1'],
    });

    const copy = await store.load('acc-r', 'ob-3');
    expect(copy?.acked.map((e) => e.id)).toEqual(['a1']);
    expect(copy?.review.map((e) => e.id)).toEqual(['v1']);
    expect(copy?.rejected.map((e) => e.event.id)).toEqual(['r1']);
    expect(copy?.rejected[0]?.code).toBe('UNKNOWN_TARGET');
    expect(copy?.rejected[0]?.rejectedAt).toBe(77);
    expect(copy?.pending.map((e) => e.id)).toEqual(['p1']);
  });

  it('resolveBatch ist atomar: Fehler beim Commit laesst die Kopie unveraendert', async () => {
    await store.create('acc-a', 'ob-4', ctx);
    await store.addPending('acc-a', 'ob-4', ev({ id: 'a1', type: 'GOAL', at: 1 }));
    await store.addPending('acc-a', 'ob-4', ev({ id: 'r1', type: 'FOUL', at: 2 }));
    failCommitAfterPutSuccess();

    await expect(
      store.resolveBatch(matchCopyKey('acc-a', 'ob-4'), {
        ackedIds: ['a1'],
        rejected: [rejectedEntry('r1', 'INVALID_TRANSITION')],
        reviewIds: [],
      }),
    ).rejects.toThrow();

    vi.restoreAllMocks();
    const copy = await store.load('acc-a', 'ob-4');
    expect(copy?.pending.map((e) => e.id)).toEqual(['a1', 'r1']);
    expect(copy?.acked).toEqual([]);
    expect(copy?.rejected).toEqual([]);
    expect(copy?.review).toEqual([]);
  });

  it('rejectAllPending verschiebt alle pending mit Code und rejectedAt', async () => {
    await store.create('acc-f', 'ob-5', ctx);
    await store.addPending('acc-f', 'ob-5', ev({ id: 'm1', type: 'MATCH_START', at: 1 }));
    await store.addPending('acc-f', 'ob-5', ev({ id: 'g1', type: 'GOAL', at: 2 }));

    await store.rejectAllPending(matchCopyKey('acc-f', 'ob-5'), 'MATCH_FULL');

    const copy = await store.load('acc-f', 'ob-5');
    expect(copy?.pending).toEqual([]);
    expect(copy?.rejected.map((e) => [e.event.id, e.code])).toEqual([
      ['m1', 'MATCH_FULL'],
      ['g1', 'MATCH_FULL'],
    ]);
    expect(copy?.rejected.every((e) => typeof e.rejectedAt === 'number' && e.rejectedAt > 0)).toBe(true);
    expect(copy?.acked).toEqual([]);
  });

  it('dismissRejected entfernt nur die bestaetigten Ablehnungen (D-C1 „Verstanden")', async () => {
    await store.create('acc-d', 'ob-6', ctx);
    await store.addPending('acc-d', 'ob-6', ev({ id: 'x1', type: 'GOAL', at: 1 }));
    await store.addPending('acc-d', 'ob-6', ev({ id: 'x2', type: 'GOAL', at: 2 }));
    await store.rejectAllPending(matchCopyKey('acc-d', 'ob-6'), 'MATCH_GONE');

    await store.dismissRejected(matchCopyKey('acc-d', 'ob-6'), ['x1', 'unbekannt']);

    const copy = await store.load('acc-d', 'ob-6');
    expect(copy?.rejected.map((e) => e.event.id)).toEqual(['x2']);
  });

  it('die Uebergaenge lassen Wasserstand und confirmed unberuehrt', async () => {
    await store.create('acc-w', 'ob-7', ctx);
    await store.applyConfirmed('acc-w', 'ob-7', [], 9);
    await store.addPending('acc-w', 'ob-7', ev({ id: 'w1', type: 'GOAL', at: 1 }));
    await store.addPending('acc-w', 'ob-7', ev({ id: 'w2', type: 'FOUL', at: 2 }));

    await store.resolveBatch(matchCopyKey('acc-w', 'ob-7'), {
      ackedIds: ['w1'],
      rejected: [],
      reviewIds: [],
    });
    await store.rejectAllPending(matchCopyKey('acc-w', 'ob-7'), 'MATCH_GONE');

    const copy = await store.load('acc-w', 'ob-7');
    expect(copy?.watermarkSeq).toBe(9);
    expect(copy?.confirmed).toEqual([]);
    expect(copy?.acked.map((e) => e.id)).toEqual(['w1']);
  });
});
