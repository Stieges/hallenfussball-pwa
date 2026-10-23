import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalMatchStore, matchCopyKey } from '../LocalMatchStore';
import type { MatchContext } from '../../';
import { ctx, ev, withSeq } from './fixtures';

describe('LocalMatchStore', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('erstellt und laedt eine Kopie', async () => {
    await store.create('guest', 'lms-1', ctx);
    const copy = await store.load('guest', 'lms-1');
    expect(copy).not.toBeNull();
    expect(copy?.matchId).toBe('lms-1');
    expect(copy?.formatVersion).toBe(2);
  });

  it('resetConfirmed: confirmed/watermark leeren, acked/pending/rejected bleiben (atomar, W2)', async () => {
    await store.create('acc-reset', 'lms-reset', ctx);
    await store.applyConfirmed(
      'acc-reset',
      'lms-reset',
      [withSeq(ev({ id: 'c1', type: 'GOAL', at: 1000, teamId: 'teamA' }), 1)],
      1,
    );
    await store.addPending('acc-reset', 'lms-reset', ev({ id: 'p1', type: 'GOAL', at: 2000, teamId: 'teamA' }));
    await store.rejectAllPending(matchCopyKey('acc-reset', 'lms-reset'), 'MATCH_FULL', 3000);

    await store.resetConfirmed('acc-reset', 'lms-reset');
    const copy = await store.load('acc-reset', 'lms-reset');
    expect(copy?.confirmed).toEqual([]);
    expect(copy?.watermarkSeq).toBe(0);
    expect(copy?.rejected.map((r) => r.event.id)).toEqual(['p1']);
  });

  it('Lebenszyklus: pending -> acked -> confirmed', async () => {
    await store.create('acc1', 'lms-2', ctx);
    await store.addPending('acc1', 'lms-2', withSeq(ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }), 1));
    let copy = await store.load('acc1', 'lms-2');
    expect(copy?.pending.map((e) => e.id)).toEqual(['e1']);

    await store.markAcked('acc1', 'lms-2', ['e1']);
    copy = await store.load('acc1', 'lms-2');
    expect(copy?.pending).toEqual([]);
    expect(copy?.acked.map((e) => e.id)).toEqual(['e1']);

    await store.applyConfirmed('acc1', 'lms-2', [withSeq(ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }), 1)], 1);
    copy = await store.load('acc1', 'lms-2');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['e1']);
    expect(copy?.acked).toEqual([]);
    expect(copy?.pending).toEqual([]);
    expect(copy?.watermarkSeq).toBe(1);
  });

  it('Neustart: eine neue Store-Instanz liest alles wieder (pending ohne seq, N5)', async () => {
    await store.create('acc-restart', 'lms-3', ctx);
    await store.addPending('acc-restart', 'lms-3', ev({ id: 'r1', type: 'FOUL', at: 2000 }));

    const restarted = new LocalMatchStore();
    const copy = await restarted.load('acc-restart', 'lms-3');
    expect(copy?.pending.map((e) => e.id)).toEqual(['r1']);
  });

  it('trennt Konten korrekt', async () => {
    await store.create('acc-a', 'lms-4', ctx);
    await store.create('acc-b', 'lms-4', ctx);
    const forA = await store.forAccount('acc-a');
    const forB = await store.forAccount('acc-b');
    expect(forA.filter((c) => c.matchId === 'lms-4').map((c) => c.accountId)).toEqual(['acc-a']);
    expect(forB.filter((c) => c.matchId === 'lms-4').map((c) => c.accountId)).toEqual(['acc-b']);
  });

  it('removePending entfernt die Eintraege und liefert sie zurueck', async () => {
    await store.create('acc3', 'lms-5', ctx);
    await store.addPending('acc3', 'lms-5', withSeq(ev({ id: 'p1', type: 'GOAL', at: 1 }), 1));
    await store.addPending('acc3', 'lms-5', withSeq(ev({ id: 'p2', type: 'GOAL', at: 2 }), 2));
    const removed = await store.removePending('acc3', 'lms-5', ['p1']);
    expect(removed.map((e) => e.id)).toEqual(['p1']);
    const copy = await store.load('acc3', 'lms-5');
    expect(copy?.pending.map((e) => e.id)).toEqual(['p2']);
  });

  it('applyConfirmed ignoriert Duplikate und entfernt dieselben IDs aus acked und pending', async () => {
    await store.create('acc4', 'lms-6', ctx);
    await store.addPending('acc4', 'lms-6', withSeq(ev({ id: 'd1', type: 'GOAL', at: 1 }), 1));
    await store.markAcked('acc4', 'lms-6', ['d1']);
    await store.addPending('acc4', 'lms-6', withSeq(ev({ id: 'd2', type: 'GOAL', at: 2 }), 2));
    const confirmedEvent = withSeq(ev({ id: 'd1', type: 'GOAL', at: 1 }), 1);
    await store.applyConfirmed('acc4', 'lms-6', [confirmedEvent, confirmedEvent], 2);
    const copy = await store.load('acc4', 'lms-6');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['d1']);
    expect(copy?.acked).toEqual([]);
    expect(copy?.pending.map((e) => e.id)).toEqual(['d2']);
    expect(copy?.watermarkSeq).toBe(2);
  });

  it('applyConfirmed senkt den Wasserstand nicht (spaetes aelteres Nachladen)', async () => {
    await store.create('acc5', 'lms-7', ctx);
    await store.applyConfirmed('acc5', 'lms-7', [], 10);
    await store.applyConfirmed('acc5', 'lms-7', [], 5);
    const copy = await store.load('acc5', 'lms-7');
    expect(copy?.watermarkSeq).toBe(10);
  });

  it('addPending, markAcked und removePending lassen den Wasserstand unveraendert (RC7, N4)', async () => {
    await store.create('acc-w', 'lms-23', ctx);
    await store.applyConfirmed('acc-w', 'lms-23', [], 7);

    await store.addPending('acc-w', 'lms-23', withSeq(ev({ id: 'w1', type: 'GOAL', at: 1 }), 8));
    let copy = await store.load('acc-w', 'lms-23');
    expect(copy?.watermarkSeq).toBe(7);

    await store.markAcked('acc-w', 'lms-23', ['w1']);
    copy = await store.load('acc-w', 'lms-23');
    expect(copy?.watermarkSeq).toBe(7);

    await store.removePending('acc-w', 'lms-23', ['w1']);
    copy = await store.load('acc-w', 'lms-23');
    expect(copy?.watermarkSeq).toBe(7);
  });

  it('markAcked mit unbekannten IDs laesst pending und acked unveraendert', async () => {
    await store.create('acc6', 'lms-17', ctx);
    await store.addPending('acc6', 'lms-17', withSeq(ev({ id: 'u1', type: 'GOAL', at: 1 }), 1));
    await store.markAcked('acc6', 'lms-17', ['unbekannt']);
    const copy = await store.load('acc6', 'lms-17');
    expect(copy?.pending.map((e) => e.id)).toEqual(['u1']);
    expect(copy?.acked).toEqual([]);
  });

  it('forAccount liefert alle Spiele eines Kontos', async () => {
    await store.create('acc-multi', 'lms-18', ctx);
    await store.create('acc-multi', 'lms-19', ctx);
    const matches = (await store.forAccount('acc-multi')).map((c) => c.matchId);
    expect(matches).toContain('lms-18');
    expect(matches).toContain('lms-19');
    expect(matches).toHaveLength(2);
  });

  it('create ueberschreibt eine bestehende Kopie nie still (Ausgang bleibt erhalten, N2)', async () => {
    await store.create('acc-keep', 'lms-21', ctx);
    await store.addPending('acc-keep', 'lms-21', withSeq(ev({ id: 'k1', type: 'GOAL', at: 1 }), 1));
    await store.markAcked('acc-keep', 'lms-21', ['k1']);
    await store.addPending('acc-keep', 'lms-21', withSeq(ev({ id: 'k2', type: 'GOAL', at: 2 }), 2));
    await store.applyConfirmed('acc-keep', 'lms-21', [withSeq(ev({ id: 'c9', type: 'GOAL', at: 0 }), 3)], 3);

    const newCtx: MatchContext = { matchId: 'lms-21', teamAId: 't-x', teamBId: 't-y' };
    await store.create('acc-keep', 'lms-21', newCtx);

    const copy = await store.load('acc-keep', 'lms-21');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['c9']);
    expect(copy?.acked.map((e) => e.id)).toEqual(['k1']);
    expect(copy?.pending.map((e) => e.id)).toEqual(['k2']);
    expect(copy?.watermarkSeq).toBe(3);
    expect(copy?.ctx).toEqual(newCtx);
  });

  it('applyConfirmed sortiert den bestaetigten Log nach seq', async () => {
    await store.create('acc-sort', 'lms-22', ctx);
    await store.applyConfirmed(
      'acc-sort',
      'lms-22',
      [withSeq(ev({ id: 's2', type: 'GOAL', at: 2 }), 2), withSeq(ev({ id: 's1', type: 'GOAL', at: 1 }), 1)],
      2,
    );
    const copy = await store.load('acc-sort', 'lms-22');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['s1', 's2']);
    expect(copy?.confirmed.map((e) => e.seq)).toEqual([1, 2]);
  });

  it('meldet fehlende Kopien als Fehler (addPending, markAcked, applyConfirmed, removePending)', async () => {
    await expect(
      store.addPending('acc-none', 'lms-20', withSeq(ev({ id: 'n1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toThrow(/not found/);
    await expect(store.markAcked('acc-none', 'lms-20', ['n1'])).rejects.toThrow(/not found/);
    await expect(store.applyConfirmed('acc-none', 'lms-20', [], 1)).rejects.toThrow(/not found/);
    await expect(store.removePending('acc-none', 'lms-20', ['n1'])).rejects.toThrow(/not found/);
  });
});
