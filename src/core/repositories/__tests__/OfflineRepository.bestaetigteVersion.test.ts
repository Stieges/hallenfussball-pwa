/**
 * Befund C-VERSION-MEHRDEUTIG (@FU-106, Regel „nichts still überschreiben“, @FU-002;
 * `plattform/2026-09-24_fundament-gemeinsamer-stand.md`): Voll-Speichern und Metadaten-Speichern prüfen am Server gegen die
 * zuletzt vom Server bestätigte Version der Kopie – nie gegen die lokal gestempelte („Nutzlast + 1“) und nie gegen die
 * gerade gelesene Cloud-Version (`syncTournamentDelta`). Gegenbeispiele: normales Speichern auf einem Gerät (auch ohne Netz
 * mit späterem Hochladen) und Speichern auf dem bestätigten Stand kommen an.
 *
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Speicher, Fake-Cloud mit CAS wie der Server (auch für
 * Metadaten, `writesMetadata`). Ollis Änderungen laufen direkt gegen die Fake-Cloud. Aufbau wie
 * `OfflineRepository.uploadWegeRegelQ.test.ts`.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import type { StandingDecision } from '../../../types/tournament';
import { OptimisticLockError } from '../../errors';

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
import { flush, liveCup } from '../../../test/queueGuardFixtures';

const MARIA = 'maria';
const OLLI = 'olli';
const SPAETER = '2026-10-15T09:00:00.000Z'; // nach dem `updatedAt` des Live-Cups (lokale Änderung ist jünger)

const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1]]);

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}

describe('Befund C-VERSION-MEHRDEUTIG: geprüft wird gegen die zuletzt vom Server bestätigte Version', () => {
  const repos: OfflineRepository[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = MARIA;
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    for (const r of repos.splice(0)) { r.mutationQueue.dispose(); }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function device(account: string, cloud: ReturnType<typeof createFakeCloud>): OfflineRepository {
    const r = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, account);
    repos.push(r);
    return r;
  }

  async function olliSpeichert(cloud: ReturnType<typeof createFakeCloud>, change: Partial<Tournament>): Promise<void> {
    const current = (await cloud.fake.get('T'))!;
    await cloud.fake.save({ ...current, ...change });
  }

  /**
   * Marias Kopie beruht auf Version 7 und trägt eine eigene, nicht (mehr) wartende Änderung (z. B. Warteschlange wegen
   * gesperrten Browser-Speichers verloren); Olli hat inzwischen Version 8 gespeichert. App-Start/Wiederverbinden → syncUp.
   */
  async function eigeneAenderungAufVersion7(change: (t: Tournament) => Partial<Tournament>) {
    stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: MARIA }]);
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() }, { writesMetadata: true });
    const maria = device(MARIA, cloud);
    await maria.get('T', { fresh: true });
    expect(stored()).toMatchObject({ version: 7, serverVersion: 7 }); // vom Server bestätigt
    const kopie = stored();
    stores.raw.set('tournaments', [{ ...kopie, ...change(kopie), version: 8, updatedAt: SPAETER }]); // lokal gestempelt
    await olliSpeichert(cloud, { title: 'Ollis Titel' }); // Cloud v8: gleiche Zahl, anderer Inhalt
    return { cloud, maria };
  }

  describe('@FU-106 syncTournamentDelta nimmt nie die gelesene Cloud-Version als Basis', () => {
    it('@FU-106 Wiederverbinden (syncUp): Marias Titel aus Stand 7 überschreibt Ollis Stand 8 nicht (Metadaten-Weg)', async () => {
      const { cloud, maria } = await eigeneAenderungAufVersion7(() => ({ title: 'Marias Titel' }));

      await maria.syncUp();
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(stored()).toMatchObject({ title: 'Marias Titel', serverVersion: 7 }); // nichts als bestätigt vermerkt
    });

    it('@FU-106 Wiederverbinden (syncUp): ein umbenanntes Team aus Stand 7 überschreibt Ollis Stand 8 nicht (Voll-Speichern)', async () => {
      const { cloud, maria } = await eigeneAenderungAufVersion7((t) => ({ teams: t.teams.map((team, i) => (i === 0 ? { ...team, name: 'FC Nord II' } : team)) }));
      const savesVorher = cloud.fake.save.mock.calls.length;

      await maria.syncUp();
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher + 1);
      await expect(cloud.fake.save.mock.results[savesVorher].value).rejects.toBeInstanceOf(OptimisticLockError);
    });

    it('Gegenbeispiel: beruht die Kopie auf dem aktuellen Server-Stand, lädt syncUp die eigene Änderung hoch und vermerkt die neue Version als bestätigt', async () => {
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: MARIA }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() }, { writesMetadata: true });
      const maria = device(MARIA, cloud);
      await maria.get('T', { fresh: true });
      stores.raw.set('tournaments', [{ ...stored(), title: 'Marias Titel', version: 8, updatedAt: SPAETER }]);

      await maria.syncUp();
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Marias Titel', version: 8 });
      expect(stored()).toMatchObject({ title: 'Marias Titel', version: 8, serverVersion: 8 });
    });
  });

  describe('@FU-106 Sync-Knopf (syncTournament) schiebt nichts an der Warteschlange vorbei (review-ca67 H2)', () => {
    it('@FU-106 ein ohne Netz gespeicherter, noch wartender Titel geht beim Antippen nicht an der Warteschlange vorbei zur Cloud', async () => {
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: MARIA }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      const maria = device(MARIA, cloud);
      const gelesen = (await maria.get('T', { fresh: true }))!;
      net.online = false;
      await maria.save({ ...gelesen, title: 'Marias Titel' }); // wartet
      await olliSpeichert(cloud, { title: 'Ollis Titel' }); // Cloud v8
      const savesVorher = cloud.fake.save.mock.calls.length;

      await maria.syncTournament('T');

      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(maria.mutationQueue.getPendingCount()).toBe(1); // sichtbar, die Warteschlange entscheidet
    });
  });

  describe('Gegenbeispiele: normales Speichern kommt an', () => {
    it('ohne Netz zweimal gespeichert (das zweite Mal aus der lokalen Kopie), später hochgeladen: beide Änderungen kommen an, nichts gestört', async () => {
      session.userId = OLLI;
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: OLLI }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      const olli = device(OLLI, cloud);
      const gelesen = (await olli.get('T', { fresh: true }))!;

      net.online = false;
      await olli.save({ ...gelesen, title: 'Hallen-Cup Ost' });
      const ausDerKopie = stored(); // Ansicht lädt neu aus der lokalen Kopie (gestempelt 8)
      await olli.save({ ...ausDerKopie, location: { ...ausDerKopie.location, name: 'Halle Süd' } });
      net.online = true;
      await olli.mutationQueue.process();
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Hallen-Cup Ost', location: { name: 'Halle Süd' }, version: 8 });
      expect(stored()).toMatchObject({ version: 8, serverVersion: 8 });
      expect(olli.mutationQueue.getFailedCount()).toBe(0);
      expect(olli.mutationQueue.getPendingCount()).toBe(0);
    });

    it('online nacheinander gespeichert, jeweils aus dem neu geladenen Stand: jede Änderung landet, lokale und Cloud-Version gleich', async () => {
      session.userId = OLLI;
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: OLLI }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      const olli = device(OLLI, cloud);

      for (let runde = 1; runde <= 3; runde++) {
        const ansicht = (await olli.get('T', { fresh: true }))!;
        await olli.save({ ...ansicht, title: `Runde ${runde}` });
        await flush();
        expect(await cloud.fake.get('T')).toMatchObject({ title: `Runde ${runde}`, version: 7 + runde });
        expect(stored()).toMatchObject({ version: 7 + runde, serverVersion: 7 + runde });
      }
      expect(olli.mutationQueue.getFailedCount()).toBe(0);
    });

    it('nach einer Entscheidung in der Tabelle (Server zählt die Version hoch) kommt das nächste Speichern ohne Konflikt an', async () => {
      session.userId = OLLI;
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: OLLI }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      const decisions: StandingDecision[] = [];
      Object.assign(cloud.fake, {
        updateStandingDecisions: vi.fn(async (_id: string, standingDecisions: StandingDecision[], expectedVersion: number) => {
          const current = (await cloud.fake.get('T'))!;
          if ((current.version ?? 0) !== expectedVersion) { throw new OptimisticLockError('T', current.version ?? 0, expectedVersion); }
          cloud.setState({ tournament: { ...current, standingDecisions, version: expectedVersion + 1 }, revisions: revisions() });
        }),
      });
      const olli = device(OLLI, cloud);
      await olli.get('T', { fresh: true });

      await olli.updateStandingDecisions('T', decisions, 7);
      const ansicht = stored();
      await olli.save({ ...ansicht, title: 'Nach der Entscheidung' });
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Nach der Entscheidung', version: 9 });
      expect(olli.mutationQueue.getFailedCount()).toBe(0);
      expect(olli.mutationQueue.getPendingCount()).toBe(0);
    });
  });
});
