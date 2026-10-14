/**
 * MutationQueue.storageFull.node.test.ts — A-07i (Befund C-QUEUE-SPEICHER-VOLL, @FU-004, @FU-007).
 *
 * Pflichttest mit dem ECHTEN safeLocalStorage: nur das Storage-Objekt im (gestubbten) window
 * ist ein Fake, dessen setItem bei Quota wirft. Bei vollem Speicher muss die Queue die
 * Störung melden (lastFailure 'storage' + Sentry), der Eintrag bleibt im RAM, der Altschlüssel
 * bleibt stehen, und nach einem Neustart (neue Instanz) wird nichts doppelt gesendet.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tournament } from '../../models/types';

const sentry = vi.hoisted(() => ({ captureFeatureError: vi.fn() }));

vi.mock('../../../lib/sentry', () => ({ captureFeatureError: sentry.captureFeatureError }));

vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: { user: { id: 'A' } } },
        error: null,
      })),
    },
  },
}));

vi.mock('../../match/client/guestEngineEntries', () => ({
  hasGuestEngineEntries: vi.fn(async () => false),
}));

/** Fake-Speicher: setItem wirft bei Quota (wie der Browser), getItem liest den echten Stand. */
class QuotaStorage {
  private readonly data = new Map<string, string>();
  quotaExceeded = false;

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    if (this.quotaExceeded) {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    }
    this.data.set(key, String(value));
  }

  /** Roh-Lesen für Assertions (ohne Quota-Logik). */
  raw(key: string): string | null {
    return this.data.get(key) ?? null;
  }
}

function setOnline(value: boolean): void {
  Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  Object.defineProperty(globalThis.navigator, 'onLine', { value, configurable: true });
}

/** Frisch laden, damit safeStorage das Fake-window sieht (Konstruktion im Modul). */
async function loadModules(storage: QuotaStorage) {
  vi.resetModules();
  vi.stubGlobal('window', Object.assign(new EventTarget(), { localStorage: storage, sessionStorage: storage }));
  const { MutationQueue } = await import('../MutationQueue');
  return { MutationQueue };
}

function createMockRepo() {
  return {
    save: vi.fn(async (): Promise<void> => undefined),
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

/** Laesst ausstehende Microtasks und Makrotasks der Queue ablaufen. */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
}

function legacyItem(id: string) {
  return {
    id,
    type: 'SAVE_TOURNAMENT',
    payload: tournament(`payload-${id}`),
    timestamp: 1,
    retryCount: 0,
  };
}

describe('MutationQueue bei vollem Geraetespeicher (A-07i, @FU-004 / @FU-007)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    sentry.captureFeatureError.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('Pflicht: Speicher voll -> Eintrag bleibt im RAM, Stoerung gemeldet, Sentry 1x', async () => {
    setOnline(false);
    const storage = new QuotaStorage();
    const { MutationQueue } = await loadModules(storage);
    storage.quotaExceeded = true;

    const queue = new MutationQueue(createMockRepo() as never, undefined, undefined, undefined);
    queue.enqueue('SAVE_TOURNAMENT', tournament('t1'));

    expect(queue.getPendingCount()).toBe(1);
    expect(queue.getLastFailure()).toBe('storage');
    expect(sentry.captureFeatureError).toHaveBeenCalledTimes(1);
    expect(sentry.captureFeatureError).toHaveBeenCalledWith(expect.any(Error), 'sync', 'saveQueue');
    queue.dispose();
  });

  it('A-07i Fixrunde 1: 5 Eintraege bei vollem Speicher -> Stoerung bleibt, Sentry genau 1x je Ursache', async () => {
    setOnline(false);
    const storage = new QuotaStorage();
    const { MutationQueue } = await loadModules(storage);
    storage.quotaExceeded = true;

    const queue = new MutationQueue(createMockRepo() as never, undefined, undefined, undefined);
    for (let i = 1; i <= 5; i++) {
      queue.enqueue('SAVE_TOURNAMENT', tournament(`t${i}`));
    }

    expect(queue.getPendingCount()).toBe(5);
    expect(queue.getLastFailure()).toBe('storage');
    expect(sentry.captureFeatureError).toHaveBeenCalledTimes(1);
    queue.dispose();
  });

  it('Pflicht: Altschluessel bleibt, nach Neustart ohne Doppelversand (Speicher voll, dann frei)', async () => {
    setOnline(true);
    const storage = new QuotaStorage();
    storage.setItem('mutation_queue_v1', JSON.stringify([legacyItem('L1')]));
    const { MutationQueue } = await loadModules(storage);
    const legacyRaw = storage.raw('mutation_queue_v1');

    // Sitzung 1: Speicher voll. Uebernahme schlaegt fehl -> Altschluessel bleibt, Stoerung gemeldet.
    storage.quotaExceeded = true;
    const repo1 = createMockRepo();
    const first = new MutationQueue(repo1 as never, undefined, undefined, 'A');
    await flush();

    expect(storage.raw('mutation_queue_v1')).toBe(legacyRaw);
    expect(first.getLastFailure()).toBe('storage');
    expect(sentry.captureFeatureError).toHaveBeenCalledWith(expect.any(Error), 'sync', 'adoptLegacyKey');
    expect(repo1.save).not.toHaveBeenCalled();
    first.dispose();

    // Neustart (neue Instanz), Speicher immer noch voll: wieder kein Versand, Altschluessel bleibt.
    const repo2 = createMockRepo();
    const second = new MutationQueue(repo2 as never, undefined, undefined, 'A');
    await flush();
    expect(storage.raw('mutation_queue_v1')).toBe(legacyRaw);
    expect(repo2.save).not.toHaveBeenCalled();
    second.dispose();

    // Neustart, Speicher wieder frei: Uebernahme genau einmal, Versand genau einmal.
    storage.quotaExceeded = false;
    const repo3 = createMockRepo();
    const third = new MutationQueue(repo3 as never, undefined, undefined, 'A');
    await flush();
    expect(storage.raw('mutation_queue_v1')).toBeNull();
    expect(third.getLastFailure()).toBeNull();
    expect(repo3.save).toHaveBeenCalledTimes(1);
    third.dispose();
  });

  it('Gegenbeispiel: normaler Speicher -> keine Stoerung, kein Sentry, Versand wie bisher', async () => {
    setOnline(true);
    const storage = new QuotaStorage();
    const { MutationQueue } = await loadModules(storage);

    const repo = createMockRepo();
    const queue = new MutationQueue(repo as never, undefined, undefined, undefined);
    queue.enqueue('SAVE_TOURNAMENT', tournament('t1'));
    await flush();

    expect(queue.getLastFailure()).toBeNull();
    expect(queue.getPendingCount()).toBe(0);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(sentry.captureFeatureError).not.toHaveBeenCalled();
    queue.dispose();
  });
});
