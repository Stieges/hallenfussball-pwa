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
import type { Tournament, Match } from '../../models/types';

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
import { createMockMatch, createMockTournament } from '../../../test/factories';
import { teamSlot } from '../../models/matchSlot';
import { testUuid } from '../../../test/testIds';

const UPDATED_AT = '2026-10-15T08:00:00.000Z';
const FC_NORD = testUuid(81);

/** Live-Cup: Gruppe-A-Spiel und Halbfinale 1 (Heimseite noch offen). */
function liveCup(version: number, extra: { title?: string; teamName?: string; hfHeim?: string; plus?: Match[]; updatedAt?: string } = {}): Tournament {
  const base = createMockTournament({ id: 'T', ownerId: 'olli', version, updatedAt: extra.updatedAt ?? UPDATED_AT, title: extra.title ?? 'Live-Cup' });
  const teams = extra.teamName ? base.teams.map((t, i) => (i === 0 ? { ...t, name: extra.teamName! } : t)) : base.teams;
  const hf = createMockMatch({ id: 'hf-1', matchStatus: 'scheduled', ...(extra.hfHeim ? { slotA: teamSlot(extra.hfHeim) } : {}) });
  return { ...base, teams, matches: [createMockMatch({ id: 'spiel-4', matchStatus: 'scheduled' }), hf, ...(extra.plus ?? [])] };
}

const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1]]);

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}
const heimseite = (t: Tournament): string | undefined => {
  const slot = t.matches.find((m) => m.id === 'hf-1')?.slotA;
  return slot?.kind === 'team' ? slot.teamId : undefined;
};

/** Dead-Letter-Eintrag des Kontos (wie nach MAX_RETRIES), vor dem Anlegen des Repositorys. */
function deadLetter(type: string, payload: unknown): void {
  stores.queue.set('mutation_queue_failed_v1:olli', JSON.stringify([
    { id: 'dl-1', type, payload, timestamp: 1, retryCount: 5, failedAt: 2, lastError: 'Optimistic lock failed' },
  ]));
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

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
});
