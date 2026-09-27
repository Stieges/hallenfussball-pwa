/**
 * Testgeruest fuer `OutboxSender`: `api` gemockt, injizierte Fake-Timer
 * (aufzeichnend, ueber `vi.useFakeTimers` gesteuert), feste Uhr und
 * `requestCatchUp`-Zaehler.
 */
import { vi, type Mock } from 'vitest';
import { RepositoryError } from '../../../errors';
import type { AppendableEvent, AppendEventResult, AppendResult } from '../../../repositories/appendMatchEventsRpc';
import { LocalMatchStore } from '../LocalMatchStore';
import { OutboxSender } from '../OutboxSender';
import type { OutboxApi, OutboxSenderDeps, OutboxTimers } from '../outboxTypes';

export const CLOCK_START = 1_700_000_000_000;

export type AppendMock = Mock<OutboxApi['appendMatchEvents']>;

export interface Harness {
  store: LocalMatchStore;
  sender: OutboxSender;
  api: AppendMock;
  /** Zugriff ueber `sentIds`/`sentMatches`; zusaetzlich hier als Komfort. */
  catchUps: string[];
  /** m7: Aufrufe von `notifyStoreChange` (eigene Store-Schreibzugriffe). */
  storeChanges: string[];
  /** Reihenfolge der an die Fake-Timer uebergebenen Verzoegerungen in ms. */
  delays: number[];
  persist: Mock<() => Promise<boolean>>;
  /** Laesst anstehende Fake-Timer ueber `ms` feuern und deren Arbeit zu Ende laufen. */
  tick(ms: number): Promise<void>;
  /** Laesst bereits gestartete asynchrone Arbeit (auch ohne Timer) zu Ende laufen. */
  settle(): Promise<void>;
}

export function makeHarness(setup: Partial<OutboxSenderDeps> = {}): Harness {
  const store = new LocalMatchStore();
  const catchUps: string[] = [];
  const storeChanges: string[] = [];
  const delays: number[] = [];
  const pendingWork: Promise<unknown>[] = [];
  const persist = vi.fn(async () => true);
  vi.stubGlobal('navigator', { storage: { persist } });

  const timers: OutboxTimers = {
    setTimeout: (callback, ms) => {
      delays.push(ms);
      return setTimeout(() => {
        const result: unknown = callback();
        if (result instanceof Promise) {
          pendingWork.push(result);
        }
      }, ms);
    },
    clearTimeout: (handle) => clearTimeout(handle),
  };

  const api: AppendMock = vi.fn<OutboxApi['appendMatchEvents']>(async (_matchId, events) => acceptAll(events));
  const sender = new OutboxSender({
    store,
    api: { appendMatchEvents: api },
    clientFormat: 3,
    deviceId: 'device-1',
    timers,
    now: () => CLOCK_START,
    requestCatchUp: (matchId) => {
      catchUps.push(matchId);
    },
    notifyStoreChange: (matchId) => {
      storeChanges.push(matchId);
    },
    ...setup,
  });

  const settle = async (): Promise<void> => {
    while (pendingWork.length > 0) {
      await Promise.all(pendingWork.splice(0, pendingWork.length));
    }
  };

  return {
    store,
    sender,
    api,
    catchUps,
    storeChanges,
    delays,
    persist,
    settle,
    tick: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      await settle();
    },
  };
}

/** PostgrestError in der Form, wie sie `callAppendMatchEvents` verpackt. */
export function rpcError(code: string, message: string): RepositoryError {
  return new RepositoryError('appendMatchEvents', message, { code, message, details: '', hint: '' });
}

export function networkError(): RepositoryError {
  const message = 'TypeError: Failed to fetch';
  return new RepositoryError('appendMatchEvents', message, { code: '', message, details: '', hint: '' });
}

export function clientOutdatedResult(): AppendResult {
  return { error: 'CLIENT_OUTDATED', minClientFormat: 5, serverTime: 1 };
}

export function resultOf(
  id: string,
  status: AppendEventResult['status'],
  code?: string,
  detail?: unknown,
): AppendEventResult {
  return {
    id,
    status,
    ...(code !== undefined ? { code } : {}),
    ...(detail !== undefined ? { detail } : {}),
  };
}

export function success(results: AppendEventResult[]): AppendResult {
  return { results, state: null, serverTime: 1 };
}

/** Server-Antwort: jedes Ereignis angenommen. */
export function acceptAll(events: readonly AppendableEvent[]): AppendResult {
  return success(events.map((event) => resultOf(event.id, 'accepted')));
}

/** IDs der bisher gesendeten Stapel (Reihenfolge der Aufrufe). */
export function sentIds(api: AppendMock): string[][] {
  return api.mock.calls.map(([, events]) => events.map((event) => event.id));
}

export function sentMatches(api: AppendMock): string[] {
  return api.mock.calls.map(([matchId]) => matchId);
}

/** IDs einer Liste der Kopie (`pending`/`acked`/`review`). */
export async function idsIn(
  h: Harness,
  accountId: string,
  matchId: string,
  list: 'pending' | 'acked' | 'review',
): Promise<string[]> {
  const copy = await h.store.load(accountId, matchId);
  return (copy?.[list] ?? []).map((event) => event.id);
}

/** `[Ereignis-ID, Code]` der Ablehnungsliste der Kopie. */
export async function rejectedIn(h: Harness, accountId: string, matchId: string): Promise<Array<[string, string]>> {
  const copy = await h.store.load(accountId, matchId);
  return (copy?.rejected ?? []).map((entry) => [entry.event.id, entry.code]);
}
