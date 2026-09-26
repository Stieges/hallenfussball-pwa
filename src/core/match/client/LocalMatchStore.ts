/**
 * Lokale Spielkopie (RC2, RC3, V3, V14) -- eigene IndexedDB `hallenfussball-matches`.
 * Jede Aenderung laeuft in einer Transaktion; aufgeloest wird erst nach `tx.oncomplete`
 * (I5), damit ein Abbruch beim Commit (typisch Quota) nicht als Erfolg gemeldet wird.
 */
import { type EngineEventWithSeq } from './catchUp';
import { type EngineEvent, type MatchContext } from '../types';
import {
  StoreDb,
  LocalStoreFullError,
  getAllStored,
  getStored,
  putRecord,
  type StoredRecord,
} from './LocalStoreDb';

export { LocalStoreFullError };
export type { StoredRecord };

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

type StoredCopy = StoredRecord<MatchCopy>;

export class LocalMatchStore {
  private readonly db = new StoreDb('hallenfussball-matches', 'matches', 1);

  private key(accountId: string, matchId: string): string {
    return `${accountId}|${matchId}`;
  }

  async load(accountId: string, matchId: string): Promise<MatchCopy | null> {
    const key = this.key(accountId, matchId);
    let copy: MatchCopy | null = null;
    await this.db.run(
      'readonly',
      (store) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          copy = req.result?.value ?? null;
        };
      },
      () => copy,
    );
    return copy;
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
    const record: StoredCopy = { key: this.key(accountId, matchId), value: copy };
    await this.db.run(
      'readwrite',
      (store, fail) => {
        putRecord(store, fail, record);
      },
      () => undefined,
    );
  }

  async addPending(accountId: string, matchId: string, event: EngineEventWithSeq): Promise<void> {
    const key = this.key(accountId, matchId);
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (!existing) {
            fail(new Error('Match copy not found'));
            return;
          }
          existing.pending.push(event);
          existing.updatedAt = Date.now();
          putRecord(store, fail, { key, value: existing });
        };
      },
      () => undefined,
    );
  }

  async markAcked(accountId: string, matchId: string, ids: string[]): Promise<void> {
    const key = this.key(accountId, matchId);
    const marked = new Set(ids);
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (!existing) {
            fail(new Error('Match copy not found'));
            return;
          }
          const moved = existing.pending.filter((event) => marked.has(event.id));
          existing.pending = existing.pending.filter((event) => !marked.has(event.id));
          existing.acked = existing.acked.filter((event) => !marked.has(event.id)).concat(moved);
          existing.updatedAt = Date.now();
          putRecord(store, fail, { key, value: existing });
        };
      },
      () => undefined,
    );
  }

  async applyConfirmed(
    accountId: string,
    matchId: string,
    events: EngineEventWithSeq[],
    newWatermark: number,
  ): Promise<void> {
    const key = this.key(accountId, matchId);
    const removedIds = new Set(events.map((event) => event.id));
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (!existing) {
            fail(new Error('Match copy not found'));
            return;
          }
          const confirmedIds = new Set(existing.confirmed.map((event) => event.id));
          for (const event of events) {
            if (!confirmedIds.has(event.id)) {
              existing.confirmed.push(event);
              confirmedIds.add(event.id);
            }
          }
          existing.confirmed.sort((a, b) => a.seq - b.seq);
          existing.acked = existing.acked.filter((event) => !removedIds.has(event.id));
          existing.pending = existing.pending.filter((event) => !removedIds.has(event.id));
          // M-7: ein spaet eingetroffenes, aelteres Nachladen darf den Wasserstand nicht senken.
          existing.watermarkSeq = Math.max(existing.watermarkSeq, newWatermark);
          existing.updatedAt = Date.now();
          putRecord(store, fail, { key, value: existing });
        };
      },
      () => undefined,
    );
  }

  async removePending(accountId: string, matchId: string, ids: string[]): Promise<EngineEventWithSeq[]> {
    const key = this.key(accountId, matchId);
    const removedIds = new Set(ids);
    let removed: EngineEventWithSeq[] = [];
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (!existing) {
            fail(new Error('Match copy not found'));
            return;
          }
          removed = existing.pending.filter((event) => removedIds.has(event.id));
          existing.pending = existing.pending.filter((event) => !removedIds.has(event.id));
          existing.updatedAt = Date.now();
          putRecord(store, fail, { key, value: existing });
        };
      },
      () => removed,
    );
    return removed;
  }

  async forAccount(accountId: string): Promise<MatchCopy[]> {
    let results: MatchCopy[] = [];
    await this.db.run(
      'readonly',
      (store) => {
        const req = getAllStored<MatchCopy>(store);
        req.onsuccess = () => {
          results = req.result
            .filter((item) => item.value.accountId === accountId)
            .map((item) => item.value);
        };
      },
      () => results,
    );
    return results;
  }

  /** Gastmodus (V14): Eintrag geht direkt nach `confirmed`, die `seq` wird intern vergeben. */
  async addConfirmedLocal(accountId: string, matchId: string, event: EngineEvent): Promise<void> {
    if (accountId !== 'guest') {
      throw new Error('addConfirmedLocal ist nur fuer den Gastmodus (guest) erlaubt');
    }
    const key = this.key(accountId, matchId);
    await this.db.run(
      'readwrite',
      (store, fail) => {
        const req = getStored<MatchCopy>(store, key);
        req.onsuccess = () => {
          const existing = req.result?.value ?? null;
          if (!existing) {
            fail(new Error('Match copy not found'));
            return;
          }
          const maxSeq = existing.confirmed.reduce((max, entry) => Math.max(max, entry.seq), 0);
          const stored: EngineEventWithSeq = { ...event, seq: maxSeq + 1 };
          existing.confirmed.push(stored);
          existing.watermarkSeq = Math.max(existing.watermarkSeq, stored.seq);
          existing.updatedAt = Date.now();
          putRecord(store, fail, { key, value: existing });
        };
      },
      () => undefined,
    );
  }
}
