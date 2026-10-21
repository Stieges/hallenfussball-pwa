/**
 * A-08f3c1 (Plan `task-A-08f3-plan.md` v4 § 3 „c1“, Review v2 § 4 Nr. 3 (a)/(b)/(f)): Die lokale Turnier-Version folgt
 * der Cloud. `updateMatches` zählt nicht (die Cloud zählt ohne `baseVersion` auch nicht), Metadaten nur mit
 * `metadata.version`, `save` = Version der Nutzlast + 1, Freigabe/Code ohne +1; eine übernommene Cloud-Kopie trägt
 * Version und `updatedAt` der Cloud (`cacheCloudCopy`), auch über `syncDown`/`resolveConflict('remote')` (M4).
 *
 * Anforderungen (`docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md`):
 * @FU-089 (Spielplan-Änderung der Co-Admin erscheint auch nach einer eigenen Änderung, Befund C-LOKALVERSION-DRIFT),
 * @FU-002 (ohne Netz geht nichts verloren – H2-Kette, Befund C-LOKALVERSION-CAS).
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Storage, Fake-Cloud mit CAS wie der Server.
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

const UPDATED_AT = '2026-10-15T08:00:00.000Z';
const CLOUD_UPDATED_AT = '2026-10-18T09:30:00.000Z';
const KICKOFF_1430 = '1970-01-01T14:30:00.000Z';
const KICKOFF_1440 = '1970-01-01T14:40:00.000Z';

const spiel = (id: string, extra: Partial<Match> = {}): Match =>
  createMockMatch({ id, matchStatus: 'scheduled', scheduledTime: new Date(KICKOFF_1430), ...extra });

/** Live-Cup: Spiel 4, Spiel 5 (14:30) und Halbfinale 1 (Heimseite offen). */
function liveCup(version: number, extra: { title?: string; spiel5?: Partial<Match>; teamName?: string; updatedAt?: string } = {}): Tournament {
  const base = createMockTournament({ id: 'T', ownerId: 'olli', version, updatedAt: extra.updatedAt ?? UPDATED_AT, title: extra.title ?? 'Live-Cup' });
  const teams = extra.teamName ? base.teams.map((t, i) => (i === 0 ? { ...t, name: extra.teamName! } : t)) : base.teams;
  return { ...base, teams, matches: [spiel('spiel-4'), spiel('spiel-5', extra.spiel5), spiel('hf-1')] };
}

const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['spiel-5', 1], ['hf-1', 1]]);

function stored(): Tournament {
  const found = (stores.raw.get('tournaments') as Tournament[]).find((t) => t.id === 'T');
  if (!found) { throw new Error('lokale Kopie fehlt'); }
  return found;
}
const kickoff = (t: Tournament, id: string): string => new Date(t.matches.find((m) => m.id === id)?.scheduledTime ?? 0).toISOString();

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('A-08f3c1 Lokale Version folgt der Cloud (@FU-089, @FU-002)', () => {
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

  function setup(cloudTournament = liveCup(7)) {
    const cloud = createFakeCloud({ tournament: cloudTournament, revisions: revisions() });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    return { cloud, repo };
  }

  it('@FU-089 nach Ollis eigener Spielplan-Änderung (Seite von Halbfinale 1 besetzt) zeigt sein Gerät Spiel 5 mit Marias 14:40', async () => {
    const { cloud, repo: r } = setup();
    await r.updateMatches('T', [{ id: 'hf-1', scheduledTime: new Date(KICKOFF_1430) }]);
    await flush();
    expect(stored().version).toBe(7);

    // Maria verschiebt Spiel 5 auf 14:40 (Voll-Speichern → Cloud v8)
    cloud.setState({ tournament: liveCup(8, { spiel5: { scheduledTime: new Date(KICKOFF_1440) } }), revisions: revisions() });
    const shown = await r.get('T', { fresh: true });

    expect(kickoff(shown!, 'spiel-5')).toBe(KICKOFF_1440);
    expect(stored().version).toBe(8);
  });

  it('@FU-002 H2-Kette: K.-o.-Seite besetzt (updateMatches) → Push → Olli benennt ein Team um → kein OptimisticLockError, nichts im Dead-Letter', async () => {
    const { cloud, repo: r } = setup();
    await r.updateMatches('T', [{ id: 'hf-1', scheduledTime: new Date(KICKOFF_1430) }]);
    await flush();
    const inMemory = await r.get('T', { fresh: true }); // Push: Spielplan lädt frisch
    await r.save({ ...(inMemory!), teams: liveCup(7, { teamName: 'FC Nord II' }).teams });
    await flush();

    expect(cloud.fake.save).toHaveBeenCalledTimes(1);
    await expect(cloud.fake.save.mock.results[0].value).resolves.toEqual(expect.any(Number)) /* wirft nicht; liefert die erreichte Version */;
    expect(r.mutationQueue.getFailedCount()).toBe(0);
    expect(r.mutationQueue.getPendingCount()).toBe(0);
    expect(stored().version).toBe(8);
  });

  it('save = Version der Nutzlast + 1, nicht lokale Version + 1', async () => {
    const { repo: r } = setup();
    stores.raw.set('tournaments', [liveCup(9)]);
    net.online = false;

    await r.save(liveCup(7, { title: 'Live-Cup 2026' }));

    expect(stored()).toMatchObject({ title: 'Live-Cup 2026', version: 8 });
  });

  it('Metadaten ohne Version zählen lokal nicht; mit Version wie die Cloud (+1)', async () => {
    const { repo: r } = setup();
    net.online = false;

    await r.updateTournamentMetadata('T', { title: 'Hallen-Cup' });
    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 7 });

    await r.updateTournamentMetadata('T', { title: 'Hallen-Cup 2', version: 7 });
    expect(stored()).toMatchObject({ title: 'Hallen-Cup 2', version: 8 });
  });

  it('Freigabe und neuer Code zählen die lokale Version nicht (die Cloud zählt dort auch nicht)', async () => {
    const { cloud, repo: r } = setup();
    Object.assign(cloud.fake, {
      makeTournamentPublic: vi.fn(async () => ({ shareCode: 'ABC123', createdAt: CLOUD_UPDATED_AT })),
      regenerateShareCode: vi.fn(async () => ({ shareCode: 'XYZ789', createdAt: CLOUD_UPDATED_AT })),
    });

    await r.makeTournamentPublic('T');
    expect(stored()).toMatchObject({ isPublic: true, shareCode: 'ABC123', version: 7 });
    await r.regenerateShareCode('T');
    expect(stored()).toMatchObject({ shareCode: 'XYZ789', version: 7 });

    const local = new LocalStorageRepository();
    await local.makeTournamentPrivate('T');
    expect(stored()).toMatchObject({ isPublic: false, version: 7 });
  });

  it('Versionsweg: die übernommene Cloud-Kopie trägt Version und updatedAt der Cloud (cacheCloudCopy)', async () => {
    stores.raw.set('tournaments', [liveCup(5)]);
    const { repo: r } = setup(liveCup(8, { title: 'Hallen-Cup', updatedAt: CLOUD_UPDATED_AT }));

    await r.get('T', { fresh: true });

    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 8, updatedAt: CLOUD_UPDATED_AT, ownerId: 'olli' });
  });

  it('M4 syncDown: Cloud neuer → ganze Kopie mit Version und updatedAt der Cloud', async () => {
    const { repo: r } = setup(liveCup(8, { title: 'Hallen-Cup', updatedAt: CLOUD_UPDATED_AT }));

    const result = await r.syncDown('T');

    expect(result.status).toBe('updated');
    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 8, updatedAt: CLOUD_UPDATED_AT });
  });

  it('M4 Knopf „Cloud übernehmen“ (resolveConflict remote) ohne wartende Einträge → ganze Kopie mit Cloud-Version', async () => {
    stores.raw.set('tournaments', [liveCup(9, { title: 'Alter Titel' })]);
    const { repo: r } = setup(liveCup(8, { title: 'Hallen-Cup', updatedAt: CLOUD_UPDATED_AT }));

    const result = await r.resolveConflict('T', 'remote');

    expect(result.status).toBe('updated');
    expect(stored()).toMatchObject({ title: 'Hallen-Cup', version: 8, updatedAt: CLOUD_UPDATED_AT });
  });
});
