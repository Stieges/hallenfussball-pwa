/**
 * CA-6 (Plan `plan-coadmin-einsatzfaehig.md` § 4 „CA-6“, Plan-Review Auflage 12; Befund C-LOKALVERSION-DRIFT):
 * Nachweis am GERÄT DER CO-ADMIN. Die vorhandenen Tests (`OfflineRepository.versionFollowsCloud.test.ts`,
 * `…changeRevision.tm027.test.ts`) prüfen das Gerät des Eigentümers; hier hält Maria (Mitglied, `ownerId` = ihr Konto,
 * so legt `owned()` die Kopie ab) die Kopie eines Turniers von Olli.
 *
 * Gegenrichtung zu @FU-089 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`), Szenario @FU-105: „Marias Tablet bleibt über viele
 * Änderungen von Olli auf dem Stand des Servers“ (Plan NEU-CA6).
 * @FU-002 / @FU-004: nichts geht still verloren; ein Eintrag, der nicht übertragen werden kann, bleibt sichtbar und
 * auf dem Gerät erhalten, bis er übertragen oder geklärt ist (Regel Q, `cloudQueueGuard.ts`).
 *
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Speicher, Fake-Cloud mit CAS wie der Server.
 * Ollis Änderungen laufen direkt gegen die Fake-Cloud (`save` mit Versionsprüfung bzw. `updateMatches` mit
 * Änderungszählung); Marias Gerät ist das einzige mit lokalem Speicher.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
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
import { createMockMatch } from '../../../test/factories';
import { flush, liveCup as liveCupBase } from '../../../test/queueGuardFixtures';

const MARIA = 'maria';
const GRETA = 'greta';
const FAILURE_HOLD_MS = 31_000; // feste 30-s-Sperre nach einem echten Fehler (GenericMutationQueue)

const kickoffAt = (minutes: number): Date => new Date(Date.UTC(1970, 0, 1, 14, minutes));

/** Live-Cup von Olli mit einem zusätzlichen Spiel 5 (Anstoßzeit 14:30), damit eine Spielplan-Änderung möglich ist. */
function liveCup(version: number, extra: { title?: string; changeRevision?: number } = {}): Tournament {
  const base = { ...liveCupBase(version, { title: extra.title, plus: [createMockMatch({ id: 'spiel-5', matchStatus: 'scheduled', scheduledTime: kickoffAt(30) })] }), sportId: 'football-indoor' as const };
  return extra.changeRevision === undefined ? base : { ...base, changeRevision: extra.changeRevision };
}

const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1], ['spiel-5', 1]]);

/** Marias lokale Kopie: so legt `owned()` sie ab (Konto-Marker = Marias Konto, nicht der Eigentümer). */
const mariasKopie = (version: number): Tournament => ({ ...liveCup(version), ownerId: MARIA });

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}
const kickoffOf = (t: Tournament, id: string): string => new Date(t.matches.find((m) => m.id === id)?.scheduledTime ?? 0).toISOString();

describe('@FU-105 CA-6 Marias Gerät (Mitglied) bleibt über viele Änderungen von Olli auf dem Stand der Cloud (Gegenrichtung zu @FU-089)', () => {
  let repo: OfflineRepository | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = MARIA;
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
    stores.raw.set('tournaments', [mariasKopie(7)]);
  });

  afterEach(() => {
    repo?.mutationQueue.dispose();
    repo = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setup(options: { countsChangeRevision?: boolean; cloudTournament?: Tournament } = {}) {
    const cloud = createFakeCloud(
      { tournament: options.cloudTournament ?? liveCup(7), revisions: revisions() },
      { countsChangeRevision: options.countsChangeRevision },
    );
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, MARIA);
    return { cloud, repo };
  }

  /** Olli speichert das ganze Turnier (Voll-Speichern mit Versionsprüfung wie der Server: Cloud-Version + 1). */
  async function olliSaves(cloud: ReturnType<typeof setup>['cloud'], change: Partial<Tournament>): Promise<void> {
    const current = (await cloud.fake.get('T'))!;
    await cloud.fake.save({ ...current, ...change });
  }

  const cloudNow = async (cloud: ReturnType<typeof setup>['cloud']): Promise<Tournament> => (await cloud.fake.get('T'))!;

  /**
   * Sichtbarer Konflikt: seit BP-1 (@FU-126, Befund C-ENDGUELTIG-SOFORT-MELDEN) beim ersten Versuch „nicht übernommen“ mit dem
   * Grund Konflikt (Dead-Letter, Merkmal `conflict`), ohne Wiederholung; die letzte Störung ist „permanent“, nichts im Gerät verworfen.
   */
  function expectConflictVisible(r: OfflineRepository): void {
    expect(r.mutationQueue.getPendingCount()).toBe(0);
    expect(r.mutationQueue.getFailedMutations().map((f) => f.conflict)).toEqual([true]);
    expect(r.mutationQueue.getLastFailure()).toBe('permanent');
  }

  describe('Version und Inhalt folgen der Cloud', () => {
    it('@FU-089 12 Abrufe: Olli speichert jedes Mal, Marias lokale Version ist jedes Mal gleich der Cloud-Version, Inhalt gleich', async () => {
      const { cloud, repo: maria } = setup();

      for (let i = 1; i <= 12; i++) {
        await olliSaves(cloud, { title: `Live-Cup ${i}` });
        const shown = await maria.get('T', { fresh: true });

        const cloudVersion = (await cloudNow(cloud)).version;
        expect(cloudVersion).toBe(7 + i);
        expect(stored().version).toBe(cloudVersion);
        expect(stored().title).toBe(`Live-Cup ${i}`);
        expect(shown?.title).toBe(`Live-Cup ${i}`);
        expect(stored().ownerId).toBe(MARIA); // die Kopie bleibt Marias Kopie
      }
      expect(maria.mutationQueue.getFailedCount()).toBe(0);
    });

    it('Gegenbeispiel zur alten Logik „+1 je Abruf“: nach 3 Abrufen liegt Marias Version nicht über der Cloud', async () => {
      const { cloud, repo: maria } = setup();

      for (let i = 1; i <= 3; i++) {
        await olliSaves(cloud, { title: `Live-Cup ${i}` });
        await maria.get('T', { fresh: true });
      }

      expect(stored().version).toBe(10);
      expect(stored().version).not.toBeGreaterThan((await cloudNow(cloud)).version ?? 0);
    });

    it('@FU-089 12 Spielplan-Änderungen ohne Versionszählung (nur Änderungszählung): Marias Gerät zeigt jede Anstoßzeit, die Version bleibt die der Cloud', async () => {
      const { cloud, repo: maria } = setup({ countsChangeRevision: true });

      for (let i = 1; i <= 12; i++) {
        await cloud.fake.updateMatches('T', [{ id: 'spiel-5', scheduledTime: kickoffAt(30 + i) }]);
        const shown = await maria.get('T', { fresh: true });

        const cloudState = await cloudNow(cloud);
        expect(cloudState.changeRevision).toBe(i);
        expect(cloudState.version).toBe(7); // der Server zählt die Version dort nicht
        expect(kickoffOf(shown!, 'spiel-5')).toBe(kickoffAt(30 + i).toISOString());
        expect(kickoffOf(stored(), 'spiel-5')).toBe(kickoffAt(30 + i).toISOString());
        expect(stored()).toMatchObject({ version: 7, changeRevision: i });
      }
    });
  });

  describe('Maria speichert selbst', () => {
    it('Olli speichert, Maria holt, Maria speichert und die Warteschlange sendet (4 Runden): kein OptimisticLockError, Dead-Letter leer, lokale Version = Cloud-Version', async () => {
      const { cloud, repo: maria } = setup();

      for (let runde = 1; runde <= 4; runde++) {
        await olliSaves(cloud, { title: `Olli ${runde}` });
        const shown = await maria.get('T', { fresh: true });
        expect(shown?.title).toBe(`Olli ${runde}`);

        await maria.save({ ...shown!, title: `Maria ${runde}` });
        await flush();

        const cloudState = await cloudNow(cloud);
        expect(cloudState.title).toBe(`Maria ${runde}`);
        expect(stored().version).toBe(cloudState.version);
        expect(stored().title).toBe(`Maria ${runde}`);
        expect(maria.mutationQueue.getFailedCount()).toBe(0);
        expect(maria.mutationQueue.getPendingCount()).toBe(0);
      }

      expect(cloud.fake.save.mock.calls.length).toBe(4 + 4); // 4× Olli (direkt) + 4× Maria (Warteschlange)
      for (const result of cloud.fake.save.mock.results) { await expect(result.value).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */; }
    });

    it('Gegenbeispiel: speichert Maria aus einem veralteten Stand (Olli war dazwischen), meldet das Gerät den Konflikt statt still zu überschreiben', async () => {
      const { cloud, repo: maria } = setup();
      const veraltet = (await maria.get('T', { fresh: true }))!;
      await olliSaves(cloud, { title: 'Ollis Titel' });

      await maria.save({ ...veraltet, title: 'Marias Titel' });
      await flush();

      expect((await cloudNow(cloud)).title).toBe('Ollis Titel');
      expect(cloud.fake.save).toHaveBeenCalledTimes(2); // Olli + Marias abgelehnter Versuch
      await expect(cloud.fake.save.mock.results[1].value).rejects.toThrow(/Optimistic lock/);
      expectConflictVisible(maria);
    });
  });

  describe('Wettlauf: Olli speichert zwischen Marias Lesen und Senden (Regel Q, @FU-002, @FU-004)', () => {
    /** Wettlauf bis in den Dead-Letter: Maria liest (v7), Olli speichert (v8, „Ollis Titel“), Maria speichert „Marias Titel“ aus v7. */
    async function wettlaufBisDeadLetter(): Promise<{ cloud: ReturnType<typeof setup>['cloud']; maria: OfflineRepository }> {
      const { cloud, repo: maria } = setup();
      const gelesen = (await maria.get('T', { fresh: true }))!;
      await olliSaves(cloud, { title: 'Ollis Titel' }); // Cloud v8

      await maria.save({ ...gelesen, title: 'Marias Titel' }); // lokal v8, Eintrag trägt v7
      await flush();
      // 1. kein stilles Überschreiben von Ollis Änderung
      expect(await cloudNow(cloud)).toMatchObject({ title: 'Ollis Titel', version: 8 });
      // 2. der Konflikt ist sichtbar (@FU-126: Eintrag sofort „nicht übernommen“ im Dead-Letter, Störung „permanent“)
      expectConflictVisible(maria);
      // 3. der nächste Abruf überschreibt Marias abgelegte Änderung nicht (Regel Q)
      await maria.get('T', { fresh: true });
      expect(stored().title).toBe('Marias Titel');

      // 4. @FU-126: der Eintrag liegt ohne Wiederholung im Dead-Letter (@FU-004: „Übertragung gestört“) und schützt die Kopie weiter
      await vi.advanceTimersByTimeAsync(FAILURE_HOLD_MS * MAX_RETRIES);
      await flush();
      expect(cloud.fake.save).toHaveBeenCalledTimes(2); // Olli + Marias einziger Versuch
      expect(maria.mutationQueue.getFailedCount()).toBe(1);
      expect(maria.mutationQueue.getPendingCount()).toBe(0);
      await maria.get('T', { fresh: true });
      expect(stored().title).toBe('Marias Titel');
      expect(await cloudNow(cloud)).toMatchObject({ title: 'Ollis Titel', version: 8 });
      return { cloud, maria };
    }

    it('Ollis Änderung wird nicht überschrieben, Marias Eintrag bleibt sichtbar erhalten und schützt die Kopie, bis er geklärt ist', async () => {
      await wettlaufBisDeadLetter();
    });

    it('geklärt über „Cloud übernehmen“ (Verwerfen + resolveConflict remote): Marias Gerät zeigt danach Ollis Stand mit der Cloud-Version', async () => {
      const { maria } = await wettlaufBisDeadLetter();
      const [eintrag] = maria.mutationQueue.getFailedMutations();
      expect(maria.mutationQueue.clearFailedMutation(eintrag.id)).toBe(true);

      const result = await maria.resolveConflict('T', 'remote');

      expect(result.status).toBe('updated');
      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8, ownerId: MARIA });
    });

    /**
     * @FU-106 (Befund C-VERWERFEN-BEHAELT-VERALTETEN-STAND, CA-6): Verwirft Maria den wegen des Konflikts gescheiterten Eintrag
     * (Schalter „Verwerfen“ in `SyncStatusIndicator` → `clearFailedMutation`), stand ihr Titel vor dem Fix lokal weiter auf
     * Version 8 gleich Cloud-Version 8, aber mit ANDEREM Inhalt als Ollis Stand. Soll: Inhalt und Version der Cloud.
     * Weitere Wege (Abgleich über die Anzeige, Neustart, Gegenbeispiele): `OfflineRepository.verwerfenNachKonflikt.test.ts`.
     */
    it('@FU-106 Verwerfen nach dem Konflikt: der nächste Abruf zeigt Ollis Stand mit der Cloud-Version, nichts bleibt gestört, Ollis Änderung bleibt', async () => {
      const { cloud, maria } = await wettlaufBisDeadLetter();
      const savesVorher = cloud.fake.save.mock.calls.length;
      const [eintrag] = maria.mutationQueue.getFailedMutations();
      expect(maria.mutationQueue.clearFailedMutation(eintrag.id)).toBe(true);

      const shown = await maria.get('T', { fresh: true });

      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8, ownerId: MARIA });
      expect(shown?.title).toBe('Ollis Titel');
      expect(maria.mutationQueue.getFailedCount()).toBe(0);
      expect(maria.mutationQueue.getPendingCount()).toBe(0);
      expect(await cloudNow(cloud)).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher); // nach dem Verwerfen kein Upload mehr
    });

    it('Gleichstand lokal N+1 gegen Cloud N+1: Marias Gerät ohne Netz speichert, Olli speichert, Netz kommt zurück → Ollis Änderung bleibt, Marias Eintrag wird sichtbar abgelehnt', async () => {
      const { cloud, repo: maria } = setup();
      const gelesen = (await maria.get('T', { fresh: true }))!;

      net.online = false;
      await maria.save({ ...gelesen, title: 'Marias Titel' }); // lokal v8
      await flush();
      expect(maria.mutationQueue.getPendingCount()).toBe(1);
      await olliSaves(cloud, { title: 'Ollis Titel' }); // Cloud v8: gleiche Zahl, anderer Inhalt
      expect(stored().version).toBe((await cloudNow(cloud)).version);

      net.online = true;
      await maria.get('T', { fresh: true }); // Abruf kommt vor dem Senden
      expect(stored().title).toBe('Marias Titel'); // wartende Änderung nicht überschrieben (Regel Q)
      await maria.mutationQueue.process();
      await flush();

      expect(await cloudNow(cloud)).toMatchObject({ title: 'Ollis Titel', version: 8 }); // Ollis Änderung bleibt
      expectConflictVisible(maria); // Marias Änderung ist nicht unbemerkt verloren
    });

    it('Gegenbeispiel: ohne Konflikt (Olli war nicht dazwischen) landet Marias Änderung und nichts bleibt hängen', async () => {
      const { cloud, repo: maria } = setup();
      const gelesen = (await maria.get('T', { fresh: true }))!;

      await maria.save({ ...gelesen, title: 'Marias Titel' });
      await flush();

      expect(await cloudNow(cloud)).toMatchObject({ title: 'Marias Titel', version: 8 });
      expect(stored().version).toBe(8);
      expect(maria.mutationQueue.getPendingCount()).toBe(0);
      expect(maria.mutationQueue.getFailedCount()).toBe(0);
    });
  });

  describe('Kopie unter dem Konto des Mitglieds (mayCache)', () => {
    it('erster Abruf auf einem frischen Gerät: die Cloud-Kopie wird übernommen, trägt Marias Konto-Marker und die Cloud-Version', async () => {
      stores.raw.clear();
      const { repo: maria } = setup({ cloudTournament: liveCup(9, { title: 'Live-Cup' }) });

      await maria.get('T');

      expect(stored()).toMatchObject({ title: 'Live-Cup', version: 9, ownerId: MARIA });
    });

    it('vorhandene Kopie unter Marias Konto wird übernommen, wenn die Cloud neuer ist', async () => {
      const { repo: maria } = setup({ cloudTournament: liveCup(9, { title: 'Hallen-Cup' }) });

      await maria.get('T', { fresh: true });

      expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 9, ownerId: MARIA });
    });

    it('Gegenbeispiel (N-2): eine Kopie unter einem anderen Konto auf demselben Gerät bleibt unangetastet', async () => {
      stores.raw.set('tournaments', [{ ...liveCup(5, { title: 'Gretas Kopie' }), ownerId: GRETA }]);
      const { repo: maria } = setup({ cloudTournament: liveCup(9, { title: 'Hallen-Cup' }) });

      await maria.get('T', { fresh: true });
      await maria.get('T');

      expect(stored()).toMatchObject({ title: 'Gretas Kopie', version: 5, ownerId: GRETA });
    });
  });
});
