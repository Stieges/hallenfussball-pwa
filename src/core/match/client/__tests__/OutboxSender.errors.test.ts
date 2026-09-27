/**
 * Task C2a, Aufgabe 3 (8-12): Fehlerklassen am Sender (RC9, V8) --
 * auth, CLIENT_OUTDATED, notReady, 54000/55000, permanent.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RepositoryError } from '../../../errors';
import { ctx, ev } from './fixtures';
import {
  acceptAll,
  CLOCK_START,
  clientOutdatedResult,
  makeHarness,
  rpcError,
  sentMatches,
  type Harness,
} from './outboxHarness';

async function seed(h: Harness, accountId: string, matchId: string): Promise<void> {
  await h.store.create(accountId, matchId, ctx);
  await h.store.addPending(accountId, matchId, ev({ id: `${matchId}-1`, type: 'GOAL', at: 1 }));
}

async function list(h: Harness, matchId: string, of: 'pending' | 'acked'): Promise<string[]> {
  const copy = await h.store.load('acc', matchId);
  return (copy?.[of] ?? []).map((event) => event.id);
}

describe('OutboxSender: Fehlerklassen', () => {
  beforeEach(() => {
    // Eigene IndexedDB je Test -- dieselben Schluessel duerfen nicht erben.
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('8: auth (42501) haelt alle Spiele an, resumeAuth sendet weiter, nichts wird geloescht', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mA');
    await seed(h, 'acc', 'mB');
    h.api.mockImplementation(async () => {
      throw rpcError('42501', 'permission denied for function append_match_events');
    });

    await h.sender.start('acc');

    expect(h.sender.getStatus().authRequired).toBe(true);
    expect(h.sender.getStatus().lastError).toBe('permission denied for function append_match_events');
    const calls = h.api.mock.calls.length;
    await h.tick(300000);
    expect(h.api.mock.calls.length).toBe(calls);
    expect(await list(h, 'mA', 'pending')).toEqual(['mA-1']);
    expect(await list(h, 'mB', 'pending')).toEqual(['mB-1']);

    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.resumeAuth();

    expect(sentMatches(h.api).sort()).toEqual(expect.arrayContaining(['mA', 'mB']));
    expect(await list(h, 'mA', 'acked')).toEqual(['mA-1']);
    expect(await list(h, 'mB', 'acked')).toEqual(['mB-1']);
    expect(h.sender.getStatus().authRequired).toBe(false);
  });

  it('9: CLIENT_OUTDATED haelt alles an, Eintraege bleiben pending bis start() neu', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mC');
    h.api.mockResolvedValueOnce(clientOutdatedResult());

    await h.sender.start('acc');

    expect(h.sender.getStatus().clientOutdated).toBe(true);
    expect(await list(h, 'mC', 'pending')).toEqual(['mC-1']);
    expect(h.api).toHaveBeenCalledTimes(1);

    await h.tick(300000);
    await h.sender.kick('mC');
    expect(h.api).toHaveBeenCalledTimes(1);

    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.start('acc');

    expect(h.sender.getStatus().clientOutdated).toBe(false);
    expect(await list(h, 'mC', 'acked')).toEqual(['mC-1']);
  });

  it('10a: notReady (22023) pausiert nur dieses Spiel und lehnt nichts ab', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mA');
    await seed(h, 'acc', 'mB');
    h.api.mockImplementation(async (matchId, events) => {
      if (matchId === 'mA') {
        throw rpcError('22023', 'append_match_events: Spiel mA hat noch keine zwei Teams');
      }
      return acceptAll(events);
    });

    await h.sender.start('acc');

    expect(h.sender.getStatus().pausedMatches).toEqual({ mA: 'notReady' });
    expect(h.sender.getStatus().authRequired).toBe(false);
    expect(await list(h, 'mB', 'acked')).toEqual(['mB-1']);
    expect(await list(h, 'mA', 'pending')).toEqual(['mA-1']);
    const copy = await h.store.load('acc', 'mA');
    expect(copy?.rejected).toEqual([]);

    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    await h.sender.notifyMatchChanged('mA');

    expect(await list(h, 'mA', 'acked')).toEqual(['mA-1']);
    expect(h.sender.getStatus().pausedMatches).toEqual({});
  });

  it('C3a-0, M-g: ein erneutes start() (haltAll) hebt auch eine notReady-Pause auf -- sofortiger Neuversuch statt 60s-Frist', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mA');
    h.api.mockImplementationOnce(async () => {
      throw rpcError('22023', 'Spiel mA hat noch keine zwei Teams');
    });

    await h.sender.start('acc');
    expect(h.sender.getStatus().pausedMatches).toEqual({ mA: 'notReady' });

    h.api.mockImplementation(async (_matchId, events) => acceptAll(events));
    // Ein erneutes start() (z. B. nach resumeAuth/online) raeumt ALLE Pausen ab (haltAll),
    // auch notReady -- kein Warten auf die 60s-Frist noetig (Review-Text: harmlos).
    await h.sender.start('acc');

    expect(await list(h, 'mA', 'acked')).toEqual(['mA-1']);
    expect(h.sender.getStatus().pausedMatches).toEqual({});
  });

  it('10b: notReady endet spaetestens nach 60 s von selbst', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mA');
    h.api.mockRejectedValueOnce(rpcError('22023', 'Spiel mA hat noch keine zwei Teams')).mockImplementation(
      async (_matchId, events) => acceptAll(events),
    );

    await h.sender.start('acc');
    expect(h.delays).toEqual([60000]);

    await h.tick(60000);

    expect(h.api).toHaveBeenCalledTimes(2);
    expect(await list(h, 'mA', 'acked')).toEqual(['mA-1']);
  });

  it('11a: 54000 lehnt alle pending des Spiels als MATCH_FULL ab', async () => {
    const h = makeHarness();
    await h.store.create('acc', 'mF', ctx);
    await h.store.addPending('acc', 'mF', ev({ id: 'f1', type: 'GOAL', at: 1 }));
    await h.store.addPending('acc', 'mF', ev({ id: 'f2', type: 'GOAL', at: 2 }));
    h.api.mockImplementation(async () => {
      throw rpcError('54000', 'append_match_events: Spiel mF ist voll');
    });

    await h.sender.start('acc');

    const copy = await h.store.load('acc', 'mF');
    expect(copy?.pending).toEqual([]);
    expect(copy?.rejected.map((entry) => [entry.event.id, entry.code])).toEqual([
      ['f1', 'MATCH_FULL'],
      ['f2', 'MATCH_FULL'],
    ]);
    expect(h.sender.getStatus().rejectedByMatch).toEqual({ mF: 2 });
    // C3a-0, M-g: `rejectedAt` kommt aus der injizierten Uhr (`now()`), nicht aus `Date.now()`.
    expect(copy?.rejected.every((entry) => entry.rejectedAt === CLOCK_START)).toBe(true);
  });

  it('11b: 55000 lehnt alle pending des Spiels als MATCH_GONE ab', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mG');
    h.api.mockImplementation(async () => {
      throw rpcError('55000', 'append_match_events: Spiel mG nicht mehr beschreibbar');
    });

    await h.sender.start('acc');

    const copy = await h.store.load('acc', 'mG');
    expect(copy?.pending).toEqual([]);
    expect(copy?.rejected.map((entry) => entry.code)).toEqual(['MATCH_GONE']);
  });

  it('12: permanent laesst die Eintraege pending, setzt lastError und wartet 30 s', async () => {
    const h = makeHarness();
    await seed(h, 'acc', 'mP');
    h.api.mockImplementation(async () => {
      throw new RepositoryError('appendMatchEvents', 'Unerwartete Antwort von append_match_events', {
        code: 'XX000',
        message: 'kaputt',
        details: '',
        hint: '',
      });
    });

    await h.sender.start('acc');

    expect(await list(h, 'mP', 'pending')).toEqual(['mP-1']);
    expect(h.sender.getStatus().lastError).toBe('Unerwartete Antwort von append_match_events');
    expect(h.delays).toEqual([30000]);
  });
});
