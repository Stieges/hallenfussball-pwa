/**
 * A-08f3c2 Regel Q, Teil Dead-Letter (H2) (Plan `task-A-08f3-plan.md` v4 § 2.3, Review v2 § 4 Nr. 3 (c)–(e), (g)): Eine ganze Cloud-Kopie
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
import { FC_NORD, deadLetter as putDeadLetter, flush, heimseite, liveCup, revisions, stored as storedIn } from '../../../test/queueGuardFixtures';

const stored = (): Tournament => storedIn(stores);
const deadLetter = (type: string, payload: unknown): void => putDeadLetter(stores, type, payload);

describe('A-08f3c2 Regel Q: gescheiterte eigene Änderungen (Dead-Letter) schützen die lokale Kopie', () => {
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

  it('@FU-004 H2: gescheitertes Umbenennen (SAVE_TOURNAMENT im Dead-Letter) schützt die lokale Kopie', async () => {
    stores.raw.set('tournaments', [liveCup(8, { teamName: 'FC Nord II' })]);
    deadLetter('SAVE_TOURNAMENT', liveCup(8, { teamName: 'FC Nord II' }));
    const { repo: r } = setup(liveCup(9, { title: 'Hallen-Cup' }));

    await r.get('T', { fresh: true });
    await flush();

    expect(stored().teams[0].name).toBe('FC Nord II');
    expect(stored().title).toBe('Live-Cup');
  });

  it('Gegenbeispiel (9): Dead-Letter verworfen → der nächste Takt übernimmt die Cloud-Kopie', async () => {
    stores.raw.set('tournaments', [liveCup(8, { teamName: 'FC Nord II' })]);
    deadLetter('SAVE_TOURNAMENT', liveCup(8, { teamName: 'FC Nord II' }));
    const { repo: r } = setup(liveCup(9, { title: 'Hallen-Cup' }));
    await r.get('T', { fresh: true });

    r.mutationQueue.clearFailedMutation('dl-1');
    await r.get('T', { fresh: true });

    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 9 });
    expect(stored().teams[0].name).not.toBe('FC Nord II');
  });

  it('@FU-004 UPDATE_MATCHES im Dead-Letter schützt die eigene Besetzung ebenfalls', async () => {
    stores.raw.set('tournaments', [liveCup(7, { hfHeim: FC_NORD })]);
    deadLetter('UPDATE_MATCHES', { tournamentId: 'T', updates: [{ id: 'hf-1', slotA: teamSlot(FC_NORD) }] });
    const { repo: r } = setup(liveCup(8, { title: 'Hallen-Cup' }));

    await r.get('T', { fresh: true });

    expect(heimseite(stored())).toBe(FC_NORD);
  });

  it('Dead-Letter eines anderen Turniers schützt dieses Turnier nicht', async () => {
    deadLetter('SAVE_TOURNAMENT', { ...liveCup(3), id: 'ANDERES' });
    const { repo: r } = setup(liveCup(8, { title: 'Hallen-Cup' }));

    await r.get('T', { fresh: true });

    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 8 });
  });
});
