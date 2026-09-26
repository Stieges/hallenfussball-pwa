import 'fake-indexeddb/auto';
import { IDBVersionChangeEvent } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LocalMatchStore, LocalStoreFullError } from '../LocalMatchStore';
import type { EngineEvent, MatchContext } from '../../';
import type { EngineEventWithSeq } from '../catchUp';

const ctx: MatchContext = { matchId: 'm1', teamAId: 't-a', teamBId: 't-b' };

function ev(partial: Partial<EngineEvent> & Pick<EngineEvent, 'id' | 'type' | 'at'>): EngineEvent {
  return { actor: 'helper', section: 1, clockMs: null, payload: {}, ...partial };
}

function withSeq(event: EngineEvent, seq: number): EngineEventWithSeq {
  return { ...event, seq };
}

/**
 * Laesst jeden `put`-Request erfolgreich werden und bricht DANACH die Transaktion ab
 * (Abbruch beim Commit, z.B. Quota). Wer nur auf `request.onsuccess` aufloest, merkt
 * den Abbruch nicht -- wer auf `tx.oncomplete` wartet, bekommt einen Fehler.
 * Mit `error` wird zusaetzlich `tx.error` gesetzt (so melden Browser Quota-Abbrueche).
 */
function failCommitAfterPutSuccess(error?: DOMException): void {
  const originalPut = IDBObjectStore.prototype.put;
  vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(function (
    this: IDBObjectStore,
    value: object,
    key?: IDBValidKey,
  ) {
    const req = key === undefined ? originalPut.call(this, value) : originalPut.call(this, value, key);
    req.addEventListener(
      'success',
      () => {
        if (error) {
          Object.defineProperty(this.transaction, 'error', { configurable: true, value: error });
        }
        this.transaction.abort();
      },
      { once: true },
    );
    return req;
  });
}

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
    expect(copy?.formatVersion).toBe(1);
  });

  it('Lebenszyklus: pending -> acked -> confirmed', async () => {
    await store.create('acc1', 'lms-2', ctx);
    await store.addPending('acc1', 'lms-2', withSeq(ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 't-a' }), 1));
    let copy = await store.load('acc1', 'lms-2');
    expect(copy?.pending.map((e) => e.id)).toEqual(['e1']);

    await store.markAcked('acc1', 'lms-2', ['e1']);
    copy = await store.load('acc1', 'lms-2');
    expect(copy?.pending).toEqual([]);
    expect(copy?.acked.map((e) => e.id)).toEqual(['e1']);

    await store.applyConfirmed('acc1', 'lms-2', [withSeq(ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 't-a' }), 1)], 1);
    copy = await store.load('acc1', 'lms-2');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['e1']);
    expect(copy?.acked).toEqual([]);
    expect(copy?.pending).toEqual([]);
    expect(copy?.watermarkSeq).toBe(1);
  });

  it('Neustart: eine neue Store-Instanz liest alles wieder', async () => {
    await store.create('acc-restart', 'lms-3', ctx);
    await store.addPending('acc-restart', 'lms-3', withSeq(ev({ id: 'r1', type: 'FOUL', at: 2000 }), 5));

    const restarted = new LocalMatchStore();
    const copy = await restarted.load('acc-restart', 'lms-3');
    expect(copy?.pending.map((e) => e.id)).toEqual(['r1']);
    expect(copy?.pending[0]?.seq).toBe(5);
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
});

describe('LocalMatchStore: Speicherfehler', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uebersetzt QuotaExceededError beim Speichern (synchroner Abbruch) in LocalStoreFullError', async () => {
    await store.create('acc-q', 'lms-8', ctx);
    vi.spyOn(IDBObjectStore.prototype, 'put').mockImplementation(() => {
      throw new DOMException('quota exceeded', 'QuotaExceededError');
    });

    await expect(
      store.addPending('acc-q', 'lms-8', withSeq(ev({ id: 'q1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toBeInstanceOf(LocalStoreFullError);
  });

  it('uebersetzt einen Quota-Abbruch beim Commit (tx.error) in LocalStoreFullError', async () => {
    await store.create('acc-q', 'lms-16', ctx);
    failCommitAfterPutSuccess(new DOMException('quota exceeded', 'QuotaExceededError'));

    await expect(
      store.addPending('acc-q', 'lms-16', withSeq(ev({ id: 'q2', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toBeInstanceOf(LocalStoreFullError);
  });

  it('behandelt nicht-quota Transaktionsabbrueche NICHT als LocalStoreFullError', async () => {
    await store.create('acc-x', 'lms-9', ctx);
    failCommitAfterPutSuccess();

    await expect(
      store.addPending('acc-x', 'lms-9', withSeq(ev({ id: 'x1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.not.toBeInstanceOf(LocalStoreFullError);
  });

  it('loest erst nach dem Commit der Transaktion auf (Abbruch beim Commit wird gemeldet)', async () => {
    await store.create('acc-c', 'lms-10', ctx);
    failCommitAfterPutSuccess();

    await expect(
      store.addPending('acc-c', 'lms-10', withSeq(ev({ id: 'c1', type: 'GOAL', at: 1 }), 1)),
    ).rejects.toThrow();
  });
});

describe('LocalMatchStore: Gastmodus (V14)', () => {
  let store: LocalMatchStore;

  beforeEach(() => {
    store = new LocalMatchStore();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('addConfirmedLocal legt fortlaufende lokale seq an, ohne die Eingabe zu veraendern', async () => {
    await store.create('guest', 'lms-11', ctx);
    const first = ev({ id: 'g1', type: 'GOAL', at: 500, teamId: 't-a' });
    const second = ev({ id: 'g2', type: 'GOAL', at: 600, teamId: 't-b' });
    await store.addConfirmedLocal('guest', 'lms-11', first);
    await store.addConfirmedLocal('guest', 'lms-11', second);

    expect(Object.hasOwn(first, 'seq')).toBe(false);
    expect(Object.hasOwn(second, 'seq')).toBe(false);

    const copy = await store.load('guest', 'lms-11');
    expect(copy?.confirmed.map((e) => e.id)).toEqual(['g1', 'g2']);
    expect(copy?.confirmed.map((e) => e.seq)).toEqual([1, 2]);
    expect(copy?.acked).toEqual([]);
    expect(copy?.pending).toEqual([]);
  });

  it('addConfirmedLocal wirft, wenn keine Kopie existiert (erst create)', async () => {
    await expect(
      store.addConfirmedLocal('guest', 'lms-12', ev({ id: 'g3', type: 'GOAL', at: 1 })),
    ).rejects.toThrow(/not found/);
  });

  it('addConfirmedLocal lehnt Konten ausserhalb des Gastmodus ab', async () => {
    await store.create('acc-not-guest', 'lms-13', ctx);
    await expect(
      store.addConfirmedLocal('acc-not-guest', 'lms-13', ev({ id: 'g4', type: 'GOAL', at: 1 })),
    ).rejects.toThrow(/guest/);
  });
});

describe('LocalMatchStore: Datenbank-Lebenszyklus (I9)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('haelt eine Verbindung offen (indexedDB.open nur einmal fuer mehrere Operationen)', async () => {
    const store = new LocalMatchStore();
    await store.create('acc-db', 'lms-14', ctx);
    const openSpy = vi.spyOn(indexedDB, 'open');
    await store.load('acc-db', 'lms-14');
    await store.load('acc-db', 'lms-14');
    await store.forAccount('acc-db');
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('schliesst die Verbindung bei versionchange und oeffnet bei Bedarf neu', async () => {
    const store = new LocalMatchStore();
    const openSpy = vi.spyOn(indexedDB, 'open');
    await store.create('acc-db', 'lms-15', ctx);
    const openRequest = openSpy.mock.results[0]?.value;
    expect(openRequest).toBeDefined();
    openRequest?.result.dispatchEvent(new IDBVersionChangeEvent('versionchange'));

    const copy = await store.load('acc-db', 'lms-15');
    expect(copy?.matchId).toBe('lms-15');
    expect(openSpy).toHaveBeenCalledTimes(2);
  });
});
