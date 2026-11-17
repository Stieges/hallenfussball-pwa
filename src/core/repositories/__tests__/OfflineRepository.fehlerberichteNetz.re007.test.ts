/**
 * @RE-007 (Beispielzeilen 1, 2, 4): Wackliges Hallennetz füllt das Kontingent des Fehlerbericht-Dienstes nicht.
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Speicher, Fake-Cloud.
 *  1. Abgleich (5-s-Takt `get(id, {fresh})`) scheitert eine Stunde lang mit Netzfehler → 0 Berichte.
 *  2. Wechsel offline→online wiederholt sich (`syncUp`, Liste), Abgleich scheitert mit Netzfehler → 0 Berichte.
 *  4. Echter Server-Fehler → höchstens 1 Bericht je Turnier und Sitzung (Liste: je Sitzung).
 * Die App arbeitet weiter wie bisher: gleiche Rückgabewerte, gleiche Rückfall-Meldung, Cloud wird weiter abgefragt.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import { RepositoryError } from '../../errors';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), local: new Map<string, string>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.local.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.local.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.local.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.local.delete(key); }),
  },
}));
const sentry = vi.hoisted(() => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/sentry', () => sentry);
vi.mock('../../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: null }));

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { resetReportedOnceForTest } from '../reportOnce';
import type { SupabaseRepository } from '../SupabaseRepository';
import { createMockTournament } from '../../../test/factories';

const OLLI = 'olli';
const SERVER_REPORTS = (feature: string) => sentry.captureFeatureError.mock.calls.filter((c) => c[2] === feature);

/** Wie `@supabase/postgrest-js` einen Fetch-Fehler verpackt, den `SupabaseRepository` als RepositoryError wirft. */
const networkError = () => new RepositoryError('get', 'TypeError: Failed to fetch', { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' });
const serverError = () => new RepositoryError('get', 'permission denied for table tournaments', { message: 'permission denied for table tournaments', details: '', hint: '', code: '42501' });

function turnier(id: string): Tournament {
  return createMockTournament({ id, title: `Turnier ${id}`, ownerId: OLLI, teams: [], matches: [], version: 3, changeRevision: 1 });
}

function fakeCloud(failWith: () => Error) {
  const fail = vi.fn(async () => { throw failWith(); });
  return {
    fake: {
      get: fail,
      getWithMatchRevisions: fail,
      listWithMemberships: fail,
      listForCurrentUser: fail,
      save: vi.fn(async () => 4),
    },
    fail,
  };
}

const created: OfflineRepository[] = [];
function device(cloud: ReturnType<typeof fakeCloud>): OfflineRepository {
  const repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as unknown as SupabaseRepository, OLLI);
  created.push(repo);
  return repo;
}

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
  stores.raw.clear();
  stores.local.clear();
  stores.raw.set('tournaments', [turnier('T1'), turnier('T2')]);
  sentry.captureFeatureError.mockClear();
  resetReportedOnceForTest();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  created.splice(0).forEach((r) => r.mutationQueue.dispose());
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const HOUR_IN_5S_TICKS = 720;

describe('@RE-007 Stelle 1: Hintergrund-Abgleich (backgroundSync, 5-s-Takt bei unterbrochenem Kanal)', () => {
  it('@RE-007 eine Stunde lang alle 5 s Netzfehler: 0 Berichte, Rückgabe = lokale Kopie, Rückfall-Meldung jedes Mal, Cloud wird weiter abgefragt', async () => {
    const cloud = fakeCloud(networkError);
    const repo = device(cloud);
    const onLocalFallback = vi.fn();
    for (let tick = 0; tick < HOUR_IN_5S_TICKS; tick++) {
      const result = await repo.get('T1', { fresh: true, onLocalFallback });
      expect(result?.id).toBe('T1');
      expect(result?.version).toBe(3);
    }
    expect(onLocalFallback).toHaveBeenCalledTimes(HOUR_IN_5S_TICKS);
    expect(cloud.fail).toHaveBeenCalledTimes(HOUR_IN_5S_TICKS);
    expect(SERVER_REPORTS('backgroundSync')).toHaveLength(0);
  });

  it('@RE-007 Gegenbeispiel: echter Server-Fehler hundertmal → genau 1 Bericht; Rückgabe/Rückfall wie bei Netzfehler', async () => {
    const cloud = fakeCloud(serverError);
    const repo = device(cloud);
    const onLocalFallback = vi.fn();
    for (let i = 0; i < 100; i++) {
      expect((await repo.get('T1', { fresh: true, onLocalFallback }))?.id).toBe('T1');
    }
    expect(onLocalFallback).toHaveBeenCalledTimes(100);
    expect(cloud.fail).toHaveBeenCalledTimes(100);
    expect(SERVER_REPORTS('backgroundSync')).toHaveLength(1);
  });

  it('@RE-007 anderes Turnier: eigener Bericht; nach dem Neuladen (Rücksetzer) wieder höchstens einer je Turnier', async () => {
    const repo = device(fakeCloud(serverError));
    for (let i = 0; i < 20; i++) { await repo.get('T1', { fresh: true }); await repo.get('T2', { fresh: true }); }
    const ids = () => SERVER_REPORTS('backgroundSync').map((c) => (c[3] as { tournamentId: string }).tournamentId);
    expect(ids().sort()).toEqual(['T1', 'T2']);

    resetReportedOnceForTest();
    for (let i = 0; i < 20; i++) { await repo.get('T1', { fresh: true }); }
    expect(ids().sort()).toEqual(['T1', 'T1', 'T2']);
  });

  it('@RE-007 ohne fresh (Hintergrund beim ersten Lesen) gilt dieselbe Begrenzung; Rückgabe = lokale Kopie sofort', async () => {
    const repo = device(fakeCloud(networkError));
    for (let i = 0; i < 50; i++) { expect((await repo.get('T1'))?.id).toBe('T1'); }
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(SERVER_REPORTS('backgroundSync')).toHaveLength(0);
  });
});

describe('@RE-007 Stelle 3a: Wechsel offline→online, Abgleich (syncUp je Turnier)', () => {
  it('@RE-007 Wechsel wiederholt sich, Netzfehler: 0 Berichte, nichts hochgeladen, Aufruf kehrt normal zurück', async () => {
    const cloud = fakeCloud(networkError);
    const repo = device(cloud);
    for (let i = 0; i < 100; i++) { await expect(repo.syncUp()).resolves.toBeUndefined(); }
    expect(cloud.fail).toHaveBeenCalledTimes(200); // beide Turniere, jedes Mal – Abgleich versucht es weiter
    expect(cloud.fake.save).not.toHaveBeenCalled();
    expect(SERVER_REPORTS('syncTournament')).toHaveLength(0);
  });

  it('@RE-007 Gegenbeispiel: echter Server-Fehler, hundertmal → je Turnier genau 1 Bericht; Verhalten gleich (nichts hochgeladen)', async () => {
    const cloud = fakeCloud(serverError);
    const repo = device(cloud);
    for (let i = 0; i < 100; i++) { await repo.syncUp(); }
    expect(cloud.fail).toHaveBeenCalledTimes(200);
    expect(cloud.fake.save).not.toHaveBeenCalled();
    const ids = SERVER_REPORTS('syncTournament').map((c) => (c[3] as { tournamentId: string }).tournamentId);
    expect(ids.sort()).toEqual(['T1', 'T2']);
    resetReportedOnceForTest();
    await repo.syncUp();
    expect(SERVER_REPORTS('syncTournament')).toHaveLength(4);
  });
});

describe('@RE-007 Stelle 3b: Liste der Startseite bei jedem Online-Wechsel (listForCurrentUser)', () => {
  it('@RE-007 Netzfehler: 0 Berichte, die Liste kommt jedes Mal aus den lokalen Kopien (unverändert)', async () => {
    const repo = device(fakeCloud(networkError));
    const first = (await repo.listForCurrentUser()).map((t) => [t.id, t.myRole]);
    expect(first.map((e) => e[0]).sort()).toEqual(['T1', 'T2']);
    for (let i = 0; i < 100; i++) { expect((await repo.listForCurrentUser()).map((t) => [t.id, t.myRole])).toEqual(first); }
    expect(SERVER_REPORTS('list')).toHaveLength(0);
  });

  it('@RE-007 Gegenbeispiel: echter Server-Fehler hundertmal → genau 1 Bericht, Liste unverändert; nach Neuladen wieder einer', async () => {
    const repo = device(fakeCloud(serverError));
    const first = (await repo.listForCurrentUser()).map((t) => t.id);
    for (let i = 0; i < 99; i++) { expect((await repo.listForCurrentUser()).map((t) => t.id)).toEqual(first); }
    expect(first.sort()).toEqual(['T1', 'T2']);
    expect(SERVER_REPORTS('list')).toHaveLength(1);
    resetReportedOnceForTest();
    await repo.listForCurrentUser();
    expect(SERVER_REPORTS('list')).toHaveLength(2);
  });

  it('@RE-007 Zeitgrenze der Liste („Cloud fetch timeout“): weiter kein Bericht', async () => {
    const repo = device(fakeCloud(() => new Error('Cloud fetch timeout')));
    for (let i = 0; i < 20; i++) { await repo.listForCurrentUser(); }
    expect(SERVER_REPORTS('list')).toHaveLength(0);
  });
});
