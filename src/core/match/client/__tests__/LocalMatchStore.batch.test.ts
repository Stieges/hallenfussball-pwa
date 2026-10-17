/** B-07a: Stapel-Schreiben des Stores -- alle Eintraege in EINER Transaktion oder keiner (R12). */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';
import { LocalMatchStore, matchCopyKey } from '../LocalMatchStore';
import { buildResolution } from '../outboxResolution';
import { resultOf } from './outboxHarness';
import { ctx, ev } from './fixtures';

const unskip = ev({ id: 'u1', type: 'UNSKIP', at: 1, actor: 'leitung' });
const result = ev({ id: 'r1', type: 'RESULT_ENTRY', at: 2, actor: 'leitung', payload: { scores: { teamA: 3, teamB: 1 } } });

describe('LocalMatchStore Stapel (B-07a)', () => {
  it('addPendingBatch haengt beide Eintraege in Reihenfolge an pending', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-batch', 'mb1', ctx);
    await store.addPendingBatch('acc-batch', 'mb1', [unskip, result]);
    const copy = await store.load('acc-batch', 'mb1');
    expect(copy?.pending.map((e) => e.id)).toEqual(['u1', 'r1']);
  });

  it('Gegenbeispiel: ohne lokale Kopie wirft der Stapel und speichert nichts', async () => {
    const store = new LocalMatchStore();
    await expect(store.addPendingBatch('acc-batch', 'mb-fehlt', [unskip, result])).rejects.toThrow();
    expect(await store.load('acc-batch', 'mb-fehlt')).toBeNull();
  });

  it('addConfirmedLocalBatch (Gast): fortlaufende seq, Wasserstand folgt', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mb2', ctx);
    await store.addConfirmedLocalBatch('guest', 'mb2', [unskip, result]);
    const copy = await store.load('guest', 'mb2');
    expect(copy?.confirmed.map((e) => [e.id, e.seq])).toEqual([['u1', 1], ['r1', 2]]);
    expect(copy?.watermarkSeq).toBe(2);
  });

  it('Gegenbeispiel: addConfirmedLocalBatch fuer ein Konto ausser guest wirft', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-batch', 'mb3', ctx);
    await expect(store.addConfirmedLocalBatch('acc-batch', 'mb3', [unskip, result])).rejects.toThrow();
  });

  it('Atomik: addPendingBatch nutzt genau EINE readwrite-Transaktion (R12), nicht eine je Eintrag', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-batch', 'mb4', ctx);
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction');
    try {
      await store.addPendingBatch('acc-batch', 'mb4', [unskip, result]);
      const writes = spy.mock.calls.filter(([, mode]) => mode === 'readwrite');
      expect(writes).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('Atomik: addConfirmedLocalBatch nutzt genau EINE readwrite-Transaktion', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mb5', ctx);
    const spy = vi.spyOn(IDBDatabase.prototype, 'transaction');
    try {
      await store.addConfirmedLocalBatch('guest', 'mb5', [unskip, result]);
      expect(spy.mock.calls.filter(([, mode]) => mode === 'readwrite')).toHaveLength(1);
    } finally {
      spy.mockRestore();
    }
  });

  it('@FU-093 Client-Kaskade: der Server lehnt nur UNSKIP ab (RESULT_ENTRY nicht im Aufruf) -> RESULT_ENTRY ist DEPENDS_ON_REJECTED, Ausgang leer', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-batch', 'mb6', ctx);
    await store.addPendingBatch('acc-batch', 'mb6', [unskip, result]);
    // Stapelgrenze: nur UNSKIP wurde gesendet und abgelehnt
    const { resolution } = buildResolution([unskip], [resultOf('u1', 'rejected', 'INVALID_TRANSITION')], 10);
    await store.resolveBatch(matchCopyKey('acc-batch', 'mb6'), resolution);
    const copy = await store.load('acc-batch', 'mb6');
    expect(copy?.pending).toEqual([]);
    expect(copy?.rejected.map((entry) => [entry.event.id, entry.code])).toEqual([
      ['u1', 'INVALID_TRANSITION'],
      ['r1', 'DEPENDS_ON_REJECTED'],
    ]);
  });
});
