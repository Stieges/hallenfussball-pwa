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
  describe('Race-Pflichttest (@FU-006)', () => {
    it('sendet nach einem Kontowechsel waehrend eines laufenden Durchgangs kein weiteres Item von A', async () => {
      const repo = createMockRepo();
      let releaseFirst: (() => void) | null = null;
      repo.save.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseFirst = resolve; }));

      const queue = track(new MutationQueue(repo as never, undefined, undefined, 'A'));
      queue.enqueue('SAVE_TOURNAMENT', tournament('t1'));
      queue.enqueue('SAVE_TOURNAMENT', tournament('t2'));
      await flush();

      // Durchgang A: erstes execute haengt.
      expect(repo.save).toHaveBeenCalledTimes(1);

      // Sitzung wechselt auf B, dann kommt die Antwort auf das erste Item.
      session.userId = 'B';
      releaseFirst?.();
      await flush();

      expect(repo.save).toHaveBeenCalledTimes(1);
      const items = storedItems('mutation_queue_v1:A');
      expect(items).toHaveLength(1);
      expect(items[0].payload.id).toBe('t2');
      expect(items[0].retryCount).toBe(0);
      expect(queue.getPendingCount()).toBe(1);
    });

    it('haelt auch an, wenn die Sitzung nach dem Abmelden leer ist', async () => {
      const repo = createMockRepo();
      session.userId = null;
      const queue = track(new MutationQueue(repo as never, undefined, undefined, 'A'));
      queue.enqueue('SAVE_TOURNAMENT', tournament('t1'));
      await flush();

      expect(repo.save).not.toHaveBeenCalled();
      expect(queue.getPendingCount()).toBe(1);
      expect(storedItems('mutation_queue_v1:A')[0].retryCount).toBe(0);
    });
  });

  describe('Gegenbeispiele (Konto-Wache)', () => {
    it('gleiches Konto mit neuem Token (TOKEN_REFRESHED) wird nicht angehalten', async () => {
      const repo = createMockRepo();
      const queue = track(new MutationQueue(repo as never, undefined, undefined, 'A'));
      session.userId = 'A'; // neues Token, gleiche Konto-ID
      queue.enqueue('SAVE_TOURNAMENT', tournament('t1'));
      queue.enqueue('SAVE_TOURNAMENT', tournament('t2'));
      await flush();

      expect(repo.save).toHaveBeenCalledTimes(2);
      expect(queue.getPendingCount()).toBe(0);
    });
  });
});
