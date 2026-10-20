/**
 * CA-5 (Befund C-LISTE-NUR-EIGENTUEMER, Plan-Review Auflage 10a/b) – Startseiten-Liste am Gerät der Co-Admin:
 * echtes `OfflineRepository` + echtes `LocalStorageRepository`, Fake-Speicher, Fake-Cloud.
 *
 * @HE-085 „Dann sieht Maria nach der Anmeldung … das Nikolaus-Turnier und kann es wie Olli leiten“
 *   → genau einmal in der Liste, mit Rolle Co-Admin, auch wenn eine lokale Kopie liegt.
 * @HE-087 „Und das Nikolaus-Turnier steht nach dem Neuladen nicht mehr auf ihrer Startseite“
 *   → die lokale Kopie erscheint nach dem Austragen nicht als eigenes „nur lokales“ Turnier (Auflage 10a),
 *     auch nicht ohne Netz, und wird nie hochgeladen.
 * Auflage 10b: ohne Netz bleibt die Rolle Co-Admin erhalten (Gedächtnis je Konto).
 * @FU-100 (Geist): scheitert nur die Mitglieder-Abfrage, bleibt die Liste nicht leer; der Fehler wird gemeldet.
 * Gegenbeispiele: noch nie hochgeladenes eigenes Turnier bleibt „nur lokal“; eigenes Turnier im Papierkorb bleibt;
 * anonyme Sitzung unverändert.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import type { CloudTournamentList } from '../accountTournamentList';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), local: new Map<string, string>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, value); return Promise.resolve(); },
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
import type { SupabaseRepository } from '../SupabaseRepository';
import { readWithRevisions } from '../../../test/fakeCloudRepository';
import { createMockTournament } from '../../../test/factories';

const MARIA = 'maria';

function turnier(id: string, title: string, extra: Partial<Tournament> = {}): Tournament {
  return createMockTournament({ id, title, teams: [], matches: [], status: 'published', version: 3, changeRevision: 2, ...extra });
}

const NIKOLAUS = turnier('nikolaus', 'Nikolaus-Turnier', { ownerId: 'olli' });

/** Fake-Cloud: `list` ist die Antwort der Startseiten-Abfrage, `rows` das, was ein Einzelabruf lesen darf. */
function fakeCloud(initial: CloudTournamentList) {
  const state = { list: initial as CloudTournamentList | Error, rows: [NIKOLAUS] as Tournament[] };
  const get = vi.fn(async (id: string) => structuredClone(state.rows.find((t) => t.id === id) ?? null));
  const fake = {
    get,
    getWithMatchRevisions: vi.fn(readWithRevisions(get)),
    listWithMemberships: vi.fn(async () => {
      if (state.list instanceof Error) { throw state.list; }
      return state.list;
    }),
    listForCurrentUser: vi.fn(async () => (state.list instanceof Error ? [] : state.list.tournaments)),
    save: vi.fn(async () => undefined),
  };
  return { state, fake };
}

const known = (tournaments: Tournament[], ownIds: string[] = []): CloudTournamentList =>
  ({ tournaments, ownIds: new Set(ownIds), memberships: 'known' });
const asMember = (t: Tournament, myRole: Tournament['myRole']): Tournament => ({ ...t, myRole });

const created: OfflineRepository[] = [];
function deviceOf(account: string, cloud: ReturnType<typeof fakeCloud>): OfflineRepository {
  const repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as unknown as SupabaseRepository, account);
  created.push(repo);
  return repo;
}

const rolesOf = (list: Tournament[]) => list.map((t) => [t.id, t.myRole]);

beforeEach(() => {
  stores.raw.clear();
  stores.local.clear();
  sentry.captureFeatureError.mockClear();
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
});
afterEach(() => { created.forEach((r) => r.mutationQueue.dispose()); created.length = 0; });

describe('CA-5 OfflineRepository.listForCurrentUser am Gerät der Co-Admin', () => {
  it('@HE-088 @HE-085 Maria hat das Nikolaus-Turnier schon geöffnet: es steht genau einmal da, mit Rolle Co-Admin', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    expect((await repo.get('nikolaus'))?.id).toBe('nikolaus');

    expect(rolesOf(await repo.listForCurrentUser())).toEqual([['nikolaus', 'co-admin']]);
  });

  it('@HE-087 nach dem Austragen: die lokale Kopie erscheint nicht als eigenes „nur lokales“ Turnier', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    await repo.listForCurrentUser();

    cloud.state.list = known([]); // Betreiber trägt Maria aus
    cloud.state.rows = []; // die Lese-Regel lässt das private Turnier nicht mehr durch
    expect(await repo.listForCurrentUser()).toEqual([]);
  });

  it('@HE-087 ohne Netz nach dem Austragen: das Nikolaus-Turnier bleibt weg (Gedächtnis)', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    cloud.state.list = known([]);
    await repo.listForCurrentUser();

    cloud.state.list = new Error('Failed to fetch');
    const offline = deviceOf(MARIA, cloud); // Neuladen ohne Netz
    expect(await offline.listForCurrentUser()).toEqual([]);
  });

  it('@HE-087 die Kopie wird nie hochgeladen (Abgleich beim Start)', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    cloud.state.list = known([]);
    cloud.state.rows = [];

    await repo.syncUp();
    await repo.listForCurrentUser();
    await repo.syncUp();
    expect(cloud.fake.save).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein auf dem Gerät angelegtes, noch nie hochgeladenes Turnier bleibt „nur lokal“, als eigenes, und wird hochgeladen', async () => {
    const cloud = fakeCloud(known([]));
    cloud.state.rows = [];
    // ohne Netz auf dem Gerät angelegt: Konto-Marker gesetzt, nie aus der Cloud gelesen (kein `changeRevision`)
    stores.raw.set('tournaments', [turnier('eigen', 'Marias Probe', { ownerId: MARIA, changeRevision: undefined, version: 1 })]);
    const repo = deviceOf(MARIA, cloud);

    expect(rolesOf(await repo.listForCurrentUser())).toEqual([['eigen', 'owner']]);
    await repo.syncUp();
    expect(cloud.fake.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'eigen' }));
  });

  it('Gegenbeispiel: Ollis eigenes Turnier im Papierkorb (Kopie aus der Cloud) bleibt in der Liste', async () => {
    const imPapierkorb = turnier('alt', 'Altes Turnier', { deletedAt: '2026-11-01T10:00:00.000Z' });
    const cloud = fakeCloud(known([], ['alt']));
    cloud.state.rows = [imPapierkorb];
    const repo = deviceOf('olli', cloud);
    await repo.get('alt');

    expect((await repo.listForCurrentUser()).map((t) => t.id)).toEqual(['alt']);
  });

  it('Auflage 10b: ohne Netz bleibt die Rolle Co-Admin (kein „Löschen“ für Maria)', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    await repo.listForCurrentUser();

    cloud.state.list = new Error('Failed to fetch');
    const offline = deviceOf(MARIA, cloud);
    expect(rolesOf(await offline.listForCurrentUser())).toEqual([['nikolaus', 'co-admin']]);
  });

  it('Gegenbeispiel Auflage 10b: das Gedächtnis gilt je Konto – Olli am selben Gerät erbt Marias Rolle nicht', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const maria = deviceOf(MARIA, cloud);
    await maria.get('nikolaus');
    await maria.listForCurrentUser();

    // Später liegt auf dem Gerät Ollis eigene Kopie des Nikolaus-Turniers; Olli ist ohne Netz angemeldet
    stores.raw.set('tournaments', [{ ...NIKOLAUS, ownerId: 'olli' }]);
    cloud.state.list = new Error('Failed to fetch');
    expect(rolesOf(await deviceOf('olli', cloud).listForCurrentUser())).toEqual([['nikolaus', undefined]]);
  });

  it('@FU-100 Mitglieder-Abfrage scheitert: das Nikolaus-Turnier bleibt mit gemerkter Rolle, der Fehler wird gemeldet', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    await repo.listForCurrentUser();

    const failure = new Error('tournament_collaborators nicht erreichbar');
    cloud.state.list = { tournaments: [], ownIds: new Set(), memberships: 'unknown', membershipError: failure };
    expect(rolesOf(await repo.listForCurrentUser())).toEqual([['nikolaus', 'co-admin']]);
    expect(sentry.captureFeatureError).toHaveBeenCalledWith(failure, 'repository', 'listMemberships');
  });

  it('Rollenumfang (Auflage 10d): anonyme Sitzung – die aus der Cloud geladene Kopie bleibt wie bisher in der Liste', async () => {
    const cloud = fakeCloud({ tournaments: [], ownIds: new Set(), memberships: 'not-queried' });
    const repo = deviceOf('anon-geraet', cloud);
    await repo.get('nikolaus');

    expect((await repo.listForCurrentUser()).map((t) => t.id)).toEqual(['nikolaus']);
  });

  it('@HE-087 Review-Auflage R2: scheitert die Mitglieder-Abfrage nach dem Austragen, bleibt das Turnier weg (nicht als eigenes)', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    await repo.listForCurrentUser();
    cloud.state.list = known([]); // ausgetragen
    cloud.state.rows = [];
    await repo.listForCurrentUser();

    cloud.state.list = { tournaments: [], ownIds: new Set(), memberships: 'unknown', membershipError: new Error('nicht erreichbar') };
    expect(await repo.listForCurrentUser()).toEqual([]);
  });
});

/** Review CA-3–5 Auflage 1: dieselbe Upload-Sperre auf allen Wegen, die eine lokale Kopie in die Cloud schreiben. */
describe('CA-5 Upload-Sperre nach dem Austragen: syncTournament und resolveConflict(local)', () => {
  async function removedDevice() {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    cloud.state.list = known([]); // Betreiber trägt Maria aus
    cloud.state.rows = []; // die Lese-Regel lässt das private Turnier nicht mehr durch
    return { cloud, repo };
  }

  it('@HE-087 syncTournament (Tippen auf den Sync-Status, Realtime-Anstoß) lädt die ausgetragene Kopie nicht hoch', async () => {
    const { cloud, repo } = await removedDevice();
    await repo.syncTournament('nikolaus');
    expect(cloud.fake.save).not.toHaveBeenCalled();
  });

  it('@HE-087 resolveConflict(local) lädt die ausgetragene Kopie nicht hoch und meldet es', async () => {
    const { cloud, repo } = await removedDevice();
    const result = await repo.resolveConflict('nikolaus', 'local');
    expect(cloud.fake.save).not.toHaveBeenCalled();
    expect(result.status).toBe('error');
  });

  it('@HE-087 ausgetragen aus einem öffentlichen Turnier (die Cloud liefert es noch): Gedächtnis sperrt den Upload trotzdem', async () => {
    const cloud = fakeCloud(known([asMember(NIKOLAUS, 'co-admin')]));
    const repo = deviceOf(MARIA, cloud);
    await repo.get('nikolaus');
    cloud.state.list = known([]);
    await repo.listForCurrentUser(); // Gedächtnis: ausgetragen
    cloud.state.rows = [{ ...NIKOLAUS, isPublic: true, updatedAt: '2000-01-01T00:00:00.000Z' }]; // lokale Kopie wirkt neuer

    await repo.syncTournament('nikolaus');
    await repo.resolveConflict('nikolaus', 'local');
    expect(cloud.fake.save).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: ein eigenes, nie hochgeladenes Turnier lädt syncTournament weiter hoch', async () => {
    const cloud = fakeCloud(known([]));
    cloud.state.rows = [];
    stores.raw.set('tournaments', [turnier('eigen', 'Marias Probe', { ownerId: MARIA, changeRevision: undefined, version: 1 })]);
    const repo = deviceOf(MARIA, cloud);

    await repo.syncTournament('eigen');
    expect(cloud.fake.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'eigen' }));
  });

  it('Gegenbeispiel: resolveConflict(local) lädt das eigene, nie hochgeladene Turnier hoch', async () => {
    const cloud = fakeCloud(known([]));
    cloud.state.rows = [];
    stores.raw.set('tournaments', [turnier('eigen', 'Marias Probe', { ownerId: MARIA, changeRevision: undefined, version: 1 })]);
    const repo = deviceOf(MARIA, cloud);

    expect((await repo.resolveConflict('eigen', 'local')).status).toBe('synced');
    expect(cloud.fake.save).toHaveBeenCalledWith(expect.objectContaining({ id: 'eigen' }));
  });
});
