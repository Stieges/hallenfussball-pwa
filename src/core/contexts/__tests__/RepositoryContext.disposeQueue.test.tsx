/**
 * RepositoryContext.disposeQueue.test.tsx — A-06f Teil 1 (Brief A7) + A-07b Punkt 3.
 *
 * - Bei Objektwechsel des Nutzers wird die Queue des alten Repos genau einmal `dispose()` (A7).
 * - Gleiches Nutzer-Objekt und StrictMode-Mount: kein `dispose`.
 * - Ende-zu-Ende (@FU-006, @AN-024): Konto A offline 3 Eintraege -> Abmelden -> Anmelden B
 *   (nichts von A gesendet, Queue B leer) -> Anmelden A (3 Eintraege gehen raus).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- RepositoryContext ist eine bewusste React-Bridge; dieser Test verifiziert sie ueber React Testing Library.
import { renderHook } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- s.o.
import React from 'react';
import type { Tournament } from '../../models/types';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const net = vi.hoisted(() => ({ online: true }));
const remote = vi.hoisted(() => ({
  save: vi.fn(async (..._args: unknown[]): Promise<void> => undefined),
}));

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
    channel: vi.fn(),
    from: vi.fn(),
    removeChannel: vi.fn(),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: session.userId ? { user: { id: session.userId } } : null },
        error: null,
      })),
    },
  },
}));

vi.mock('../../repositories/SupabaseRepository', () => ({
  SupabaseRepository: class {
    save = remote.save;
    delete = vi.fn(async () => undefined);
    updateMatch = vi.fn(async () => undefined);
    updateMatches = vi.fn(async () => undefined);
    updateTournamentMetadata = vi.fn(async () => undefined);
    get = vi.fn(async () => null);
  },
}));

vi.mock('../../repositories/LocalStorageRepository', () => ({
  LocalStorageRepository: class {
    save = vi.fn(async () => undefined);
  },
}));

import { RepositoryProvider, useRepositories } from '../RepositoryContext';
import { MutationQueue } from '../../services/MutationQueue';
import { OfflineRepository } from '../../repositories/OfflineRepository';

type RepoUser = React.ComponentProps<typeof RepositoryProvider>['user'];

let currentUser: RepoUser = null;

function wrapperFor(strict: boolean) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const provider = <RepositoryProvider user={currentUser}>{children}</RepositoryProvider>;
    return strict ? <React.StrictMode>{provider}</React.StrictMode> : provider;
  };
}

function tournament(id: string): Tournament {
  return { id, title: `Turnier ${id}`, matches: [] } as unknown as Tournament;
}

/** Laesst ausstehende Microtasks ablaufen (setImmediate ist nicht gefaked). */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function storedItems(key: string): Array<{ id: string }> {
  const raw = mockStorage.get(key);
  return raw ? (JSON.parse(raw) as Array<{ id: string }>) : [];
}

function queueOf(repo: unknown): MutationQueue {
  return (repo as OfflineRepository).mutationQueue;
}

function sentTournamentIds(): string[] {
  return remote.save.mock.calls.map((call) => (call[0] as { id: string }).id);
}

describe('RepositoryContext — alte Queue wird bei Objektwechsel abgeraeumt (A-06f T1, A-07b P3)', () => {
  let disposeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mockStorage.clear();
    remote.save.mockClear();
    session.userId = 'A';
    net.online = true;
    currentUser = null;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
    disposeSpy = vi.spyOn(MutationQueue.prototype, 'dispose');
  });

  afterEach(() => {
    disposeSpy.mockRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('Dispose-Effekt', () => {
    it('Pflicht: neues Nutzer-Objekt -> dispose() der alten Queue genau einmal', () => {
      currentUser = { globalRole: 'user', id: 'A' };
      const { result, rerender } = renderHook(() => useRepositories(), { wrapper: wrapperFor(false) });
      const oldQueue = queueOf(result.current.tournamentRepository);

      currentUser = { globalRole: 'user', id: 'B' };
      rerender();

      expect(disposeSpy).toHaveBeenCalledTimes(1);
      expect(disposeSpy.mock.instances[0]).toBe(oldQueue);
    });

    it('Gegenbeispiel: gleiches Nutzer-Objekt -> dispose 0x', () => {
      const user = { globalRole: 'user', id: 'A' };
      currentUser = user;
      const { rerender } = renderHook(() => useRepositories(), { wrapper: wrapperFor(false) });

      rerender();
      rerender();

      expect(disposeSpy).toHaveBeenCalledTimes(0);
    });

    it('Gegenbeispiel: StrictMode-Mount -> dispose 0x', () => {
      currentUser = { globalRole: 'user', id: 'A' };
      renderHook(() => useRepositories(), { wrapper: wrapperFor(true) });

      expect(disposeSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('Ende-zu-Ende (@FU-006, @AN-024)', () => {
    it('Konto A offline 3 Eintraege -> Abmelden -> Anmelden B sendet nichts von A -> Anmelden A sendet 3', async () => {
      // Konto A offline: 3 Aenderungen landen in der Queue von A.
      net.online = false;
      currentUser = { globalRole: 'user', id: 'A' };
      const { result, rerender } = renderHook(() => useRepositories(), { wrapper: wrapperFor(false) });
      const repoA = result.current.tournamentRepository;
      await repoA.save(tournament('a1'));
      await repoA.save(tournament('a2'));
      await repoA.save(tournament('a3'));
      expect(queueOf(repoA).getPendingCount()).toBe(3);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(3);

      // Abmelden (nur dieses Geraet): Nutzer weg, Sitzung weg.
      currentUser = null;
      session.userId = null;
      rerender();
      expect(disposeSpy).toHaveBeenCalledTimes(1);

      // Anmelden B: Queue B entsteht, sendet nichts von A.
      net.online = true;
      session.userId = 'B';
      currentUser = { globalRole: 'user', id: 'B' };
      rerender();
      const queueB = queueOf(result.current.tournamentRepository);
      await queueB.process();
      await flush();
      expect(remote.save).not.toHaveBeenCalled();
      expect(queueB.getPendingCount()).toBe(0);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(3);

      // Anmelden A: die 3 Eintraege gehen raus.
      session.userId = 'A';
      currentUser = { globalRole: 'user', id: 'A' };
      rerender();
      const queueA2 = queueOf(result.current.tournamentRepository);
      await queueA2.process();
      await flush();
      expect(sentTournamentIds()).toEqual(['a1', 'a2', 'a3']);
      expect(queueA2.getPendingCount()).toBe(0);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(0);
    });

    it('Gegenbeispiel: gleiches Konto mit neuem Nutzer-Objekt (Token-Erneuerung) -> keine Wache, Eintraege gehen raus', async () => {
      net.online = false;
      currentUser = { globalRole: 'user', id: 'A' };
      const { result, rerender } = renderHook(() => useRepositories(), { wrapper: wrapperFor(false) });
      await result.current.tournamentRepository.save(tournament('a1'));
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(1);

      net.online = true;
      currentUser = { globalRole: 'user', id: 'A' };
      rerender();
      const queueA2 = queueOf(result.current.tournamentRepository);
      await queueA2.process();
      await flush();

      expect(sentTournamentIds()).toEqual(['a1']);
      expect(storedItems('mutation_queue_v1:A')).toHaveLength(0);
    });
  });
});
