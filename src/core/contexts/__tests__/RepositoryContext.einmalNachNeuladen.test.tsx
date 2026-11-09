/**
 * RepositoryContext.einmalNachNeuladen.test.tsx — Befund C-DOPPELTE-SENDUNG-NACH-NEULADEN, @FU-122.
 *
 * Nach dem Neuladen liegt ein noch nicht übertragener Eintrag im Gerätespeicher. Die App läuft wie in `main.tsx` unter
 * `React.StrictMode`; dort ruft React die Fabrik von `useMemo` zweimal auf und verwirft ein Ergebnis. Der Eintrag muss
 * trotzdem genau einmal beim Server ankommen (CI-Lauf 42426589562: zwei `PATCH tournaments … version=eq.1`, der zweite
 * als Konflikt im Dead-Letter).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// eslint-disable-next-line no-restricted-imports -- RepositoryContext ist eine bewusste React-Bridge; dieser Test verifiziert sie ueber React Testing Library.
import { renderHook } from '@testing-library/react';
// eslint-disable-next-line no-restricted-imports -- s.o.
import React from 'react';

const session = vi.hoisted((): { userId: string | null } => ({ userId: 'A' }));
const net = vi.hoisted(() => ({ online: true }));
const remote = vi.hoisted(() => ({
  save: vi.fn(async (..._args: unknown[]): Promise<number> => 2),
}));

const mockStorage = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    setItemPersisted: vi.fn((key: string, value: string) => { mockStorage.set(key, value); return true; }),
    getItem: vi.fn((key: string) => mockStorage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { mockStorage.set(key, value); }),
    removeItem: vi.fn((key: string) => { mockStorage.delete(key); }),
    getIsAvailable: vi.fn(() => true),
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
    get = vi.fn(async () => null);
    confirmUpload = vi.fn(async () => undefined);
  },
}));

import { RepositoryProvider, useRepositories } from '../RepositoryContext';
import { OfflineRepository } from '../../repositories/OfflineRepository';

type RepoUser = React.ComponentProps<typeof RepositoryProvider>['user'];

const QUEUE_KEY = 'mutation_queue_v1:A';
const FAILED_KEY = 'mutation_queue_failed_v1:A';

let currentUser: RepoUser = null;
/** Queues der gerenderten Provider: nach jedem Test entsorgt, damit kein `online`-Zuhörer in den nächsten Test reicht. */
const rendered: OfflineRepository[] = [];

function renderProvider(strict: boolean): void {
  const { result } = renderHook(() => useRepositories(), { wrapper: wrapperFor(strict) });
  rendered.push(result.current.tournamentRepository as OfflineRepository);
}

function wrapperFor(strict: boolean) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    const provider = <RepositoryProvider user={currentUser}>{children}</RepositoryProvider>;
    return strict ? <React.StrictMode>{provider}</React.StrictMode> : provider;
  };
}

/** Stand vor dem Neuladen: das Tor in Spiel 6 (als Speichern des Turniers) wartet noch im Gerätespeicher. */
function seedWaitingSave(): void {
  const item = {
    id: 'm-spiel-6',
    type: 'SAVE_TOURNAMENT',
    payload: { id: 't-live-cup', title: 'Live-Cup', matches: [], serverVersion: 1 },
    timestamp: 1,
    retryCount: 0,
  };
  mockStorage.set(QUEUE_KEY, JSON.stringify([item]));
}

/** Laesst ausstehende Microtasks ablaufen (setImmediate ist nicht gefaked). */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function stored(key: string): unknown[] {
  const raw = mockStorage.get(key);
  return raw ? (JSON.parse(raw) as unknown[]) : [];
}

describe('@FU-122 Nach dem Neuladen geht ein noch nicht übertragener Eintrag genau einmal raus (C-DOPPELTE-SENDUNG-NACH-NEULADEN)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    mockStorage.clear();
    remote.save.mockClear();
    session.userId = 'A';
    net.online = true;
    currentUser = { globalRole: 'user', id: 'A' };
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
    seedWaitingSave();
  });

  afterEach(() => {
    rendered.splice(0).forEach((repo) => repo.mutationQueue.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it.fails('@FU-122 App mit Netz neu geöffnet (StrictMode wie main.tsx): das Tor in Spiel 6 kommt genau einmal beim Server an', async () => {
    renderProvider(true);
    await flush();

    expect(remote.save).toHaveBeenCalledTimes(1);
    expect(stored(QUEUE_KEY)).toHaveLength(0);
    expect(stored(FAILED_KEY)).toHaveLength(0);
  });

  it('@FU-122 Gegenprobe ohne StrictMode: das Tor in Spiel 6 kommt genau einmal beim Server an', async () => {
    renderProvider(false);
    await flush();

    expect(remote.save).toHaveBeenCalledTimes(1);
    expect(stored(QUEUE_KEY)).toHaveLength(0);
    expect(stored(FAILED_KEY)).toHaveLength(0);
  });

  it.fails('@FU-122 Gegenbeispiel: App ohne Netz geöffnet, dann Netz da – der wartende Eintrag geht genau einmal raus', async () => {
    net.online = false;
    renderProvider(true);
    await flush();
    expect(remote.save).not.toHaveBeenCalled();

    net.online = true;
    window.dispatchEvent(new Event('online'));
    await flush();

    expect(remote.save).toHaveBeenCalledTimes(1);
    expect(stored(QUEUE_KEY)).toHaveLength(0);
  });
});
