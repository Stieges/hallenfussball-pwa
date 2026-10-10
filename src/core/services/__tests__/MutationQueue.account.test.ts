/**
 * MutationQueue.account.test.ts — A-07b (Weg B): Ausgang gehoert einem Konto.
 *
 * @FU-006: Wartende Aenderungen gehoeren dem Konto, das sie erzeugt hat. Ein anderes
 * Konto sendet sie nie; die Queue haelt an, sobald die Sitzung nicht mehr dem Konto
 * der Queue gehoert (Konto-Wache direkt vor jedem `execute`).
 * @FU-019: Ein Update mit wartenden Eintraegen im alten Schluessel (ohne Konto) darf
 * sie nicht verlieren: die erste angemeldete Queue uebernimmt sie einmalig.
 * @AN-024: Erst nach einer Anmeldung desselben Kontos werden wartende Eintraege gesendet.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const net = vi.hoisted(() => ({ online: true }));

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

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: session.userId ? { user: { id: session.userId } } : null },
        error: null,
      })),
    },
  },
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

function tournament(id: string): Tournament {
  return { id, title: `Turnier ${id}`, matches: [] } as unknown as Tournament;
}

/** Laesst alle ausstehenden Microtasks der Queue ablaufen (kein Timer, Fake-Timer-sicher). */
async function flush(): Promise<void> {
  // setImmediate ist nicht gefaked; fake-indexeddb braucht echte Makrotasks.
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function storedItems(key: string): Array<{ id: string; type: string; retryCount: number; payload: { id?: string } }> {
  const raw = mockStorage.get(key);
  return raw ? (JSON.parse(raw) as Array<{ id: string; type: string; retryCount: number; payload: { id?: string } }>) : [];
}

describe('MutationQueue Konto-Ausgang (A-07b, @FU-006 / @FU-019)', () => {
  const created: MutationQueue[] = [];
  const track = (q: MutationQueue): MutationQueue => { created.push(q); return q; };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mockStorage.clear();
    created.length = 0;
    session.userId = 'A';
    net.online = true;
    vi.stubGlobal("navigator", { get onLine() { return net.online; } });
  });

  afterEach(() => {
    created.forEach((q) => q.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  describe('Gegenbeispiele (Uebernahme)', () => {
    it('Altschluessel-Uebernahme passiert genau einmal: ein zweites Konto uebernimmt nichts', async () => {
      const legacy = track(new MutationQueue(createMockRepo() as never, undefined, undefined));
      net.online = false;
      legacy.enqueue('SAVE_TOURNAMENT', tournament('t1'));
      legacy.enqueue('SAVE_TOURNAMENT', tournament('t2'));
      legacy.dispose();
      net.online = true;

      session.userId = 'A';
      track(new MutationQueue(createMockRepo() as never, undefined, undefined, 'A'));
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(2);
      expect(mockStorage.has('mutation_queue_v1')).toBe(false);

      const repoB = createMockRepo();
      session.userId = 'B';
      const queueB = track(new MutationQueue(repoB as never, undefined, undefined, 'B'));
      await flush();
      expect(queueB.getPendingCount()).toBe(0);
      expect(repoB.save).not.toHaveBeenCalled();
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(2);
    });
  });

  describe('@FU-019 Altschluessel-Uebernahme', () => {
    it('Altschluessel mit 3 Items + Queue fuer A: 3 Items in mutation_queue_v1:A, Altschluessel weg', () => {
      net.online = false;
      const legacy = new MutationQueue(createMockRepo() as never, undefined, undefined);
      legacy.enqueue('SAVE_TOURNAMENT', tournament('t1'));
      legacy.enqueue('SAVE_TOURNAMENT', tournament('t2'));
      legacy.enqueue('SAVE_TOURNAMENT', tournament('t3'));
      legacy.dispose();
      expect(storedItems('mutation_queue_v1')).toHaveLength(3);

      const queue = track(new MutationQueue(createMockRepo() as never, undefined, undefined, 'A'));

      expect(queue.getPendingCount()).toBe(3);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(3);
      expect(mockStorage.has('mutation_queue_v1')).toBe(false);
    });
  });

  describe('Pflichttest echter Weg (OfflineRepository + echte MutationQueue)', () => {
    it('Konto A offline sammelt, Neubau fuer B sendet nichts, Neubau fuer A sendet 3x', async () => {
      const { OfflineRepository } = await import('../../repositories/OfflineRepository');
      const localA = { save: vi.fn(async () => undefined) };
      const supabaseA = createMockRepo();

      net.online = false;
      const repoA = new OfflineRepository(localA as never, supabaseA as never, 'A');
      track(repoA.mutationQueue);
      await repoA.save(tournament('t1'));
      await repoA.save(tournament('t2'));
      await repoA.save(tournament('t3'));
      expect(repoA.mutationQueue.getPendingCount()).toBe(3);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(3);

      // Neubau fuer B (wie RepositoryContext bei Kontowechsel)
      net.online = true;
      session.userId = 'B';
      const supabaseB = createMockRepo();
      const repoB = new OfflineRepository({ save: vi.fn(async () => undefined) } as never, supabaseB as never, 'B');
      track(repoB.mutationQueue);
      await flush();
      expect(supabaseB.save).not.toHaveBeenCalled();
      expect(repoB.mutationQueue.getPendingCount()).toBe(0);

      // Neubau fuer A, online: 3x senden, Queue A leer
      session.userId = 'A';
      const supabaseA2 = createMockRepo();
      const repoA2 = new OfflineRepository({ save: vi.fn(async () => undefined) } as never, supabaseA2 as never, 'A');
      track(repoA2.mutationQueue);
      // Im Node-Testlauf ohne window stoesst der Konstruktor nichts an; der Anstoss kommt wie im Betrieb von process().
      await repoA2.mutationQueue.process();
      await flush();
      expect(supabaseA2.save).toHaveBeenCalledTimes(3);
      expect(repoA2.mutationQueue.getPendingCount()).toBe(0);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(0);
    });
  });
});
