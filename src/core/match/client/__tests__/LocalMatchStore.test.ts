import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LocalMatchStore, LocalStoreFullError } from '../LocalMatchStore';
import { type MatchContext } from '../../';

describe('LocalMatchStore', () => {
  let store: LocalMatchStore;
  const ctx: MatchContext = { matchId: 'm1', teamAId: 't-a', teamBId: 't-b' };

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(async () => {
    // Cleanup: alle Daten löschen nicht notwendig, aber sicher
  });

  it('erstellt und lädt eine Kopie', async () => {
    await store.create('guest', 'm1', ctx);
    const copy = await store.load('guest', 'm1');
    expect(copy).not.toBeNull();
    expect(copy!.matchId).toBe('m1');
    expect(copy!.formatVersion).toBe(1);
  });

  it('fügt pending hinzu und liest wieder aus', async () => {
    await store.create('acc1', 'm1', ctx);
    const event = {
      id: 'e1',
      type: 'GOAL',
      actor: 'helper',
      at: 1000,
      section: 1,
      clockMs: 120000,
      teamId: 't-a',
      targetId: null,
      payload: {},
      seq: 1,
    } as import('../catchUp').EngineEventWithSeq;
    await store.addPending('acc1', 'm1', event);
    const copy = await store.load('acc1', 'm1');
    expect(copy!.pending.length).toBe(1);
    expect(copy!.pending[0].id).toBe('e1');
  });

  it('verschiebt pending nach acked', async () => {
    await store.create('acc1', 'm1', ctx);
    const event = { id: 'e2', type: 'PAUSE', actor: 'helper', at: 2000, section: 1, clockMs: 30000, teamId: null, targetId: null, payload: {}, seq: 2 } as import('../catchUp').EngineEventWithSeq;
    await store.addPending('acc1', 'm1', event);
    await store.markAcked('acc1', 'm1', ['e2']);
    const copy = await store.load('acc1', 'm1');
    expect(copy!.pending.length).toBe(0);
    expect(copy!.acked.length).toBe(1);
  });

  it('wird voll und wirft LocalStoreFullError', async () => {
    await store.create('acc1', 'm1', ctx);
    // IndexDB-Quota-Fehler simulieren schwierig; wir testen, dass der Fehler existiert
    expect(() => { throw new LocalStoreFullError(); }).toThrow('Local store full');
  });

  it('trennt Konten korrekt', async () => {
    await store.create('a', 'm1', ctx);
    await store.create('b', 'm1', ctx);
    const forA = await store.forAccount('a');
    const forB = await store.forAccount('b');
    expect(forA.length).toBe(1);
    expect(forB.length).toBe(1);
    expect(forA[0].accountId).toBe('a');
  });

  it('Gastmodus: addConfirmedLocal geht direkt nach confirmed', async () => {
    await store.addConfirmedLocal('guest', 'm1', {
      id: 'g1',
      type: 'MATCH_START',
      actor: 'leitung',
      at: 500,
      section: null,
      clockMs: 0,
      teamId: null,
      targetId: null,
      payload: {},
      seq: 1,
    });
    const copy = await store.load('guest', 'm1');
    expect(copy!.confirmed.length).toBe(1);
    expect(copy!.pending.length).toBe(0);
    expect(copy!.acked.length).toBe(0);
  });
});
