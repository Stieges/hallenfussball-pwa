/**
 * @FU-110 „Zwei Änderungen kurz nacheinander am selben Gerät kommen beide an“ (Gegenbeispiel zu @FU-108,
 * `plattform/2026-09-24_fundament-gemeinsamer-stand.md`), Befunde C-ZWEITES-SPEICHERN-EIGENE-VORVERSION und
 * C-VERSION-NACH-ERSTANLAGE; Schutz „nichts still überschreiben“ (@FU-106, C-VERSION-MEHRDEUTIG) als Gegenbeispiele.
 *
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Speicher, Fake-Cloud mit CAS wie der Server.
 * Ein festgehaltener Upload (`halteNaechstenUpload`) bildet „die erste Änderung ist noch nicht bestätigt“ nach.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import type { StandingDecision } from '../../../types/tournament';
import type { RecordDecisionRequest, RecordDecisionResult } from '../groupCompletionCloud';
import { MAX_RETRIES } from '../../services/MutationQueue';

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

const OLLI = 'olli';
const MARIA = 'maria';
const FAILURE_HOLD_MS = 31_000;
const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1]]);

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}

type Cloud = ReturnType<typeof createFakeCloud>;

/** Der nächste Upload bleibt hängen, bis `release()` gerufen wird (Antwort des Servers steht aus). */
function halteNaechstenUpload(cloud: Cloud): { release: () => void } {
  const save = cloud.fake.save.getMockImplementation()!;
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  cloud.fake.save.mockImplementationOnce(async (t: Tournament) => { await gate; return save(t); });
  return { release: () => release() };
}

describe('@FU-110 Zwei Änderungen kurz nacheinander am selben Gerät kommen beide an', () => {
  const repos: OfflineRepository[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = OLLI;
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    for (const r of repos.splice(0)) { r.mutationQueue.dispose(); }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function device(account: string, cloud: Cloud): OfflineRepository {
    const r = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, account);
    repos.push(r);
    return r;
  }

  async function olliMitLiveCup() {
    stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: OLLI }]);
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
    const olli = device(OLLI, cloud);
    const geoeffnet = (await olli.get('T', { fresh: true }))!;
    return { cloud, olli, geoeffnet };
  }

  async function wiederholungenDurch(): Promise<void> {
    await flush();
    for (let v = 0; v < MAX_RETRIES; v++) { await vi.advanceTimersByTimeAsync(FAILURE_HOLD_MS); await flush(); }
  }

  function keineStoerung(r: OfflineRepository): void {
    expect(r.mutationQueue.getFailedCount()).toBe(0);
    expect(r.mutationQueue.getPendingCount()).toBe(0);
  }

  describe('Befund C-ZWEITES-SPEICHERN-EIGENE-VORVERSION', () => {
    it('@FU-110 zweite Änderung aus dem Zustand der Ansicht (gleiche Version), bevor die erste bestätigt ist: beide kommen an, nichts gestört', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const upload = halteNaechstenUpload(cloud);

      const ansicht = { ...geoeffnet, title: 'Live-Cup Ost' };
      await olli.save(ansicht); // Upload läuft
      await flush();
      await olli.save({ ...ansicht, location: { ...ansicht.location, name: 'Halle 12 Minuten' } }); // handleTournamentUpdate: setTournament(sanitized)
      upload.release();
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Live-Cup Ost', location: { name: 'Halle 12 Minuten' }, version: 9 });
      keineStoerung(olli);
      expect(stored()).toMatchObject({ version: 9, serverVersion: 9 });
    });

    it('@FU-110 zweite Änderung aus der neu geladenen lokalen Kopie, bevor die erste bestätigt ist: beide kommen an', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const upload = halteNaechstenUpload(cloud);

      await olli.save({ ...geoeffnet, title: 'Live-Cup Ost' });
      await flush();
      const kopie = stored();
      await olli.save({ ...kopie, location: { ...kopie.location, name: 'Halle 12 Minuten' } });
      upload.release();
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Live-Cup Ost', location: { name: 'Halle 12 Minuten' }, version: 9 });
      keineStoerung(olli);
    });

    it('@FU-110 der Assistent speichert nach der bestätigten ersten Änderung erneut mit unveränderter Version (Autosave): kommt an, auch beim dritten Mal', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const formular = { ...geoeffnet, title: 'Live-Cup Ost' }; // saveDraft → setFormData(saved): Version bleibt 7

      await olli.save(formular);
      await flush();
      await olli.save({ ...formular, location: { ...formular.location, name: 'Halle Süd' } });
      await flush();
      await olli.save({ ...formular, location: { ...formular.location, name: 'Halle Nord' } });
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Live-Cup Ost', location: { name: 'Halle Nord' }, version: 10 });
      keineStoerung(olli);
    });

    it('Gegenbeispiel: speichert ein anderes Gerät dazwischen, bleibt die zweite Änderung ein sichtbarer Konflikt und die fremde Änderung erhalten', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const ansicht = { ...geoeffnet, title: 'Live-Cup Ost' };
      await olli.save(ansicht);
      await flush();
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Marias Titel' }); // Maria: v9

      await olli.save({ ...ansicht, location: { ...ansicht.location, name: 'Halle Süd' } });
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Marias Titel', version: 9 });
      expect(olli.mutationQueue.getFailedMutations()[0]).toMatchObject({ type: 'SAVE_TOURNAMENT', conflict: true });
    });

    it('Gegenbeispiel: nach einer Übernahme fremder Änderungen gilt die Kette nicht mehr – ein Formular vom Stand davor bleibt ein Konflikt', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const formular = { ...geoeffnet, title: 'Live-Cup Ost' };
      await olli.save(formular);
      await flush(); // v8 bestätigt (eigene Kette)
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Marias Titel' }); // v9
      await olli.get('T', { fresh: true }); // Übernahme von v9
      expect(stored()).toMatchObject({ title: 'Marias Titel', serverVersion: 9 });

      await olli.save({ ...formular, location: { ...formular.location, name: 'Halle Süd' } }); // Formular vom Stand 7
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Marias Titel', version: 9 });
      expect(olli.mutationQueue.getFailedCount()).toBe(1);
    });
  });

  describe('@FU-106 Untergrenze der Kette: ein Stand von vor ihrem Beginn bleibt ein Konflikt (Review Version-Fix R2, Befund C-ZWEITES-SPEICHERN-EIGENE-VORVERSION)', () => {
    async function olliSpeichertTitel(cloud: Cloud): Promise<void> {
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Marias Titel' }); // anderes Gerät
    }

    it('@FU-106 K6: Formular vom Stand 7, Maria speichert 7→8, Übernahme, eigener Upload 8→9 (Kette 8..9), dann das alte Formular → Konflikt, Marias Titel bleibt', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const formular = { ...geoeffnet, date: '2027-01-01' }; // Stand 7, ohne Marias Titel
      await olliSpeichertTitel(cloud); // v8
      const frisch = (await olli.get('T', { fresh: true }))!; // Übernahme v8
      await olli.save({ ...frisch, location: { ...frisch.location, name: 'Halle C' } });
      await flush(); // eigener Upload 8→9
      expect(stored()).toMatchObject({ serverVersion: 9, ownUploadsFrom: 8 });

      await olli.save(formular);
      await wiederholungenDurch();

      const c = await cloud.fake.get('T');
      expect(c).toMatchObject({ title: 'Marias Titel', version: 9 });
      expect(c?.date).not.toBe('2027-01-01');
      expect(olli.mutationQueue.getFailedMutations()[0]).toMatchObject({ type: 'SAVE_TOURNAMENT', conflict: true });
    });

    it('@FU-106 K3: eigener Upload 7→8, Maria 8→9, Übernahme (Kette endet), eigener Upload 9→10, dann Ansicht vom Stand 8 → Konflikt, Marias Titel bleibt', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      await olli.save({ ...geoeffnet, location: { ...geoeffnet.location, name: 'Halle A' } });
      await flush(); // 7→8
      const ansicht8 = stored();
      await olliSpeichertTitel(cloud); // v9
      const frisch = (await olli.get('T', { fresh: true }))!; // Übernahme v9
      await olli.save({ ...frisch, location: { ...frisch.location, name: 'Halle C' } });
      await flush(); // 9→10, Kette 9..10

      await olli.save({ ...ansicht8, date: '2027-01-01' });
      await wiederholungenDurch();

      const c = await cloud.fake.get('T');
      expect(c).toMatchObject({ title: 'Marias Titel', version: 10 });
      expect(c?.date).not.toBe('2027-01-01');
      expect(olli.mutationQueue.getFailedCount()).toBe(1);
    });

    it('@FU-110 Gegenbeispiel MK5: eine Tabellen-Entscheidung beendet die Kette – ein Speichern aus der Ansicht davor nimmt die Entscheidung nicht still zurück', async () => {
      const { cloud, olli, geoeffnet } = await olliMitLiveCup();
      const entscheidung: StandingDecision[] = [{ groupId: 'A', order: ['x', 'y'] } as unknown as StandingDecision];
      Object.assign(cloud.fake, {
        recordStandingDecision: vi.fn(async (_id: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> => {
          const current = (await cloud.fake.get('T'))!;
          if ((current.version ?? 0) !== expectedVersion) { return { status: 'rejected', code: 'STALE', version: current.version ?? 0 }; }
          const standingDecisions = request.action === 'decide' ? [...(current.standingDecisions ?? []), request.decision] : [];
          cloud.setState({ tournament: { ...current, standingDecisions, version: expectedVersion + 1 }, revisions: revisions() });
          return { status: 'ok', alreadyApplied: false, version: expectedVersion + 1 };
        }),
        readBracketLog: vi.fn(async () => undefined),
      });
      const ansicht = { ...geoeffnet, location: { ...geoeffnet.location, name: 'Halle A' } };
      await olli.save(ansicht);
      await flush(); // 7→8, Kette 7..8
      await olli.recordStandingDecision('T', { action: 'decide', decision: entscheidung[0] }, 8); // 8→9

      await olli.save({ ...ansicht, date: '2027-01-01' }); // Ansicht vor der Entscheidung (ohne sie)
      await wiederholungenDurch();

      const c = await cloud.fake.get('T');
      expect(c?.standingDecisions).toEqual(entscheidung);
      expect(c?.date).not.toBe('2027-01-01');
      expect(olli.mutationQueue.getFailedCount()).toBe(1); // sichtbar statt still
    });
  });

  describe('Befund C-VERSION-NACH-ERSTANLAGE', () => {
    /** Cloud ohne das Turnier; das erste `save` legt es mit Version 1 an (wie SupabaseRepository bei fehlender Zeile). */
    function cloudOhneTurnier(): Cloud {
      const cloud = createFakeCloud({ tournament: liveCup(1), revisions: revisions() });
      const read = cloud.fake.getWithMatchRevisions.getMockImplementation()!;
      const save = cloud.fake.save.getMockImplementation()!;
      let vorhanden = false;
      cloud.fake.getWithMatchRevisions.mockImplementation(async (id: string) => (vorhanden ? read(id) : null));
      cloud.fake.get.mockImplementation(async (id: string) => (vorhanden ? (await read(id))?.tournament ?? null : null));
      cloud.fake.save.mockImplementation(async (t: Tournament) => {
        if (vorhanden) { return save(t); }
        vorhanden = true;
        cloud.setState({ tournament: { ...structuredClone(t), version: 1 }, revisions: revisions() });
        return 1;
      });
      return cloud;
    }

    it('@FU-110 ohne Netz angelegt und vor dem ersten Hochladen bearbeitet: danach lässt es sich weiter bearbeiten, alles kommt an', async () => {
      const cloud = cloudOhneTurnier();
      const olli = device(OLLI, cloud);
      net.online = false;
      await olli.save({ ...liveCup(1), version: undefined, changeRevision: undefined, ownerId: OLLI, title: 'Hallen-Cup' });
      const angelegt = stored();
      await olli.save({ ...angelegt, title: 'Hallen-Cup Ost' }); // zusammengefasst
      net.online = true;
      await olli.mutationQueue.process();
      await flush();
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Hallen-Cup Ost', version: 1 });
      expect(stored()).toMatchObject({ version: 1, serverVersion: 1 }); // die vom Server gemeldete Version, nicht „Basis + 1“

      const weiter = stored();
      await olli.save({ ...weiter, location: { ...weiter.location, name: 'Halle Süd' } });
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Hallen-Cup Ost', location: { name: 'Halle Süd' }, version: 2 });
      keineStoerung(olli);
    });

    it('Gegenbeispiel: ändert nach dem ersten Hochladen ein anderes Gerät, scheitert Ollis Stand vom Anlegen sichtbar', async () => {
      const cloud = cloudOhneTurnier();
      const olli = device(OLLI, cloud);
      net.online = false;
      await olli.save({ ...liveCup(1), version: undefined, changeRevision: undefined, ownerId: OLLI, title: 'Hallen-Cup' });
      net.online = true;
      await olli.mutationQueue.process();
      await flush();
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Marias Titel' }); // v2

      const kopie = stored();
      await olli.save({ ...kopie, location: { ...kopie.location, name: 'Halle Süd' } });
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Marias Titel', version: 2 });
      expect(olli.mutationQueue.getFailedMutations()[0]).toMatchObject({ conflict: true });
    });
  });

  describe('Schutz beim Bestätigen (@FU-106, Befund C-VERSION-MEHRDEUTIG)', () => {
    it('@FU-106 ein offenes Formular vom Stand vor Ollis Änderung speichert, während Marias eigener Upload läuft: Ollis Änderung bleibt auch nach weiterem Speichern', async () => {
      session.userId = MARIA;
      stores.raw.set('tournaments', [{ ...liveCup(6), ownerId: MARIA }]);
      const cloud = createFakeCloud({ tournament: liveCup(6), revisions: revisions() });
      const maria = device(MARIA, cloud);
      const formular = (await maria.get('T', { fresh: true }))!; // Stand 6, Titel „Live-Cup“
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Ollis Titel' }); // v7
      const ansicht = (await maria.get('T', { fresh: true }))!; // Übernahme v7
      expect(ansicht.title).toBe('Ollis Titel');
      const upload = halteNaechstenUpload(cloud);

      await maria.save({ ...ansicht, location: { ...ansicht.location, name: 'Halle Süd' } }); // Upload läuft (Basis 7)
      await flush();
      await maria.save({ ...formular, location: { ...formular.location, name: 'Halle Nord' } }); // altes Formular (Basis 6)
      upload.release();
      await wiederholungenDurch();
      const danach = stored(); // Ansicht lädt neu
      await maria.save({ ...danach, location: { ...danach.location, name: 'Halle West' } });
      await wiederholungenDurch();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', location: { name: 'Halle Süd' }, version: 8 });
      expect(maria.mutationQueue.getFailedCount()).toBeGreaterThan(0); // sichtbar, nicht still
    });
  });
});
