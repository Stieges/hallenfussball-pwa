/**
 * Task C2b, Aufgabe 5: Zaehlung der wartenden Eintraege vor dem Abmelden.
 * pending + acked aller Kopien des Kontos -- nie geloescht, nur gezaehlt.
 */
import 'fake-indexeddb/auto';
import { describe, expect, it, vi } from 'vitest';
import type { MatchCopy } from '../../../../core/match/client/matchCopy';
import { LocalMatchStore } from '../../../../core/match/client/LocalMatchStore';
import type { EngineEvent, MatchContext } from '../../../../core/match/types';
import { countWaitingEntries } from '../countWaitingEntries';

const CTX: MatchContext = { teamAId: 'team-a', teamBId: 'team-b' };

function ev(id: string): EngineEvent {
  return { id, type: 'GOAL', actor: 'helper', at: 1000, section: 1, clockMs: 0, teamId: 'team-a', payload: {} };
}

function copy(matchId: string, lists: Partial<Pick<MatchCopy, 'pending' | 'acked' | 'rejected' | 'review'>>): MatchCopy {
  return {
    formatVersion: 2,
    accountId: 'acc1',
    matchId,
    ctx: CTX,
    confirmed: [],
    watermarkSeq: 0,
    acked: [],
    pending: [],
    rejected: [],
    review: [],
    updatedAt: 0,
    ...lists,
  };
}

describe('countWaitingEntries', () => {
  it('zaehlt pending und acked aller Kopien', async () => {
    const store = {
      forAccount: vi.fn(async () => [
        copy('m1', { pending: [ev('e1'), ev('e2')], acked: [ev('e3')] }),
        copy('m2', { pending: [ev('e4')], acked: [ev('e5'), ev('e6')] }),
      ]),
    };
    await expect(countWaitingEntries(store, 'acc1')).resolves.toBe(6);
    expect(store.forAccount).toHaveBeenCalledWith('acc1');
  });

  it('zaehlt abgelehnte und wartende Eintraege nicht mit', async () => {
    const store = {
      forAccount: vi.fn(async () => [
        copy('m1', {
          pending: [ev('e1')],
          rejected: [{ event: ev('e2'), code: 'STALE_BASE', rejectedAt: 0 }],
          review: [ev('e3')],
        }),
      ]),
    };
    await expect(countWaitingEntries(store, 'acc1')).resolves.toBe(1);
  });

  it('ohne Kopien ist die Zahl 0', async () => {
    const store = { forAccount: vi.fn(async () => []) };
    await expect(countWaitingEntries(store, 'acc1')).resolves.toBe(0);
  });

  it('misst an der echten lokalen Kopie (fake-indexeddb)', async () => {
    const store = new LocalMatchStore();
    await store.create('acc1', 'cw-1', CTX);
    await store.addPending('acc1', 'cw-1', ev('e1'));
    await store.addPending('acc1', 'cw-1', ev('e2'));
    await store.markAcked('acc1', 'cw-1', ['e2']);
    await expect(countWaitingEntries(store, 'acc1')).resolves.toBe(2);
  });
});
