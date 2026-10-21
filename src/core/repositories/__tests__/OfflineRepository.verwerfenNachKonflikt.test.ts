/**
 * Fix zu Befund C-VERWERFEN-BEHAELT-VERALTETEN-STAND (Nachweis CA-6), Szenarien @FU-106 und @FU-107
 * (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * „Verwerfen“ einer wegen eines Konflikts abgelehnten Änderung heißt: die eigene, nie hochgeladene Änderung aufgeben. Das Gerät
 * übernimmt danach den Stand der Cloud; bis dahin sendet es aus der verworfenen Kopie nichts (Auflage A1, review-ca67).
 * Restwege über mehrdeutige Versionen (zweite Speicherung während der Wiederholungen, offenes Formular mit altem Stand):
 * Befund C-VERSION-MEHRDEUTIG, `OfflineRepository.uploadWegeRegelQ.test.ts`.
 * Entscheidung Daniel 20.10. (review-ca67 Produktfrage 3): „Verwerfen“ heißt immer „das Gerät nimmt den Stand des Servers“,
 * auch ohne Konflikt (Probe NOCONF-D). Gegenbeispiele: ein Turnier, das nie beim Server war, bleibt auf dem Gerät (@FU-107);
 * ist der Server nicht erreichbar, wird nichts gelöscht und das Gerät meldet, dass der Stand des Servers noch geladen wird.
 *
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Speicher, Fake-Cloud mit CAS wie der Server (Aufbau wie
 * `OfflineRepository.mitgliedKopie.test.ts`). Ollis Änderungen laufen direkt gegen die Fake-Cloud.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';
import { MAX_RETRIES } from '../../services/MutationQueue';
import { CloudReadAbortedError, RepositoryError, TeamStillReferencedError } from '../../errors';

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
const OLLI = 'olli';
const FAILURE_HOLD_MS = 31_000; // feste 30-s-Sperre nach einem echten Fehler (GenericMutationQueue)
const kickoffAt = (minutes: number): Date => new Date(Date.UTC(1970, 0, 1, 14, minutes));

function liveCup(version: number, extra: { title?: string; id?: string } = {}): Tournament {
  const base = liveCupBase(version, { title: extra.title, plus: [createMockMatch({ id: 'spiel-5', matchStatus: 'scheduled', scheduledTime: kickoffAt(30) })] });
  return { ...base, id: extra.id ?? base.id, sportId: 'football-indoor' as const };
}
const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1], ['spiel-5', 1]]);

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}
const kickoffOf = (t: Tournament, id: string): string => new Date(t.matches.find((m) => m.id === id)?.scheduledTime ?? 0).toISOString();

describe('Verwerfen einer abgelehnten Änderung nach einem Konflikt', () => {
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

  /** Bis zum MAX_RETRIES-ten Fehlversuch: der Eintrag liegt danach im Dead-Letter („Übertragung gestört“). */
  async function bisDeadLetter(r: OfflineRepository): Promise<void> {
    await flush();
    for (let versuch = 1; versuch < MAX_RETRIES; versuch++) {
      await vi.advanceTimersByTimeAsync(FAILURE_HOLD_MS);
      await flush();
    }
    expect(r.mutationQueue.getFailedCount()).toBe(1);
    expect(r.mutationQueue.getPendingCount()).toBe(0);
  }

  /** Wettlauf am Gerät der Co-Admin: Maria liest v7, Olli speichert „Ollis Titel“ (v8), Maria speichert „Marias Titel“ aus v7. */
  async function wettlauf() {
    stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: MARIA }]);
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
    const maria = device(MARIA, cloud);
    const gelesen = (await maria.get('T', { fresh: true }))!;
    const current = (await cloud.fake.get('T'))!;
    await cloud.fake.save({ ...current, title: 'Ollis Titel' }); // Olli, Cloud v8
    await maria.save({ ...gelesen, title: 'Marias Titel' }); // lokal v8, Eintrag trägt v7
    await bisDeadLetter(maria);
    expect(stored()).toMatchObject({ title: 'Marias Titel', version: 8 });
    return { cloud, maria, savesVorher: cloud.fake.save.mock.calls.length };
  }

  const verwerfen = (r: OfflineRepository): void => {
    const [eintrag] = r.mutationQueue.getFailedMutations();
    expect(r.mutationQueue.clearFailedMutation(eintrag.id)).toBe(true);
  };

  describe('@FU-106 am Gerät der Co-Admin nach einem Konflikt', () => {
    it('@FU-106 Verwerfen allein genügt: ohne weiteres Zutun zeigt Marias Gerät kurz danach Ollis Stand mit der Cloud-Version', async () => {
      const { cloud, maria, savesVorher } = await wettlauf();

      verwerfen(maria);
      await flush();

      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8, ownerId: MARIA });
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(maria.mutationQueue.needsCloudCopy('T')).toBe(false); // nach der Übernahme bleibt nichts gemerkt
    });

    it('@FU-106 der Abruf nach dem Verwerfen scheitert, dann tippt Maria auf die Übertragungs-Anzeige: der verworfene Titel kommt nicht beim Server an, ihr Gerät zeigt Ollis Stand', async () => {
      const { cloud, maria, savesVorher } = await wettlauf();
      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('Failed to fetch'));

      verwerfen(maria);
      await flush();
      expect(stored()).toMatchObject({ title: 'Marias Titel' }); // Übernahme noch nicht gelungen
      await maria.syncTournament('T'); // Antippen der Anzeige, sobald nichts mehr gestört ist und nichts wartet

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8 });
    });

    it('@FU-106 solange eine andere eigene Änderung wartet (Regel Q hält die Übernahme auf), lädt kein Abgleich den verworfenen Titel hoch; danach kommt Ollis Stand mit Marias späterer Änderung', async () => {
      const { cloud, maria, savesVorher } = await wettlauf();
      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('Failed to fetch'));
      verwerfen(maria);
      await flush();

      net.online = false;
      await maria.updateMatches('T', [{ id: 'spiel-5', scheduledTime: kickoffAt(40) }]);
      expect(maria.mutationQueue.getPendingCount()).toBe(1);
      await maria.syncTournament('T');

      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });

      net.online = true;
      await maria.mutationQueue.process();
      await flush();
      await maria.get('T', { fresh: true });

      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(kickoffOf(stored(), 'spiel-5')).toBe(kickoffAt(40).toISOString());
      expect(maria.mutationQueue.getPendingCount()).toBe(0);
      expect(maria.mutationQueue.getFailedCount()).toBe(0);
    });

    it('@FU-106 App wird vor dem nächsten Abruf neu gestartet: das Gerät übernimmt Ollis Stand trotzdem', async () => {
      const { cloud, maria } = await wettlauf();
      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('Failed to fetch'));
      verwerfen(maria);
      await flush();
      expect(stored()).toMatchObject({ title: 'Marias Titel' }); // Übernahme vor dem Neustart nicht gelungen
      maria.mutationQueue.dispose();

      const nachNeustart = device(MARIA, cloud);
      await nachNeustart.get('T', { fresh: true });

      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8, ownerId: MARIA });
    });
  });

  describe('@FU-106 Auflage A1 (review-ca67): aus einer verworfenen Kopie geht nichts zum Server', () => {
    it('@FU-106 RACE-A: Abruf nach dem Verwerfen scheitert, Maria speichert danach den Ort → Ollis Titel bleibt in der Cloud, ihr Eintrag liegt sichtbar im Dead-Letter (eigener Grund @FU-109)', async () => {
      const { cloud, maria, savesVorher } = await wettlauf();
      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('Failed to fetch'));
      verwerfen(maria);
      await flush();
      expect(stored()).toMatchObject({ title: 'Marias Titel' }); // Übernahme noch nicht gelungen
      const ui = stored();

      await maria.save({ ...ui, location: { ...ui.location, name: 'Halle Süd' } });
      await flush();
      await vi.advanceTimersByTimeAsync(FAILURE_HOLD_MS);
      await flush();
      await maria.get('T', { fresh: true });

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(maria.mutationQueue.getFailedCount()).toBe(1);
      expect(maria.mutationQueue.getFailedMutations()[0]).toMatchObject({ type: 'SAVE_TOURNAMENT', discardedCopy: true }); // @FU-109: eigener Grund
      expect(maria.mutationQueue.needsCloudCopy('T')).toBe(true);
    });

    it('@FU-106 RACE-A2: online speichert Maria, bevor der Abruf nach dem Verwerfen durch ist → Ollis Titel bleibt in der Cloud', async () => {
      const { cloud, maria, savesVorher } = await wettlauf();
      verwerfen(maria);
      const ui = stored();

      await maria.save({ ...ui, location: { ...ui.location, name: 'Halle Süd' } });
      await flush();
      await maria.get('T', { fresh: true });

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(maria.mutationQueue.getFailedCount() + maria.mutationQueue.getPendingCount()).toBeGreaterThan(0); // sichtbar, nicht still verloren
    });

    it('Gegenbeispiel: nach gelungener Übernahme speichert Maria aus dem neuen Stand, die Änderung landet', async () => {
      const { cloud, maria } = await wettlauf();
      verwerfen(maria);
      await flush();
      const neu = stored();
      expect(neu).toMatchObject({ title: 'Ollis Titel', version: 8 });

      await maria.save({ ...neu, location: { ...neu.location, name: 'Halle Süd' } });
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 9, location: { name: 'Halle Süd' } });
      expect(maria.mutationQueue.getFailedCount()).toBe(0);
    });

    it('die Merkung endet, wenn der Abruf das Turnier nicht mehr liefert (gelöscht oder unsichtbar); die Kopie bleibt', async () => {
      const { cloud, maria } = await wettlauf();
      cloud.setState({ tournament: liveCup(3, { id: 'ANDERES' }), revisions: revisions() });

      verwerfen(maria);
      await flush();

      expect(maria.mutationQueue.needsCloudCopy('T')).toBe(false);
      expect(stored()).toMatchObject({ title: 'Marias Titel' });
    });

    it('die Merkung endet, wenn Maria das Turnier auf dem Gerät löscht', async () => {
      const { cloud, maria } = await wettlauf();
      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new Error('Failed to fetch'));
      verwerfen(maria);
      await flush();
      expect(maria.mutationQueue.needsCloudCopy('T')).toBe(true);

      net.online = false;
      await maria.delete('T');

      expect(maria.mutationQueue.needsCloudCopy('T')).toBe(false);
    });
  });

  describe('Verwerfen ohne Konflikt (Entscheidung 20.10.: immer Stand des Servers) und Gegenbeispiele', () => {
    /** Olli (Eigentümer) speichert „Verworfener Titel“; der Server lehnt dauerhaft ab, ohne Konflikt (Probe NOCONF-D). */
    async function ohneKonfliktImDeadLetter() {
      session.userId = OLLI;
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: OLLI }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      cloud.fake.save.mockRejectedValue(new TeamStillReferencedError('spiel-4')); // dauerhaft, kein Konflikt
      const olli = device(OLLI, cloud);
      const gelesen = (await olli.get('T', { fresh: true }))!;
      await olli.save({ ...gelesen, title: 'Verworfener Titel' });
      await bisDeadLetter(olli);
      expect(olli.mutationQueue.getFailedMutations()[0].conflict).toBeUndefined();
      return { cloud, olli, savesVorher: cloud.fake.save.mock.calls.length };
    }

    it('@FU-106 NOCONF-D: Verwerfen ohne Konflikt am Gerät des Eigentümers – sein Gerät zeigt den Stand des Servers, und Wiederverbinden (syncUp) schickt den verworfenen Titel nicht', async () => {
      const { cloud, olli, savesVorher } = await ohneKonfliktImDeadLetter();

      verwerfen(olli);
      await flush();
      await olli.syncUp(); // App-Start oder Wiederverbinden (useSyncOnReconnect)
      await flush();

      expect(stored()).toMatchObject({ title: 'Live-Cup', version: 7 });
      expect(cloud.fake.updateTournamentMetadata).not.toHaveBeenCalled();
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Live-Cup', version: 7 });
      expect(olli.mutationQueue.needsCloudCopy('T')).toBe(false);
    });

    it('@FU-109 NOCONF-H1: der Abruf nach dem Verwerfen wird abgebrochen – die Merkung bleibt, Wiederverbinden (syncUp) schickt den verworfenen Titel nicht, der nächste Abruf übernimmt (Befund C-VERWERFEN-MERKUNG-BEI-ABBRUCH)', async () => {
      const { cloud, olli, savesVorher } = await ohneKonfliktImDeadLetter();
      cloud.fake.getWithMatchRevisions.mockRejectedValueOnce(new CloudReadAbortedError({ message: 'aborted', code: 20 }));

      verwerfen(olli);
      await flush();
      expect(olli.mutationQueue.needsCloudCopy('T')).toBe(true); // Abbruch heißt nicht „Turnier weg“
      expect(stored()).toMatchObject({ title: 'Verworfener Titel' });
      await olli.syncUp();
      await flush();

      expect(cloud.fake.updateTournamentMetadata).not.toHaveBeenCalled();
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Live-Cup', version: 7 });

      await olli.get('T', { fresh: true });
      expect(stored()).toMatchObject({ title: 'Live-Cup', version: 7 });
      expect(olli.mutationQueue.needsCloudCopy('T')).toBe(false);
    });

    it('@FU-109 nach dem Verwerfen ohne erreichbaren Server weiter Einstellungen gespeichert (Voll-Speichern): geht nicht zum Server, liegt mit eigenem Grund (nicht „Konflikt“) sichtbar ab (Befund C-VERWORFEN-FALSCHER-GRUND)', async () => {
      const { cloud, olli, savesVorher } = await ohneKonfliktImDeadLetter();
      cloud.fake.getWithMatchRevisions.mockRejectedValue(new Error('Failed to fetch')); // Hallen-WLAN ohne Internet
      cloud.fake.get.mockRejectedValue(new Error('Failed to fetch'));
      verwerfen(olli);
      await flush();

      const kopie = stored();
      await olli.save({ ...kopie, location: { ...kopie.location, name: 'Halle Süd' } });
      await flush();

      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      const [eintrag] = olli.mutationQueue.getFailedMutations();
      expect(eintrag).toMatchObject({ type: 'SAVE_TOURNAMENT', discardedCopy: true });
      expect(eintrag.conflict).toBeUndefined();
      expect(olli.mutationQueue.needsCloudCopy('T')).toBe(true);
    });

    it('@FU-109 ist der Server nach dem Verwerfen nicht erreichbar, wird nichts gelöscht, das Gerät meldet das Warten auf den Stand des Servers und lädt nichts hoch', async () => {
      const { cloud, olli, savesVorher } = await ohneKonfliktImDeadLetter();
      cloud.fake.getWithMatchRevisions.mockRejectedValue(new Error('Failed to fetch'));
      cloud.fake.get.mockRejectedValue(new Error('Failed to fetch'));

      verwerfen(olli);
      await flush();
      await olli.syncUp();
      await flush();

      expect(stored()).toMatchObject({ title: 'Verworfener Titel' }); // nichts gelöscht
      expect(stored().teams).toHaveLength(liveCup(7).teams.length);
      expect(olli.mutationQueue.needsCloudCopy('T')).toBe(true); // Hinweis „Stand des Servers wird geladen“
      expect(olli.mutationQueue.scopesNeedingCloudCopy()).toEqual(['T']);
      expect(cloud.fake.updateTournamentMetadata).not.toHaveBeenCalled();
      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);

      // Server wieder erreichbar: jetzt kommt der Stand des Servers
      cloud.fake.getWithMatchRevisions.mockReset();
      cloud.fake.get.mockReset();
      const erreichbar = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      cloud.fake.getWithMatchRevisions.mockImplementation(erreichbar.fake.getWithMatchRevisions);
      cloud.fake.get.mockImplementation(erreichbar.fake.get);
      await olli.get('T', { fresh: true });

      expect(stored()).toMatchObject({ title: 'Live-Cup', version: 7 });
      expect(olli.mutationQueue.needsCloudCopy('T')).toBe(false);
    });

    it('@FU-107 Verwerfen löscht kein Turnier, das noch nie beim Server war', async () => {
      session.userId = OLLI;
      const neu = { ...liveCup(0, { title: 'Hallen-Cup Ost' }), ownerId: OLLI };
      const cloud = createFakeCloud({ tournament: liveCup(3, { id: 'ANDERES' }), revisions: revisions() }); // T ist nicht in der Cloud
      cloud.fake.save.mockRejectedValue(new RepositoryError('save', 'new row violates row-level security policy'));
      const olli = device(OLLI, cloud);

      await olli.save(neu);
      await bisDeadLetter(olli);
      verwerfen(olli);
      await flush();
      await olli.get('T', { fresh: true });

      expect(stored()).toMatchObject({ title: 'Hallen-Cup Ost', ownerId: OLLI });
      expect(stored().teams).toHaveLength(neu.teams.length);
      expect(stored().matches).toHaveLength(neu.matches.length);
    });
  });
});
