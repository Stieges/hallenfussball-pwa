/**
 * Review A-11 A4 (Befund C-RECHTE-NACH-ANLEGEN-UNBEKANNT): Woran die App erkennt, dass das Konto das Turnier auf diesem
 * Gerät angelegt hat und es noch nicht in der Cloud ist. Anforderung `plattform/2026-09-24_fundament-gemeinsamer-stand.md`
 * @FU-098 (Eigentümer sofort mit allen Rechten), Gegenbeispiele @FU-099/@FU-100 (Fremder bzw. Helfer bekommt dadurch
 * keine Eigentümer-Rechte).
 *
 * Gegenbeispiel-Kern: die lokale Markierung `ownerId` ist der Konto-Marker der Kopie (A-07e) – auch Toms aus der Cloud
 * geladene Kopie trägt `ownerId: 'tom'`. Sie allein darf niemanden zum Eigentümer machen.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const net = vi.hoisted(() => ({ online: true }));
const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
    }),
}));
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: session.userId ? { user: { id: session.userId } } : null }, error: null })),
    },
  },
}));

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { flush, liveCup, revisions } from '../../../test/queueGuardFixtures';

/** Ein frisch im Wizard angelegter Live-Cup: noch nie in der Cloud (keine Server-Zählung `changeRevision`). */
function freshLiveCup(): Tournament {
  const { changeRevision: _never, ...rest } = liveCup(0);
  return { ...rest, ownerId: undefined };
}

describe('OfflineRepository.isAwaitingFirstUpload (@FU-098, Gegenbeispiele @FU-099/@FU-100)', () => {
  let repo: OfflineRepository | undefined;

  beforeEach(() => {
    stores.raw.clear();
    stores.queue.clear();
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    repo?.mutationQueue.dispose();
    repo = undefined;
    vi.unstubAllGlobals();
  });

  it('@FU-098 Olli legt den Live-Cup ohne Netz an: wartet auf die erste Übertragung', async () => {
    session.userId = 'olli';
    net.online = false;
    const cloud = createFakeCloud({ tournament: liveCup(1, { title: 'anderes Turnier' }), revisions: revisions() });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');

    await repo.save(freshLiveCup());

    expect(await repo.isAwaitingFirstUpload('T')).toBe(true);
  });

  it('@FU-098 die Übertragung läuft noch (online, Antwort steht aus): wartet weiter', async () => {
    session.userId = 'olli';
    const cloud = createFakeCloud({ tournament: liveCup(1), revisions: revisions() });
    let releaseSave: () => void = () => undefined;
    cloud.fake.save.mockImplementationOnce(() => new Promise<void>((resolve) => { releaseSave = resolve; }));
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');

    await repo.save(freshLiveCup());

    expect(await repo.isAwaitingFirstUpload('T')).toBe(true);
    releaseSave();
  });

  it('@FU-098 Gegenbeispiel: ist die Übertragung durch, wartet nichts mehr (dann entscheidet der Server)', async () => {
    session.userId = 'olli';
    const cloud = createFakeCloud({ tournament: liveCup(0), revisions: revisions() });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');

    await repo.save(freshLiveCup());
    await flush();

    expect(cloud.fake.save).toHaveBeenCalled();
    expect(await repo.isAwaitingFirstUpload('T')).toBe(false);
  });

  it('@FU-100 Gegenbeispiel: Toms aus der Cloud geladene Kopie (Marker „tom“) mit wartender Änderung macht ihn nicht zum Eigentümer', async () => {
    session.userId = 'tom';
    // Jede Cloud-Zeile trägt die Server-Zählung (Mapper `changeRevisionFromRow`: fehlt die Spalte, 0).
    const cloud = createFakeCloud({ tournament: { ...liveCup(3), changeRevision: 0 }, revisions: revisions() });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'tom');
    const loaded = await repo.get('T'); // erste Kopie aus der Cloud
    expect(loaded).not.toBeNull();
    net.online = false;

    await repo.updateMatch('T', { id: 'spiel-4', scoreA: 1 });

    const local = (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T');
    expect(local?.ownerId).toBe('tom'); // der Marker allein sagt nichts über den Eigentümer
    expect(await repo.isAwaitingFirstUpload('T')).toBe(false);
  });

  it('@FU-099 Gegenbeispiel: ohne lokale Kopie wartet nichts auf eine erste Übertragung', async () => {
    session.userId = 'fremder';
    const cloud = createFakeCloud({ tournament: liveCup(1), revisions: revisions() });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'fremder');

    expect(await repo.isAwaitingFirstUpload('T')).toBe(false);
  });
});
