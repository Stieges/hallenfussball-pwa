/**
 * A-08f3c2 Regel Q (Plan `task-A-08f3-plan.md` v4 § 2.3, Review v2 § 4 Nr. 3 (c)–(e), (g)): Eine ganze Cloud-Kopie
 * wird nur übernommen, wenn vor UND nach dem Lesen nichts wartet, der Abschluss-Zähler gleich ist und kein
 * geschützter Dead-Letter-Eintrag des Turniers liegt. Sonst nur der Feldweg; der nächste Takt versucht es neu.
 *
 * Anforderungen: @FU-002 (ohne Netz geht nichts verloren), @FU-004 (gescheiterter Eintrag bleibt, bis geklärt),
 * @TM-027 (alle Geräte zeigen dieselbe Besetzung – eigene Auflösung geht nicht durch eine veraltete Kopie verloren),
 * @FU-089 (M4/M5: Wege mit ganzer Kopie gehen über dieselbe Regel).
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
import { teamSlot } from '../../models/matchSlot';
import { createMockMatch } from '../../../test/factories';
import { FC_NORD, flush, heimseite, liveCup, revisions, stored as storedIn } from '../../../test/queueGuardFixtures';

const stored = (): Tournament => storedIn(stores);

describe('A-08f3c2 Regel Q: keine stille Übernahme über eigene wartende oder gescheiterte Änderungen', () => {
  let repo: OfflineRepository | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = 'olli';
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
    stores.raw.set('tournaments', [liveCup(7)]);
  });

  afterEach(() => {
    repo?.mutationQueue.dispose();
    repo = undefined;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function setup(cloudTournament: Tournament) {
    const cloud = createFakeCloud({ tournament: cloudTournament, revisions: revisions() });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    return { cloud, repo };
  }

  it('@TM-027 H1 Wettlauf: eigene Besetzung von Halbfinale 1 wird während des Lesens gesendet → die veraltete Kopie überschreibt sie nicht', async () => {
    const { cloud, repo: r } = setup(liveCup(9, { title: 'Hallen-Cup' }));
    const held = cloud.holdNextRead();
    const reading = r.get('T', { fresh: true });
    await flush();

    await r.updateMatches('T', [{ id: 'hf-1', slotA: teamSlot(FC_NORD) }]);
    await flush();
    expect(r.mutationQueue.getPendingCount()).toBe(0); // gesendet und erledigt, bevor die alte Antwort ankommt
    held.release();
    await reading;
    await flush();

    expect(heimseite(stored())).toBe(FC_NORD);
    expect(stored().title).toBe('Live-Cup');

    await r.get('T', { fresh: true }); // nächster Takt: Cloud hat jetzt beides
    expect(heimseite(stored())).toBe(FC_NORD);
    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 9 });
  });

  it('Gegenbeispiel (8): nichts wartet, Zähler gleich → die ganze Kopie wird übernommen wie heute', async () => {
    const { repo: r } = setup(liveCup(8, { title: 'Hallen-Cup', hfHeim: FC_NORD }));

    await r.get('T', { fresh: true });

    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 8 });
    expect(heimseite(stored())).toBe(FC_NORD);
  });

  it('M3: eigenes Speichern während des Lesens (wartet offline) wird nicht überschrieben', async () => {
    const { cloud, repo: r } = setup(liveCup(9, { title: 'Hallen-Cup' }));
    const held = cloud.holdNextRead();
    const reading = r.get('T', { fresh: true });
    await flush();

    net.online = false;
    await r.save(liveCup(7, { teamName: 'FC Nord II' }));
    held.release();
    await reading;
    await flush();

    expect(stored().teams[0].name).toBe('FC Nord II');
    expect(r.mutationQueue.getPendingCount()).toBe(1);
  });

  it('M5: ein Spiel, das es nur in der Cloud gibt, kommt mit der ganzen Kopie (deshalb ist „neu erzeugen“ mit Einträgen gesperrt)', async () => {
    const geist = createMockMatch({ id: 'spiel-7-alt', matchStatus: 'finished', scoreA: 2, scoreB: 1 });
    const { repo: r } = setup(liveCup(8, { plus: [geist] }));

    await r.get('T', { fresh: true });

    expect(stored().matches.map((m) => m.id)).toContain('spiel-7-alt');
  });

  it('M4: syncDown mit wartender eigener Änderung übernimmt nicht die ganze Kopie', async () => {
    const { repo: r } = setup(liveCup(9, { title: 'Hallen-Cup', updatedAt: '2030-01-01T00:00:00.000Z' }));
    net.online = false;
    await r.updateMatches('T', [{ id: 'hf-1', slotA: teamSlot(FC_NORD) }]);
    net.online = true;

    await r.syncDown('T');

    expect(heimseite(stored())).toBe(FC_NORD);
    expect(stored().title).toBe('Live-Cup');
  });

  it('M-3: „Cloud übernehmen“ mit wartender eigener Änderung meldet „blocked“, nicht „updated“, und übernimmt nicht', async () => {
    const { repo: r } = setup(liveCup(9, { title: 'Hallen-Cup' }));
    net.online = false;
    await r.updateMatches('T', [{ id: 'hf-1', slotA: teamSlot(FC_NORD) }]);
    net.online = true;

    const result = await r.resolveConflict('T', 'remote');

    expect(result.status).toBe('blocked');
    expect(stored().title).toBe('Live-Cup');
  });

  it('M-3: syncDown mit wartender eigener Änderung meldet „blocked“', async () => {
    const { repo: r } = setup(liveCup(9, { title: 'Hallen-Cup', updatedAt: '2030-01-01T00:00:00.000Z' }));
    net.online = false;
    await r.updateMatches('T', [{ id: 'hf-1', slotA: teamSlot(FC_NORD) }]);
    net.online = true;

    expect((await r.syncDown('T')).status).toBe('blocked');
  });
});
