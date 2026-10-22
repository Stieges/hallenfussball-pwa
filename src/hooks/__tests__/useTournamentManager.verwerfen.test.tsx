/**
 * @FU-106 (Befund C-VERWERFEN-BEHAELT-VERALTETEN-STAND): Verwirft Maria am Gerät der Co-Admin ihre wegen eines Konflikts
 * abgelehnte Änderung („Verwerfen“ in `SyncStatusIndicator` → `clearFailedMutation`), zeigt die geöffnete Ansicht ohne
 * Neuladen und ohne Push Ollis Stand. Echtes `OfflineRepository` mit Fake-Cloud, Realtime-Kanal verbunden (kein
 * Abfrage-Ausweichen), `useTournamentManager` wie im Spielplan. Seit der Entscheidung vom 20.10. („Verwerfen = immer Stand
 * des Servers“) gilt das auch ohne Konflikt.
 * Anforderung: `plattform/2026-09-24_fundament-gemeinsamer-stand.md`.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
const REPOS = vi.hoisted(() => ({ tournamentRepository: null as object | null, isRealtimeEnabled: true }));
const realtime = vi.hoisted(() => {
  const statusCbs: Array<(status: string) => void> = [];
  const channel = {
    on: () => channel,
    subscribe: (cb: (status: string) => void) => { statusCbs.push(cb); return channel; },
  };
  return {
    statusCbs,
    supabase: {
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
      channel: () => channel,
      removeChannel: () => Promise.resolve('ok'),
    },
  };
});

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: realtime.supabase }));
vi.mock('../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => REPOS }));

import { OfflineRepository } from '../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { createFakeCloud } from '../../test/fakeCloudRepository';
import { liveCup } from '../../test/queueGuardFixtures';
import { useTournamentManager } from '../useTournamentManager';

const MARIA = 'maria';

function Host() {
  const { tournament } = useTournamentManager('T');
  return <output data-testid="titel">{tournament?.title ?? 'leer'}</output>;
}

async function tick(): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  await act(async () => { for (let i = 0; i < 20; i++) { await new Promise<void>((r) => setImmediate(r)); } });
}

/** Marias Konflikt-Eintrag im Dead-Letter (wie nach MAX_RETRIES abgelehnten Versuchen aus Version 7). */
function konfliktImDeadLetter(conflict: boolean): void {
  const payload: Tournament = { ...liveCup(7, { title: 'Marias Titel' }), ownerId: MARIA };
  stores.queue.set(`mutation_queue_failed_v1:${MARIA}`, JSON.stringify([
    { id: 'dl-1', type: 'SAVE_TOURNAMENT', payload, timestamp: 1, retryCount: 5, failedAt: 2, lastError: 'Turnier wurde zwischenzeitlich verändert. Bitte neu laden.', ...(conflict ? { conflict: true } : {}) },
  ]));
}

describe('@FU-106 Verwerfen nach einem Konflikt: die geöffnete Ansicht zeigt den Stand des Servers', () => {
  let repo: OfflineRepository;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    realtime.statusCbs.length = 0;
    stores.raw.set('tournaments', [{ ...liveCup(8, { title: 'Marias Titel' }), ownerId: MARIA }]); // lokal v8, nie hochgeladen
  });
  afterEach(() => {
    repo.mutationQueue.dispose();
    vi.useRealTimers();
  });

  async function mount(conflict: boolean) {
    konfliktImDeadLetter(conflict);
    const cloud = createFakeCloud({ tournament: liveCup(8, { title: 'Ollis Titel' }), revisions: new Map([['spiel-4', 1], ['hf-1', 1]]) });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, MARIA);
    REPOS.tournamentRepository = repo;
    const view = render(<Host />);
    await tick();
    act(() => { realtime.statusCbs.forEach((cb) => cb('SUBSCRIBED')); });
    await tick();
    expect(view.getByTestId('titel').textContent).toBe('Marias Titel'); // Regel Q: der Eintrag im Dead-Letter schützt die Kopie
    return { view, cloud };
  }

  it('@FU-106 nach dem Verwerfen zeigt die Ansicht ohne Neuladen „Ollis Titel“', async () => {
    const { view } = await mount(true);

    act(() => { repo.mutationQueue.clearFailedMutation('dl-1'); });
    await tick();

    expect(view.getByTestId('titel').textContent).toBe('Ollis Titel');
    expect(repo.mutationQueue.getFailedCount()).toBe(0);
  });

  it('@FU-109 ohne erreichbaren Server verworfen: die Ansicht behält den Inhalt; kommt die Verbindung zurück, zeigt sie ohne Push den Stand des Servers', async () => {
    const { view, cloud } = await mount(false);
    const read = cloud.fake.getWithMatchRevisions.getMockImplementation()!;
    cloud.fake.getWithMatchRevisions.mockRejectedValue(new Error('Failed to fetch')); // Server nicht erreichbar

    act(() => { repo.mutationQueue.clearFailedMutation('dl-1'); });
    await tick();
    expect(view.getByTestId('titel').textContent).toBe('Marias Titel'); // nichts gelöscht
    expect(repo.mutationQueue.needsCloudCopy('T')).toBe(true);

    cloud.fake.getWithMatchRevisions.mockImplementation(read);
    act(() => { window.dispatchEvent(new Event('online')); }); // Verbindung wieder da
    await tick();

    expect(view.getByTestId('titel').textContent).toBe('Ollis Titel');
    expect(repo.mutationQueue.needsCloudCopy('T')).toBe(false);
  });

  it('@FU-106 auch ohne Konflikt zeigt die Ansicht nach dem Verwerfen ohne Neuladen den Stand des Servers (Entscheidung 20.10.)', async () => {
    const { view } = await mount(false);

    act(() => { repo.mutationQueue.clearFailedMutation('dl-1'); });
    await tick();

    expect(view.getByTestId('titel').textContent).toBe('Ollis Titel');
    expect(repo.mutationQueue.getFailedCount()).toBe(0);
  });
});
