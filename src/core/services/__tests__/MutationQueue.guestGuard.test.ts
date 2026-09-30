/**
 * MutationQueue.guestGuard.test.ts — C3b-2c (G7): Wache am Queue-Flush-Weg.
 *
 * G7 (task-C3b-plan.md): Ein SAVE_TOURNAMENT für ein Turnier mit Engine-Einträgen
 * im Gastkonto darf beim Flush NICHT an Supabase gehen — egal woher die Mutation
 * stammt (z. B. der indirekte Upload über die Location-Migration in
 * `useTournaments.ts:33-38`). Die Mutation gilt als erledigt (kein Dead-Letter),
 * damit sie nicht endlos wiederholt wird. Turniere ohne Einträge laufen wie bisher.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { Tournament } from '../../models/types';
import { LocalMatchStore } from '../../match/client/LocalMatchStore';
import { ctx, ev } from '../../match/client/__tests__/fixtures';

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
  generateUniqueId: vi.fn(() => `guard-mock-id-${++idCounter}`),
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

function tournament(id: string, ...matchIds: string[]): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    matches: matchIds.map((matchId) => ({ id: matchId })),
  } as unknown as Tournament;
}

describe('MutationQueue SAVE_TOURNAMENT — G7-Wache (C3b-2c)', () => {
  let mockRepo: ReturnType<typeof createMockRepo>;
  let onlineSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockStorage.clear();
    idCounter = 0;
    mockRepo = createMockRepo();
    onlineSpy = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  });

  it('speichert ein Turnier mit Gast-Einträgen nicht hoch und lässt die Mutation als erledigt gelten', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mq-guard-m1', ctx);
    await store.addConfirmedLocal('guest', 'mq-guard-m1', ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));

    const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository);
    queue.enqueue('SAVE_TOURNAMENT', tournament('t-guard', 'mq-guard-m1'));

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('speichert ein Turnier ohne Einträge wie bisher hoch', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mq-free-m1', ctx);

    const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository);
    queue.enqueue('SAVE_TOURNAMENT', tournament('t-free', 'mq-free-m1'));

    onlineSpy.mockReturnValue(true);
    await queue.process();

    expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-free' }));
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('Lesefehler des lokalen Speichers verwirft SAVE_TOURNAMENT NICHT (PC29): kein Upload, Mutation bleibt', async () => {
    const readSpy = vi.spyOn(LocalMatchStore.prototype, 'forAccount').mockRejectedValue(new Error('DB weg'));
    try {
      const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository);
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-readerr', 'mq-readerr-m1'));

      onlineSpy.mockReturnValue(true);
      await queue.process();

      expect(mockRepo.save).not.toHaveBeenCalled();
      // Versuch zaehlt als fehlgeschlagen, Mutation bleibt erhalten (Retry/Backoff, kein Dead-Letter beim ersten Versuch).
      expect(queue.getPendingCount()).toBe(1);
      expect(queue.getFailedCount()).toBe(0);
      // Fehlversuch wird gezaehlt: retryCount steigt um 1.
      const stored = JSON.parse(mockStorage.get('mutation_queue_v1') ?? '[]') as { retryCount: number }[];
      expect(stored.map((item) => item.retryCount)).toEqual([1]);
    } finally {
      readSpy.mockRestore();
    }
  });

  it('Lesefehler zählt als Fehlversuch (auch als IndexedDB-AbortError): nach MAX_RETRIES sichtbar gescheitert, nie hochgeladen', async () => {
    const readSpy = vi
      .spyOn(LocalMatchStore.prototype, 'forAccount')
      .mockRejectedValue(new DOMException('aborted', 'AbortError'));
    try {
      const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository);
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-readerr2', 'mq-readerr2-m1'));
      onlineSpy.mockReturnValue(true);

      for (let i = 0; i < MAX_RETRIES; i++) {
        await queue.process();
      }

      expect(mockRepo.save).not.toHaveBeenCalled();
      expect(queue.getPendingCount()).toBe(0);
      expect(queue.getFailedCount()).toBe(1);
    } finally {
      readSpy.mockRestore();
    }
  });

  it('nach MAX_RETRIES Lesefehlern: Item in der Failed-Queue, FOLGENDE Items laufen weiter (kein Head-of-Line-Stau)', async () => {
    const store = new LocalMatchStore();
    await store.create('guest', 'mq-hol-free-m1', ctx);
    const readSpy = vi.spyOn(LocalMatchStore.prototype, 'forAccount');
    for (let i = 0; i < MAX_RETRIES; i++) {
      readSpy.mockRejectedValueOnce(new Error('DB weg'));
    }
    try {
      const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository);
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-hol-broken', 'mq-hol-broken-m1'));
      queue.enqueue('SAVE_TOURNAMENT', tournament('t-hol-free', 'mq-hol-free-m1'));
      onlineSpy.mockReturnValue(true);

      for (let i = 0; i < MAX_RETRIES; i++) {
        await queue.process();
      }

      const failed = JSON.parse(mockStorage.get('mutation_queue_failed_v1') ?? '[]') as { payload: { id: string } }[];
      expect(failed.map((item) => item.payload.id)).toEqual(['t-hol-broken']);
      expect(mockRepo.save).toHaveBeenCalledTimes(1);
      expect(mockRepo.save).toHaveBeenCalledWith(expect.objectContaining({ id: 't-hol-free' }));
      expect(queue.getPendingCount()).toBe(0);
    } finally {
      readSpy.mockRestore();
    }
  });
});