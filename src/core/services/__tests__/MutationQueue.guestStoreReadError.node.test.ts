/**
 * MutationQueue.guestStoreReadError.node.test.ts — C3b-2 Fixrunde F1, I1.
 *
 * task-C3b2-review.md I1: der Queue-Wrapper übernahm bisher `error.message` der
 * Ursache. Im BROWSER ist ein IndexedDB-`DOMException` `instanceof Error`, und die
 * gewrappte Nachricht ("...: The operation was aborted"/"...: Transaction timeout")
 * traf `isAbortError`/die Netz-Muster — der Fehler galt dann als transient (kein
 * `retryCount`, kein Dead-Letter, Head-of-Line-Stau). `vitest/jsdom` versteckte das,
 * weil dort `DOMException instanceof Error === false` ist (Realm-Probe im Review).
 *
 * Dieser Test läuft DESHALB bewusst NICHT in `vitest.config.ts`s `DOM_ONLY_TS_TESTS`
 * (Datei-Endung `.ts`, nicht `.tsx`) — also im `unit-node`-Projekt (environment:
 * 'node'), derselben Realm-Klasse wie ein echter Browser (`DOMException`/`Error`
 * dieselbe globale Klassen-Hierarchie, node: `instanceof = true`, s. Review-Probe).
 * `navigator` gibt es dort nicht automatisch — wird hier gestubbt, NICHT im
 * Produktivcode geändert (Brief Regel 3).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
import type { Tournament } from '../../models/types';
import { LocalMatchStore } from '../../match/client/LocalMatchStore';
import { ctx } from '../../match/client/__tests__/fixtures';

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      mockStorage.set(key, value);
    }),
    removeItem: vi.fn((key: string) => {
      mockStorage.delete(key);
    }),
  },
}));

vi.mock('../../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

let idCounter = 0;
vi.mock('../../utils/idGenerator', () => ({
  generateUniqueId: vi.fn(() => `guest-store-read-error-mock-id-${++idCounter}`),
}));

import { MutationQueue, MAX_RETRIES } from '../MutationQueue';

function createMockRepo() {
  return {
    save: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
    updateMatch: vi.fn(async () => undefined),
    updateMatches: vi.fn(async () => undefined),
    updateTournamentMetadata: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
  };
}

function createMockLocalRepo(): LocalStorageRepository {
  // Diese I1-Tests betreffen SAVE_TOURNAMENT — das Prädikat greift direkt auf den
  // (gespyten) LocalMatchStore zu, M1s localRepo.get() wird hier nicht gebraucht.
  return { get: vi.fn(async () => null) } as unknown as LocalStorageRepository;
}

/** Node hat kein `navigator` mit `onLine` — die Queue prüft es unconditional in
 * enqueue()/process(). Stub ist Testumgebung, nicht Produktivcode (Brief Regel 3). */
function stubNavigatorOnLine(value: boolean): void {
  if (typeof globalThis.navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  }
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('MutationQueue SAVE_TOURNAMENT — I1 GuestStoreReadError (Node-Realm, C3b-2 F1)', () => {
  let mockRepo: ReturnType<typeof createMockRepo>;

  beforeEach(() => {
    mockStorage.clear();
    idCounter = 0;
    mockRepo = createMockRepo();
    stubNavigatorOnLine(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lehnt einen IndexedDB-AbortError ab: retryCount 1, kein Dead-Letter beim ersten Versuch', async () => {
    const readSpy = vi
      .spyOn(LocalMatchStore.prototype, 'forAccount')
      .mockRejectedValue(Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }));
    try {
      const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository, createMockLocalRepo());
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-abort', 'mq-node-abort-m1'));

      stubNavigatorOnLine(true);
      await queue.process();

      expect(mockRepo.save).not.toHaveBeenCalled();
      // Faellt der Klassen-Zweig weg (Mutationsprobe), gaelte der Fehler als transient:
      // kein retryCount, Item bliebe bei 0 stehen — dieser Test wird dann ROT.
      expect(queue.getPendingCount()).toBe(1);
      expect(queue.getFailedCount()).toBe(0);
      const stored = JSON.parse(mockStorage.get('mutation_queue_v1') ?? '[]') as { retryCount: number }[];
      expect(stored.map((item) => item.retryCount)).toEqual([1]);
    } finally {
      readSpy.mockRestore();
    }
  });

  it('lehnt "Transaction timeout" ab: nach MAX_RETRIES Failed-Queue, Folge-Item läuft (kein Head-of-Line-Stau)', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mq-node-timeout-free-m1', ctx);
    const readSpy = vi.spyOn(LocalMatchStore.prototype, 'forAccount');
    for (let i = 0; i < MAX_RETRIES; i++) {
      readSpy.mockRejectedValueOnce(new Error('Transaction timeout'));
    }
    try {
      const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository, createMockLocalRepo());
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-timeout-broken', 'mq-node-timeout-broken-m1'));
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-timeout-free', 'mq-node-timeout-free-m1'));
      stubNavigatorOnLine(true);

      await queue.process();
      const stored = JSON.parse(mockStorage.get('mutation_queue_v1') ?? '[]') as { retryCount: number }[];
      expect(stored[0].retryCount).toBe(1);

      for (let i = 1; i < MAX_RETRIES; i++) {
        await queue.process();
      }

      const failed = JSON.parse(mockStorage.get('mutation_queue_failed_v1') ?? '[]') as { payload: { id: string } }[];
      expect(failed.map((item) => item.payload.id)).toEqual(['t-timeout-broken']);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-timeout-free' }));
      expect(queue.getPendingCount()).toBe(0);
    } finally {
      readSpy.mockRestore();
    }
  });
});
