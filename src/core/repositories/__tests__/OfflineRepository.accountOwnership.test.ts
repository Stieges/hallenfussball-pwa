/**
 * A-07e: Lokale Turnier-Kopien gehoeren einem Konto ('guest' = Gastmodus).
 *
 * @AN-024: Nach dem Abmelden zeigt der Gastmodus keine Konto-Turniere; Anmelden B sendet nichts von A.
 * @FU-006: Wartende Eintraege gehen nur unter dem Konto an den Server, unter dem sie entstanden sind.
 * Grenzfall Altbestand (ohne Marker): beim Laden eines Kontos anhand der Cloud-Liste markiert,
 * Rest 'guest'. Ohne Konto bleibt er unangetastet und wird im Gastmodus als 'guest' gezeigt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const net = vi.hoisted(() => ({ online: true }));
const stores = vi.hoisted(() => ({
  raw: new Map<string, unknown>(),
  queue: new Map<string, string>(),
}));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(stores.raw.get(key)),
      set: (key: string, value: unknown) => {
        stores.raw.set(key, value);
        return Promise.resolve();
      },
    }),
}));

vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      stores.queue.set(key, value);
    }),
    setItemPersisted: vi.fn((key: string, value: string) => {
      stores.queue.set(key, value);
      return true;
    }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => {
      stores.queue.delete(key);
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

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';

type CloudEntry = { owner: string; t: Tournament };
const cloud = new Map<string, CloudEntry>();

/** Cloud-Sicht eines Kontos: nur dessen Turniere, save landet unter diesem Konto. */
function cloudFor(userId: string) {
  return {
    get: vi.fn(async (id: string) => {
      const entry = cloud.get(id);
      return entry?.owner === userId ? entry.t : null;
    }),
    save: vi.fn(async (t: Tournament) => {
      cloud.set(t.id, { owner: userId, t });
    }),
    listForCurrentUser: vi.fn(async () =>
      [...cloud.values()].filter((e) => e.owner === userId).map((e) => e.t)
    ),
    getByShareCode: vi.fn(async () => null),
  };
}

function t(id: string): Tournament {
  return {
    id,
    title: `Turnier ${id}`,
    status: 'draft',
    teams: [],
    matches: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  } as unknown as Tournament;
}

/** Laesst ausstehende Microtasks der Queue ablaufen (setImmediate ist nicht gefaked). */
async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

function storedTournaments(): Tournament[] {
  return (stores.raw.get('tournaments') as Tournament[] | undefined) ?? [];
}

function idsOf(list: Tournament[]): string[] {
  return list.map((x) => x.id).sort();
}

describe('A-07e Konto-Ausgang lokaler Kopien (@AN-024, @FU-006)', () => {
  const repos: OfflineRepository[] = [];
  const track = (r: OfflineRepository): OfflineRepository => {
    repos.push(r);
    return r;
  };

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    stores.raw.clear();
    stores.queue.clear();
    cloud.clear();
    repos.length = 0;
    session.userId = 'A';
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    repos.forEach((r) => r.mutationQueue.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('Echter Weg: A sieht und sendet nur eigene Kopien; nach Abmelden und Anmelden B nichts davon', async () => {
    cloud.set('T', { owner: 'A', t: t('T') });
    const cloudA = cloudFor('A');
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudA as never, 'A'));

    // Cloud-Turnier T zwischenspeichern, offline angelegtes T2 wartend lassen
    await repoA.get('T');
    net.online = false;
    await repoA.save(t('T2'));
    await flush();
    expect(cloudA.save).not.toHaveBeenCalled();

    // Abmelden: Gastmodus zeigt keine Konto-Turniere, Queue von A stoppt
    session.userId = null;
    repoA.mutationQueue.dispose();
    expect(idsOf(await new LocalStorageRepository().listForCurrentUser())).toEqual([]);

    // Anmelden B: keine Turniere von A, nichts wird hochgeladen
    session.userId = 'B';
    net.online = true;
    const cloudB = cloudFor('B');
    const repoB = track(new OfflineRepository(new LocalStorageRepository(), cloudB as never, 'B'));
    expect(idsOf(await repoB.listForCurrentUser())).toEqual([]);
    await repoB.syncUp();
    await flush();
    expect(cloudB.save).not.toHaveBeenCalled();
    expect(cloudA.save).not.toHaveBeenCalled();

    // Anmelden A: T und T2 sichtbar, T2 wird gesendet
    session.userId = 'A';
    const cloudA2 = cloudFor('A');
    const repoA2 = track(new OfflineRepository(new LocalStorageRepository(), cloudA2 as never, 'A'));
    expect(idsOf(await repoA2.listForCurrentUser())).toEqual(['T', 'T2']);
    await repoA2.mutationQueue.process();
    await flush();
    expect(cloudA2.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'T2' }));
  });

  it('Gegenbeispiel Probelauf: Gast-Turnier bleibt im Gastmodus sichtbar und wird beim Anmelden nicht hochgeladen', async () => {
    await new LocalStorageRepository().save(t('probe'));

    session.userId = 'A';
    const cloudA = cloudFor('A');
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudA as never, 'A'));
    expect(idsOf(await repoA.listForCurrentUser())).not.toContain('probe');
    await repoA.syncUp();
    await flush();
    expect(cloudA.save).not.toHaveBeenCalled();
    expect(cloudA.get).not.toHaveBeenCalledWith('probe');

    session.userId = null;
    expect(idsOf(await new LocalStorageRepository().listForCurrentUser())).toEqual(['probe']);
  });

  it('Altbestand ohne Marker: ohne Konto unangetastet, im Gastmodus als guest, beim Laden von A per Cloud-Liste markiert, Rest guest', async () => {
    stores.raw.set('tournaments', [t('U1'), t('U2')]);
    cloud.set('U1', { owner: 'A', t: t('U1') });

    session.userId = null;
    expect(idsOf(await new LocalStorageRepository().listForCurrentUser())).toEqual(['U1', 'U2']);
    expect(storedTournaments().every((x) => x.ownerId === undefined)).toBe(true);

    session.userId = 'A';
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudFor('A') as never, 'A'));
    expect(idsOf(await repoA.listForCurrentUser())).toEqual(['U1']);
    const owners = Object.fromEntries(storedTournaments().map((x) => [x.id, x.ownerId]));
    expect(owners).toEqual({ U1: 'A', U2: 'guest' });

    session.userId = null;
    expect(idsOf(await new LocalStorageRepository().listForCurrentUser())).toEqual(['U2']);
  });

  it('M-1 Anmelden als A (echter Weg: Dashboard-Liste + syncUp) laedt Probelauf und alt nicht hoch, Marker unveraendert', async () => {
    stores.raw.set('tournaments', [{ ...t('probe'), ownerId: 'guest' }, t('alt')]);

    session.userId = 'A';
    const cloudA = cloudFor('A');
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudA as never, 'A'));
    await repoA.listForCurrentUser();
    await repoA.syncUp();
    await flush();

    expect(cloudA.save).not.toHaveBeenCalled();
    const owners = Object.fromEntries(storedTournaments().map((x) => [x.id, x.ownerId]));
    expect(owners).toEqual({ probe: 'guest', alt: 'guest' });
  });

  it('S-1 Hintergrund-Aktualisierung einer zwischengespeicherten Kopie (neuere Cloud-Version) behaelt den Konto-Marker: Gast-Liste nach Abmelden leer', async () => {
    cloud.set('T', { owner: 'A', t: { ...t('T'), version: 1 } });
    const cloudA = cloudFor('A');
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudA as never, 'A'));
    await repoA.get('T');
    cloud.set('T', { owner: 'A', t: { ...t('T'), version: 2, title: 'neuer Stand' } });

    await repoA.get('T');
    await flush();
    expect(storedTournaments().find((x) => x.id === 'T')?.version).toBe(2);
    repoA.mutationQueue.dispose();

    session.userId = null;
    expect(idsOf(await new LocalStorageRepository().listForCurrentUser())).toEqual([]);
  });

  it('S-1 Speichern ohne Marker ueber eine Kopie mit Konto-Marker behaelt den Marker (Gegenstueck zur Hintergrund-Aktualisierung)', async () => {
    await new LocalStorageRepository().save({ ...t('T'), ownerId: 'A' });
    await new LocalStorageRepository().save(t('T'));

    expect(storedTournaments().find((x) => x.id === 'T')?.ownerId).toBe('A');
  });

  it('S-3 P1 (Gegenbeispiel): offline, Sitzung null, Konto A liest seine eigene Kopie', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A' }]);
    session.userId = null;
    net.online = false;
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudFor('A') as never, 'A'));

    expect((await repoA.get('T'))?.id).toBe('T');
  });

  it('S-3 P2: lokal neuerer Stand (v3) wird bei der Hintergrund-Aktualisierung nicht durch Cloud v2 ueberschrieben', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A', version: 3, title: 'lokal-neu' }]);
    cloud.set('T', { owner: 'A', t: { ...t('T'), version: 2, title: 'cloud-alt' } });
    const repoA = track(new OfflineRepository(new LocalStorageRepository(), cloudFor('A') as never, 'A'));

    expect((await repoA.get('T'))?.title).toBe('lokal-neu');
    await flush();

    const stored = storedTournaments().find((x) => x.id === 'T');
    expect(stored?.title).toBe('lokal-neu');
    expect(stored?.version).toBe(3);
  });

  it('S-3 (c): Konto B bekommt die lokale Kopie von A nicht; Altbestand ohne Marker ist fuer ein Konto nicht lokal', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A' }, t('U')]);
    session.userId = 'B';
    const repoB = track(new OfflineRepository(new LocalStorageRepository(), cloudFor('B') as never, 'B'));

    expect(await repoB.get('T')).toBeNull();
    expect(await repoB.get('U')).toBeNull();
  });

  it('S-1 Race: lokale Kopie fehlt bei der Hintergrund-Aktualisierung, die neue Kopie gehoert trotzdem dem Konto', async () => {
    cloud.set('T', { owner: 'A', t: { ...t('T'), version: 2 } });
    const local = new LocalStorageRepository();
    await local.save({ ...t('T'), ownerId: 'A', version: 1 });
    const repoA = track(new OfflineRepository(local, cloudFor('A') as never, 'A'));
    const realGet = local.get.bind(local);
    vi.spyOn(local, 'get').mockImplementationOnce(realGet).mockImplementationOnce(async () => {
      await local.delete('T'); // lokale Kopie verschwindet zwischen Lesen und Aktualisieren
      return null;
    });

    await repoA.get('T');
    await flush();

    expect(storedTournaments().find((x) => x.id === 'T')?.ownerId).toBe('A');
  });

  it('S-3 Gast (viewer guest): nach Abmelden findet ein direkter Abruf von A nichts; Gast-Turnier bleibt erreichbar; delete loescht keine Konto-Kopie', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A' }, { ...t('probe'), ownerId: 'guest' }, t('alt')]);
    session.userId = null;
    const guest = new LocalStorageRepository({ viewer: 'guest' });

    expect(await guest.get('T')).toBeNull();
    expect((await guest.get('probe'))?.id).toBe('probe');
    expect((await guest.get('alt'))?.id).toBe('alt');

    await guest.delete('T');
    expect(storedTournaments().some((x) => x.id === 'T')).toBe(true);
    await guest.delete('probe');
    expect(storedTournaments().some((x) => x.id === 'probe')).toBe(false);
  });

  it('S-3 ohne viewer bleibt roh: der Abruf liefert auch fremde Kopien (Queue, Monitor, intern)', async () => {
    stores.raw.set('tournaments', [{ ...t('T'), ownerId: 'A' }]);
    expect((await new LocalStorageRepository().get('T'))?.id).toBe('T');
  });
});
