/**
 * MutationQueue.guestGuard.updateTypes.node.test.ts — C3b-2 Fixrunde F1, M1.
 *
 * task-C3b2-review.md M1: UPDATE_MATCH/UPDATE_MATCHES/UPDATE_TOURNAMENT_METADATA/
 * DELETE_TOURNAMENT hatten die G7-Wache (SAVE_TOURNAMENT) nicht — ein per Direktlink
 * bearbeitetes Gast-Turnier ging (sinnlos, da die Turnier-Zeile in der Cloud fehlt)
 * dennoch an die Cloud. Gleiche Wache: das LOKALE Turnier laden (`localRepo.get`),
 * hat es Gast-Einträge → Mutation gilt als erledigt (kein Upload); liefert das
 * lokale Laden `null` (Turnier nicht auf diesem Gerät) → KEINE Wache, Mutation läuft
 * normal (Präzisierung v2, task-C3b2-fix-plan.md).
 *
 * Node-Realm wie die I1-Tests (kein DOM-Bedarf; `navigator.onLine` wird gestubbt,
 * NICHT der Produktivcode — Brief Regel 3).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseRepository } from '../../repositories/SupabaseRepository';
import type { LocalStorageRepository } from '../../repositories/LocalStorageRepository';
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
  generateUniqueId: vi.fn(() => `guest-guard-update-mock-id-${++idCounter}`),
}));

import { MutationQueue } from '../MutationQueue';

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

function localRepoReturning(t: Tournament | null): LocalStorageRepository {
  return { get: vi.fn(async () => t) } as unknown as LocalStorageRepository;
}

function stubNavigatorOnLine(value: boolean): void {
  if (typeof globalThis.navigator === 'undefined') {
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  }
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

describe('MutationQueue — M1 gleiche Gast-Wache für UPDATE_*/DELETE (C3b-2 F1)', () => {
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

  async function seedGuestEntries(matchId: string): Promise<void> {
    const store = new LocalMatchStore();
    await store.create('guest', matchId, ctx);
    await store.addConfirmedLocal('guest', matchId, ev({ id: 'e1', type: 'GOAL', at: 1000, teamId: 'teamA' }));
  }

  it('UPDATE_MATCH: Gast-Turnier (lokal, Gast-Einträge) → kein Upload, Mutation erledigt', async () => {
    await seedGuestEntries('m1-um-guest');
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-um-guest', 'm1-um-guest')),
    );
    queue.enqueue('UPDATE_MATCH', { tournamentId: 't-um-guest', update: { matchId: 'm1-um-guest', scoreA: 1 } });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateMatch).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
  });

  it('UPDATE_MATCH: lokales Turnier ohne Gast-Einträge → Upload wie bisher', async () => {
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-um-free', 'm1-um-free')),
    );
    queue.enqueue('UPDATE_MATCH', { tournamentId: 't-um-free', update: { matchId: 'm1-um-free', scoreA: 1 } });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateMatch).toHaveBeenCalledWith('t-um-free', { matchId: 'm1-um-free', scoreA: 1 });
    expect(queue.getPendingCount()).toBe(0);
  });

  it('UPDATE_MATCH: Turnier lokal NICHT vorhanden (null) → KEINE Wache, Mutation läuft normal', async () => {
    const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository, localRepoReturning(null));
    queue.enqueue('UPDATE_MATCH', { tournamentId: 't-um-unknown', update: { matchId: 'm1-um-unknown', scoreA: 1 } });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateMatch).toHaveBeenCalledWith('t-um-unknown', { matchId: 'm1-um-unknown', scoreA: 1 });
    expect(queue.getPendingCount()).toBe(0);
  });

  it('UPDATE_MATCHES: Gast-Turnier → kein Upload', async () => {
    await seedGuestEntries('m1-ums-guest');
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-ums-guest', 'm1-ums-guest')),
    );
    queue.enqueue('UPDATE_MATCHES', {
      tournamentId: 't-ums-guest',
      updates: [{ matchId: 'm1-ums-guest', scoreA: 2 }],
    });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateMatches).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(0);
  });

  it('UPDATE_MATCHES: lokales Turnier ohne Gast-Einträge → Upload wie bisher', async () => {
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-ums-free', 'm1-ums-free')),
    );
    const updates = [{ matchId: 'm1-ums-free', scoreA: 2 }];
    queue.enqueue('UPDATE_MATCHES', { tournamentId: 't-ums-free', updates });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateMatches).toHaveBeenCalledWith('t-ums-free', updates);
    expect(queue.getPendingCount()).toBe(0);
  });

  it('UPDATE_TOURNAMENT_METADATA: Gast-Turnier → kein Upload', async () => {
    await seedGuestEntries('m1-meta-guest');
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-meta-guest', 'm1-meta-guest')),
    );
    queue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: 't-meta-guest', metadata: { title: 'Neu' } });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateTournamentMetadata).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(0);
  });

  it('UPDATE_TOURNAMENT_METADATA: lokales Turnier ohne Gast-Einträge → Upload wie bisher', async () => {
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-meta-free', 'm1-meta-free')),
    );
    queue.enqueue('UPDATE_TOURNAMENT_METADATA', { tournamentId: 't-meta-free', metadata: { title: 'Neu' } });
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.updateTournamentMetadata).toHaveBeenCalledWith('t-meta-free', { title: 'Neu' });
    expect(queue.getPendingCount()).toBe(0);
  });

  it('DELETE_TOURNAMENT: Gast-Turnier → keine Löschung in der Cloud', async () => {
    await seedGuestEntries('m1-del-guest');
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-del-guest', 'm1-del-guest')),
    );
    queue.enqueue('DELETE_TOURNAMENT', 't-del-guest');
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.delete).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(0);
  });

  it('DELETE_TOURNAMENT: lokales Turnier ohne Gast-Einträge → Löschung wie bisher', async () => {
    const queue = new MutationQueue(
      mockRepo as unknown as SupabaseRepository,
      localRepoReturning(tournament('t-del-free', 'm1-del-free')),
    );
    queue.enqueue('DELETE_TOURNAMENT', 't-del-free');
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.delete).toHaveBeenCalledWith('t-del-free');
    expect(queue.getPendingCount()).toBe(0);
  });

  it('DELETE_TOURNAMENT: Turnier lokal NICHT vorhanden (null) → KEINE Wache, Löschung läuft normal', async () => {
    const queue = new MutationQueue(mockRepo as unknown as SupabaseRepository, localRepoReturning(null));
    queue.enqueue('DELETE_TOURNAMENT', 't-del-unknown');
    stubNavigatorOnLine(true);
    await queue.process();

    expect(mockRepo.delete).toHaveBeenCalledWith('t-del-unknown');
    expect(queue.getPendingCount()).toBe(0);
  });
});
