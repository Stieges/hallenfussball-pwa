/**
 * Task C2a, PC7/RC6: Upgrade-Kette der lokalen Kopie. Eine vorhandene
 * Version-1-Kopie (ohne `rejected`/`review`/`tournamentId`) darf beim Oeffnen
 * mit der neuen Version nichts verlieren.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalMatchStore } from '../LocalMatchStore';
import type { MatchContext } from '../../types';

const ctx: MatchContext = { matchId: 'm1', teamAId: 'teamA', teamBId: 'teamB' };

interface V1Record {
  key: string;
  value: {
    formatVersion: number;
    accountId: string;
    matchId: string;
    ctx: MatchContext;
    confirmed: Array<{ id: string; type: string; at: number; seq: number }>;
    watermarkSeq: number;
    acked: Array<{ id: string; type: string; at: number }>;
    pending: Array<{ id: string; type: string; at: number }>;
    updatedAt: number;
  };
}

/** Schreibt eine Kopie in ALTEN Zustand (DB-Version 1, ohne rejected/review/tournamentId). */
function seedVersion1(record: V1Record): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('hallenfussball-matches', 1);
    open.onupgradeneeded = () => {
      open.result.createObjectStore('matches', { keyPath: 'key' });
    };
    open.onerror = () => reject(open.error ?? new Error('open failed'));
    open.onsuccess = () => {
      const db = open.result;
      const tx = db.transaction('matches', 'readwrite');
      tx.objectStore('matches').put(record);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error ?? new Error('put failed'));
      };
    };
  });
}

describe('LocalMatchStore: Upgrade-Kette', () => {
  beforeEach(() => {
    vi.stubGlobal('indexedDB', new IDBFactory());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('Version 1 -> 2: vorhandene Kopie verliert nichts, neue Listen entstehen leer', async () => {
    await seedVersion1({
      key: 'acc-up|m1',
      value: {
        formatVersion: 1,
        accountId: 'acc-up',
        matchId: 'm1',
        ctx,
        confirmed: [{ id: 'c1', type: 'MATCH_START', at: 100, seq: 1 }],
        watermarkSeq: 4,
        acked: [{ id: 'a1', type: 'GOAL', at: 200 }],
        pending: [{ id: 'p1', type: 'FOUL', at: 300 }],
        updatedAt: 111,
      },
    });

    const store = new LocalMatchStore();
    const copy = await store.load('acc-up', 'm1');

    expect(copy?.confirmed.map((e) => e.id)).toEqual(['c1']);
    expect(copy?.watermarkSeq).toBe(4);
    expect(copy?.acked.map((e) => e.id)).toEqual(['a1']);
    expect(copy?.pending.map((e) => e.id)).toEqual(['p1']);
    expect(copy?.updatedAt).toBe(111);
    expect(copy?.rejected).toEqual([]);
    expect(copy?.review).toEqual([]);
    expect(copy?.tournamentId).toBeUndefined();
    expect(copy?.formatVersion).toBe(2);
  });

  it('nach dem Upgrade sind die neuen Uebergaenge nutzbar', async () => {
    await seedVersion1({
      key: 'acc-up|m2',
      value: {
        formatVersion: 1,
        accountId: 'acc-up',
        matchId: 'm2',
        ctx,
        confirmed: [],
        watermarkSeq: 0,
        acked: [],
        pending: [{ id: 'p1', type: 'GOAL', at: 1 }],
        updatedAt: 5,
      },
    });

    const store = new LocalMatchStore();
    const { matchCopyKey } = await import('../matchCopy');
    await store.rejectAllPending(matchCopyKey('acc-up', 'm2'), 'MATCH_GONE');
    const copy = await store.load('acc-up', 'm2');
    expect(copy?.pending).toEqual([]);
    expect(copy?.rejected.map((e) => e.event.id)).toEqual(['p1']);
    expect(copy?.review).toEqual([]);
  });
});
