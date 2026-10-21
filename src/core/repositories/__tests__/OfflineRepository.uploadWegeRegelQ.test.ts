/**
 * Auflagen A2/A3 aus `review-ca67.md` (Regel Q „kein stilles Überschreiben“, @FU-106, @FU-002, @FU-004;
 * `plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * - A2: `syncUp` (App-Start, Wiederverbinden) lädt keine Kopie hoch, für die das Gerät eigene wartende, laufende oder
 *   gescheiterte Einträge hat; ein nie hochgeladenes Turnier ohne Einträge lädt es weiter hoch.
 * - A3: Restwege über mehrdeutige Versionen – die lokale Kopie stempelt „Nutzlast + 1“ vor der Bestätigung des Servers,
 *   nach einem Konflikt tragen Marias Kopie und Ollis Cloud-Stand dieselbe Nummer mit anderem Inhalt. Befund
 *   C-VERSION-MEHRDEUTIG, geschlossen: Voll-Speichern prüft gegen die zuletzt vom Server bestätigte Version.
 * Aufbau wie `OfflineRepository.verwerfenNachKonflikt.test.ts`.
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

describe('Regel Q auf den übrigen Upload-Wegen (Auflagen A2/A3 review-ca67)', () => {
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

  describe('@FU-106 Auflage A2: syncUp schiebt nichts an der Warteschlange vorbei', () => {
    it('@FU-106 SYNCUP-E: Marias Konflikt-Eintrag liegt im Dead-Letter, das Gerät verbindet sich neu (syncUp) → nichts geht an die Cloud', async () => {
      const { cloud, maria, savesVorher } = await wettlauf();

      await maria.syncUp();
      await flush();

      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(cloud.fake.updateTournamentMetadata).not.toHaveBeenCalled();
      expect(cloud.fake.updateMatches).not.toHaveBeenCalled();
      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel', version: 8 });
      expect(maria.mutationQueue.getFailedCount()).toBe(1); // weiter sichtbar
    });

    it('SYNCUP-E: auch ein noch wartender Eintrag (ohne Netz gespeichert) wird nicht an der Warteschlange vorbei hochgeladen', async () => {
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: MARIA }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      const maria = device(MARIA, cloud);
      const gelesen = (await maria.get('T', { fresh: true }))!;
      net.online = false;
      await maria.save({ ...gelesen, title: 'Marias Titel' });
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Ollis Titel' }); // Cloud v8, lokal v8
      const savesVorher = cloud.fake.save.mock.calls.length;

      await maria.syncUp();
      await flush();

      expect(cloud.fake.save.mock.calls.length).toBe(savesVorher);
      expect(cloud.fake.updateTournamentMetadata).not.toHaveBeenCalled();
      expect(maria.mutationQueue.getPendingCount()).toBe(1);
    });

    it('Gegenbeispiel: ohne Einträge lädt syncUp ein nie hochgeladenes Turnier weiter hoch', async () => {
      session.userId = OLLI;
      const neu = { ...liveCup(0, { title: 'Hallen-Cup Ost' }), ownerId: OLLI };
      stores.raw.set('tournaments', [neu]);
      const cloud = createFakeCloud({ tournament: liveCup(3, { id: 'ANDERES' }), revisions: revisions() }); // T ist nicht in der Cloud
      const olli = device(OLLI, cloud);
      expect(olli.mutationQueue.getPendingCount() + olli.mutationQueue.getFailedCount()).toBe(0);

      await olli.syncUp();
      await flush();

      expect(cloud.fake.save).toHaveBeenCalledTimes(1);
      expect(cloud.fake.save.mock.calls[0][0]).toMatchObject({ id: 'T', title: 'Hallen-Cup Ost' });
    });
  });

  describe('Befund C-VERSION-MEHRDEUTIG (Auflage A3): Restwege über mehrdeutige Versionen', () => {
    it('@FU-106 PRE-B: während Marias Konflikt-Eintrag noch wiederholt wird, speichert sie erneut (zusammengefasst) → Ollis Titel muss bleiben (Befund C-VERSION-MEHRDEUTIG)', async () => {
      stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: MARIA }]);
      const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
      const maria = device(MARIA, cloud);
      const gelesen = (await maria.get('T', { fresh: true }))!;
      const current = (await cloud.fake.get('T'))!;
      await cloud.fake.save({ ...current, title: 'Ollis Titel' }); // Cloud v8
      await maria.save({ ...gelesen, title: 'Marias Titel' }); // lokal v8, Eintrag v7 scheitert
      await flush();
      const ui = stored();

      await maria.save({ ...ui, location: { ...ui.location, name: 'Halle Süd' } }); // Nutzlast v8 = Cloud v8
      await flush();
      for (let v = 0; v < MAX_RETRIES; v++) { await vi.advanceTimersByTimeAsync(FAILURE_HOLD_MS); await flush(); }

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel' });
    });

    it('@FU-106 RACE-C: nach gelungener Übernahme speichert ein offenes Formular mit dem verworfenen Stand (v8) → Ollis Titel muss bleiben (Befund C-VERSION-MEHRDEUTIG)', async () => {
      const { cloud, maria } = await wettlauf();
      const formular = stored(); // Marias Titel, v8 – Stand im offenen Formular
      verwerfen(maria);
      await flush();
      expect(stored()).toMatchObject({ title: 'Ollis Titel', version: 8 });

      await maria.save({ ...formular, location: { ...formular.location, name: 'Halle Süd' } });
      await flush();

      expect(await cloud.fake.get('T')).toMatchObject({ title: 'Ollis Titel' });
    });
  });
});
