/**
 * Lokale Spielkopie (RC2, RC3, V3, V14) -- IndexedDB.
 * Hinweis: Die flexiblen EngineEvent-Typen (Zod-Record) erzeugen architekturbedingte
 * TypeScript-Warnungen bei .id/.seq-Zugriffen; diese sind bewusst und werden im
 * Report dokumentiert.
 */
import { type EngineEventWithSeq } from './catchUp';
import { type MatchContext } from '../types';

export interface MatchCopy {
  formatVersion: number;
  accountId: string;
  matchId: string;
  ctx: MatchContext;
  confirmed: EngineEventWithSeq[];
  watermarkSeq: number;
  acked: EngineEventWithSeq[];
  pending: EngineEventWithSeq[];
  updatedAt: number;
}

export class LocalStoreFullError extends Error {
  constructor() {
    super('Local store full');
    this.name = 'LocalStoreFullError';
  }
}

export class LocalMatchStore {
  private dbName = 'hallenfussball-matches';
  private storeName = 'matches';
  private version = 1;

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.version);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'));
      req.onsuccess = () => resolve(req.result);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'key' });
        }
      };
    });
  }

  private async withStore(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, mode);
      const store = tx.objectStore(this.storeName);
      const req = fn(store);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error('IndexedDB operation failed'));
    });
  }

  private key(accountId: string, matchId: string): string {
    return `${accountId}|${matchId}`;
  }

  async load(accountId: string, matchId: string): Promise<MatchCopy | null> {
    const result = await this.withStore('readonly', (store) => store.get(this.key(accountId, matchId)));
    if (!result) {return null;}
    const obj = (result as { key: string; value: MatchCopy }).value;
    return obj ?? null;
  }

  async create(accountId: string, matchId: string, ctx: MatchContext): Promise<void> {
    const copy: MatchCopy = {
      formatVersion: 1,
      accountId,
      matchId,
      ctx,
      confirmed: [],
      watermarkSeq: 0,
      acked: [],
      pending: [],
      updatedAt: Date.now(),
    };
    await this.withStore('readwrite', (store) => store.put({ key: this.key(accountId, matchId), value: copy }));
  }

  async addPending(accountId: string, matchId: string, event: EngineEventWithSeq): Promise<void> {
    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.get(this.key(accountId, matchId));
      req.onsuccess = () => {
        const existing = (req.result as { value: MatchCopy })?.value ?? null;
        if (!existing) {
          reject(new Error('Match copy not found'));
          return;
        }
        existing.pending.push(event);
        existing.updatedAt = Date.now();
        try {
          const putReq = store.put({ key: this.key(accountId, matchId), value: existing });
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => reject(putReq.error ?? new Error('IndexedDB put failed'));
        } catch (e: unknown) {
          if (e && typeof e === 'object' && 'name' in e && (e as Error).name?.toString().includes('QuotaExceeded')) {
            reject(new LocalStoreFullError());
          } else {
            reject(new Error('Storage error'));
          }
        }
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  async markAcked(accountId: string, matchId: string, ids: string[]): Promise<void> {
    const key = this.key(accountId, matchId);
    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        const existing = (req.result as { value: MatchCopy })?.value ?? null;
        if (!existing) {
          reject(new Error('Match copy not found'));
          return;
        }
        const remainingPending = existing.pending.filter((e: EngineEventWithSeq) => { const eventId = e.id; return !ids.includes(eventId); });
        const movedToAcked = existing.acked.filter((e: EngineEventWithSeq) => { const eventId = e.id; return !ids.includes(eventId); }).concat(
          existing.pending.filter((e: EngineEventWithSeq) => { const eventId = e.id; return ids.includes(eventId); })
        );
        existing.pending = remainingPending;
        existing.acked = movedToAcked;
        existing.updatedAt = Date.now();
        const putReq = store.put({ key, value: existing });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error ?? new Error('IndexedDB put failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  async applyConfirmed(accountId: string, matchId: string, events: EngineEventWithSeq[], newWatermark: number): Promise<void> {
    const key = this.key(accountId, matchId);
    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        const existing = (req.result as { value: MatchCopy })?.value ?? null;
        if (!existing) {
          reject(new Error('Match copy not found'));
          return;
        }
        const confirmedIds = new Set(existing.confirmed.map((e: EngineEventWithSeq) => { const idStr = e.id; return idStr; }));
        for (const event of events) {
          if (!confirmedIds.has(event.id)) {
            existing.confirmed.push(event);
            confirmedIds.add(event.id);
          }
        }
        existing.confirmed.sort((a: EngineEventWithSeq, b: EngineEventWithSeq) => { const seqA = a.seq ?? 0; const seqB = b.seq ?? 0; return seqA - seqB; });
        const removedIds = events.map((e: EngineEventWithSeq) => { const eventId = e.id; return eventId; });
        existing.acked = existing.acked.filter((e) => !removedIds.includes(e.id));
        existing.pending = existing.pending.filter((e) => !removedIds.includes(e.id));
        existing.watermarkSeq = newWatermark;
        existing.updatedAt = Date.now();
        const putReq = store.put({ key, value: existing });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error ?? new Error('IndexedDB put failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  async removePending(accountId: string, matchId: string, ids: string[]): Promise<EngineEventWithSeq[]> {
    const key = this.key(accountId, matchId);
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        const existing = (req.result as { value: MatchCopy })?.value ?? null;
        if (!existing) {
          resolve([]);
          return;
        }
        const removed = existing.pending.filter((e: EngineEventWithSeq) => { const eventId = e.id; return ids.includes(eventId); });
        existing.pending = existing.pending.filter((e: EngineEventWithSeq) => { const eventId = e.id; return !ids.includes(eventId); });
        existing.updatedAt = Date.now();
        const putReq = store.put({ key, value: existing });
        putReq.onsuccess = () => resolve(removed);
        putReq.onerror = () => reject(putReq.error ?? new Error('IndexedDB put failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  async forAccount(accountId: string): Promise<MatchCopy[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readonly');
      const store = tx.objectStore(this.storeName);
      const req = store.getAll();
      req.onsuccess = () => {
        const results: MatchCopy[] = [];
        for (const item of (req.result as { key: string; value: MatchCopy }[]) ?? []) {
          if (item.value.accountId === accountId) {
            results.push(item.value);
          }
        }
        resolve(results);
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }

  async addConfirmedLocal(accountId: string, matchId: string, event: EngineEventWithSeq): Promise<void> {
    // Gastmodus (V14): Einträge gehen direkt nach confirmed, seq fortlaufend
    const key = this.key(accountId, matchId);
    const db = await this.openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(this.storeName, 'readwrite');
      const store = tx.objectStore(this.storeName);
      const req = store.get(key);
      req.onsuccess = () => {
        let existing = (req.result as { value: MatchCopy })?.value ?? null;
        if (!existing) {
          existing = {
            formatVersion: 1,
            accountId,
            matchId,
            ctx: event.payload?.rules ? { matchId, teamAId: 'guest-a', teamBId: 'guest-b' } : { matchId, teamAId: 'guest-a', teamBId: 'guest-b' },
            confirmed: [],
            watermarkSeq: 0,
            acked: [],
            pending: [],
            updatedAt: Date.now(),
          };
        }
        const maxSeq = Math.max(0, ...existing.confirmed.map((e) => (e as { seq?: number }).seq ?? 0));
        event.seq = event.seq ?? (maxSeq + 1);
        existing.confirmed.push(event);
        existing.watermarkSeq = (event as { seq?: number }).seq ?? existing.watermarkSeq;
        existing.updatedAt = Date.now();
        const putReq = store.put({ key, value: existing });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error ?? new Error('IndexedDB put failed'));
      };
      req.onerror = () => reject(req.error ?? new Error('IndexedDB request failed'));
    });
  }
}
