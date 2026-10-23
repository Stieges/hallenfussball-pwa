/**
 * A-10 Teil C (brief-A-10.md § 8 Fall 12, Rest von Befund C-SLOT-UPDATE-OHNE-VERSION): Zwei Geräte, je ein echtes
 * `OfflineRepository` + `LocalStorageRepository` mit eigenem Speicher, eine Fake-Cloud, die wie der Server nach F2b
 * `tournaments.change_revision` zählt, wenn `updateMatches` eine Spielplan-Spalte ändert (ohne `baseVersion`).
 *
 * @TM-027 (`docs/anforderungen/2026-10-01_turniermodi.md`): „Gegeben Olli, Maria und Tom haben das Turnier geöffnet und
 * Netz · Wenn Olli Gruppe A abschließt · Dann zeigen alle drei Geräte im Halbfinale 1 auf der Heimseite ‚FC Nord‘“.
 * Hier löst Maria (Co-Admin) Halbfinale 1 auf; Ollis Gerät übernimmt beim nächsten Abruf-Takt (≤ 10 s, `get` mit
 * `fresh`, wie der 5-s-Takt des Spielplans).
 * Dazu Regel Q (brief § 3 Teil C): auch das eigene Speichern erhöht die Zählung; wartet dabei etwas Eigenes, wird
 * nichts überschrieben.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';

const session = vi.hoisted(() => ({ userId: null as string | null }));
const net = vi.hoisted(() => ({ online: true }));
type Device = 'olli' | 'maria';
/** Speicher je Gerät; `device` bestimmt, welches Gerät gerade liest/schreibt. */
const devices = vi.hoisted(() => {
  const state: { device: 'olli' | 'maria'; raw: Record<'olli' | 'maria', Map<string, unknown>>; queue: Record<'olli' | 'maria', Map<string, string>> } = {
    device: 'olli',
    raw: { olli: new Map<string, unknown>(), maria: new Map<string, unknown>() },
    queue: { olli: new Map<string, string>(), maria: new Map<string, string>() },
  };
  return state;
});

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () =>
    Promise.resolve({
      get: (key: string) => Promise.resolve(devices.raw[devices.device].get(key)),
      set: (key: string, value: unknown) => { devices.raw[devices.device].set(key, structuredClone(value)); return Promise.resolve(); },
    }),
}));
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => devices.queue[devices.device].get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { devices.queue[devices.device].set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { devices.queue[devices.device].set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { devices.queue[devices.device].delete(key); }),
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
import { pendingSlot, teamSlot } from '../../models/matchSlot';
import { FC_NORD, flush, heimseite, liveCup as liveCupBase, revisions } from '../../../test/queueGuardFixtures';

/** Live-Cup mit OFFENER Heimseite von Halbfinale 1 (Sieger Gruppe A), sofern nicht `hfHeim` besetzt. */
function liveCup(version: number, extra: Parameters<typeof liveCupBase>[1] = {}): Tournament {
  const base = liveCupBase(version, extra);
  if (extra.hfHeim) { return base; }
  return { ...base, matches: base.matches.map((m) => (m.id === 'hf-1' ? { ...m, slotA: pendingSlot({ kind: 'groupRank', group: 'A', rank: 1 }) } : m)) };
}

function storedOn(device: Device): Tournament {
  const found = (devices.raw[device].get('tournaments') as Tournament[]).find((t) => t.id === 'T');
  if (!found) { throw new Error(`lokale Kopie auf ${device} fehlt`); }
  return found;
}

describe('A-10 @TM-027 Zwei Geräte: K.-o.-Auflösung ohne Versions-CAS erreicht das andere Gerät über die Änderungszählung', () => {
  const repos: OfflineRepository[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    for (const d of ['olli', 'maria'] as const satisfies readonly Device[]) {
      devices.raw[d].clear();
      devices.queue[d].clear();
      devices.raw[d].set('tournaments', [liveCup(7)]);
    }
    devices.device = 'olli';
    session.userId = 'olli';
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    for (const r of repos.splice(0)) { r.mutationQueue.dispose(); }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  function on(device: Device): void {
    devices.device = device;
    session.userId = device;
  }

  async function mariaResolvesSemifinal(cloud: ReturnType<typeof createFakeCloud>): Promise<void> {
    on('maria');
    const maria = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'maria');
    repos.push(maria);
    await maria.updateMatches('T', [{ id: 'hf-1', slotA: teamSlot(FC_NORD) }]);
    await flush();
    expect(cloud.fake.updateMatches).toHaveBeenCalledTimes(1);
    expect((cloud.fake.updateMatches.mock.calls[0] as unknown[])[2]).toBeUndefined(); // ohne baseVersion (MutationQueue)
    on('olli');
  }

  it('@TM-027 Maria löst Halbfinale 1 auf (Heimseite FC Nord) → Ollis Gerät zeigt FC Nord beim nächsten Takt', async () => {
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() }, { countsChangeRevision: true });
    on('olli');
    const olli = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    repos.push(olli);
    await olli.get('T', { fresh: true });
    expect(heimseite(storedOn('olli'))).toBeUndefined();

    await mariaResolvesSemifinal(cloud);
    vi.advanceTimersByTime(5000); // ein Abruf-Takt des Spielplans (≤ 10 s)
    const shown = await olli.get('T', { fresh: true });

    expect(heimseite(shown!)).toBe(FC_NORD);
    expect(heimseite(storedOn('olli'))).toBe(FC_NORD);
    expect(storedOn('olli').changeRevision).toBe(1);
    expect(storedOn('olli').version).toBe(7); // Version unverändert -- die Zählung trägt die Übernahme
  });

  it('Gegenbeispiel (Mutation 5): ohne Zählung am Server erreicht die Auflösung Ollis Gerät nie (Feldweg trägt keine Seiten)', async () => {
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
    on('olli');
    const olli = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    repos.push(olli);

    await mariaResolvesSemifinal(cloud);
    for (let takt = 0; takt < 3; takt++) {
      vi.advanceTimersByTime(5000);
      await olli.get('T', { fresh: true });
    }

    expect(heimseite(storedOn('olli'))).toBeUndefined();
  });

  it('Regel Q: Cloud-Zählung höher, aber Ollis eigenes Speichern wartet → nichts Wartendes wird überschrieben', async () => {
    const cloud = createFakeCloud({ tournament: { ...liveCup(7, { hfHeim: FC_NORD }), changeRevision: 4 }, revisions: revisions() });
    let releaseSave: () => void = () => undefined;
    cloud.fake.save.mockImplementation(() => new Promise<number>((resolve) => { releaseSave = () => resolve(8); }));
    on('olli');
    const olli = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    repos.push(olli);

    await olli.save(liveCup(7, { teamName: 'FC Nord II' }));
    await flush();
    expect(olli.mutationQueue.getPendingCount()).toBe(1);
    await olli.get('T', { fresh: true });

    expect(storedOn('olli').teams[0].name).toBe('FC Nord II');
    expect(heimseite(storedOn('olli'))).toBeUndefined();
    releaseSave();
  });

  it('Lokale Schreibwege ändern die Zählung nie: Speichern mit veralteter Zählung in der Nutzlast behält den übernommenen Wert', async () => {
    const cloud = createFakeCloud({ tournament: { ...liveCup(7), changeRevision: 6 }, revisions: revisions() });
    on('olli');
    const olli = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    repos.push(olli);
    await olli.get('T', { fresh: true });
    expect(storedOn('olli').changeRevision).toBe(6);

    net.online = false;
    await olli.save({ ...liveCup(7, { title: 'Hallen-Cup' }), changeRevision: 2 });
    await olli.updateTournamentMetadata('T', { title: 'Hallen-Cup 2', changeRevision: 1 });

    expect(storedOn('olli')).toMatchObject({ title: 'Hallen-Cup 2', changeRevision: 6 });
  });
});
