/**
 * T3 (PDF-Paket PR 2): Das Turnierlogo liegt im Gerätespeicher neben dem Turnier und überlebt jeden Weg des
 * Cloud-Abgleichs. Gherkin: @W3-030 „Aber ein anderes Gerät der Turnierleitung hat die Grafiken nicht und druckt ohne
 * sie (Logos in der Cloud: MVP+)“ und „ein SVG wandelt die App … speichert nur das PNG“.
 *
 * Echter `OfflineRepository` mit echtem `LocalStorageRepository` auf Speicher im Arbeitsspeicher; `SupabaseRepository`
 * ist eine Fälschung, die die Cloud-Fassung über den ECHTEN `mapTournamentFromSupabase` aus Zeilen liefert.
 * Kein Mapper und kein Sync-Weg kennt den Schlüssel `tournament-graphics-*` (Schutz durch den Aufbau).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Tournament } from '../../models/types';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));

vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.has(key) ? structuredClone(stores.raw.get(key)) : null),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
    delete: (key: string) => { stores.raw.delete(key); return Promise.resolve(); },
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
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'olli' } } }, error: null })) } },
}));

import { OfflineRepository } from '../OfflineRepository';
import { LocalStorageRepository } from '../LocalStorageRepository';
import { mapTournamentFromSupabase, mapTournamentToSupabase } from '../supabaseMappers';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { createMockTournament } from '../../../test/factories';
import { createTournamentRow } from '../../../../tests/factories/supabase';
import { tournamentGraphicsStore } from '../../storage/tournamentGraphicsStore';

const ID = 'T';
const LOGO = {
  left: { dataUrl: 'data:image/png;base64,TEVSTkVO', widthPx: 600, heightPx: 600, originalHeightPx: 1200 },
  right: { dataUrl: 'data:image/png;base64,UkVDSFRT', widthPx: 300, heightPx: 150, originalHeightPx: 150 },
  accent: '#2A2576',
} as const;

function localTournament(): Tournament {
  return createMockTournament({ id: ID, ownerId: 'olli', title: 'Hallencup Nord', version: 7, updatedAt: '2026-10-01T10:00:00.000Z', teams: [] });
}

/** Cloud-Fassung: neuer Titel, höhere Version, gelesen aus Zeilen über den echten Mapper. */
function cloudTournament(): Tournament {
  const row = createTournamentRow({
    id: ID, owner_id: 'olli', title: 'Hallencup Nord (Cloud)', version: 9, date: '2026-11-20',
    created_at: '2026-10-01T10:00:00Z', updated_at: '2026-11-01T10:00:00Z',
  });
  return mapTournamentFromSupabase(row, [], []);
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

function storedTitle(): string | undefined {
  return (stores.raw.get('tournaments') as Tournament[] | undefined)?.find((t) => t.id === ID)?.title;
}

describe('@W3-030 Turnierlogo im Gerätespeicher und der Cloud-Abgleich', () => {
  const created: OfflineRepository[] = [];
  let cloud: ReturnType<typeof createFakeCloud>;
  let fake: ReturnType<typeof createFakeCloud>['fake'] & { makeTournamentPublic: ReturnType<typeof vi.fn> };

  function repo(): OfflineRepository {
    const r = new OfflineRepository(new LocalStorageRepository(), fake as never, 'olli');
    created.push(r);
    return r;
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('navigator', { onLine: true });
    stores.raw.clear();
    stores.queue.clear();
    stores.raw.set('tournaments', [localTournament()]);
    const state = cloudTournament();
    cloud = createFakeCloud({ tournament: state, revisions: new Map() });
    fake = Object.assign(cloud.fake, {
      makeTournamentPublic: vi.fn(async () => ({ shareCode: 'ABC123', createdAt: '2026-11-01T11:00:00.000Z' })),
    });
    fake.listWithMemberships.mockImplementation(async () => ({
      tournaments: [{ ...cloudTournament(), myRole: 'owner' as const }], ownIds: new Set([ID]), memberships: 'not-queried' as const,
    }));
    await tournamentGraphicsStore.save(ID, LOGO);
  });

  afterEach(() => {
    created.splice(0).forEach((r) => r.mutationQueue.dispose());
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const wege: Array<[string, (r: OfflineRepository) => Promise<unknown>, boolean]> = [
    ['get(id, { fresh: true }) (adoptCloudRead)', (r) => r.get(ID, { fresh: true }), true],
    ['syncDown (cacheCloudCopy)', (r) => r.syncDown(ID), true],
    ['resolveConflict(remote)', (r) => r.resolveConflict(ID, 'remote'), true],
    ['listForCurrentUser', (r) => r.listForCurrentUser(), false],
    ['makeTournamentPublic (cacheCloudCopy)', (r) => r.makeTournamentPublic(ID), false],
  ];

  it.each(wege)('@W3-030 Cloud-Abgleich lässt das Turnierlogo auf dem Gerät stehen: %s', async (_name, run, adoptsCloudCopy) => {
    const vorher = JSON.stringify(await tournamentGraphicsStore.load(ID));

    await run(repo());
    await flush();

    // der Weg lief wirklich: die Cloud-Fassung ersetzte die lokale Kopie (Titel), wo der Weg sie übernimmt
    if (adoptsCloudCopy) { expect(storedTitle()).toBe('Hallencup Nord (Cloud)'); }
    expect(JSON.stringify(await tournamentGraphicsStore.load(ID))).toBe(vorher);
    expect(await tournamentGraphicsStore.load(ID)).toEqual(LOGO);
  });

  it('@W3-030 Hochladen schickt kein Logo in die Cloud: weder die Zeilen noch ein Aufruf der Fälschung', async () => {
    const tournament = { ...localTournament(), title: 'Hallencup Nord neu' };

    const r = repo();
    await r.save(tournament);
    await flush();
    await r.makeTournamentPublic(ID);
    await flush();

    const { tournamentRow, teamRows, matchRows } = mapTournamentToSupabase(tournament, 'olli');
    const calls = Object.values(fake).flatMap((fn) => (vi.isMockFunction(fn) ? fn.mock.calls : []));
    const gesendet = JSON.stringify([tournamentRow, teamRows, matchRows, calls]);

    expect(fake.save).toHaveBeenCalled();
    expect(gesendet).not.toContain('data:image');
    expect(gesendet).not.toContain('tournament-graphics');
    expect(gesendet).not.toContain(LOGO.accent);
    expect(JSON.stringify(stores.raw.get('tournaments'))).not.toContain('data:image');
  });

  it('@W3-030 Turnier löschen fasst die Grafik nicht an: lokal weg, DELETE_TOURNAMENT eingereiht, Grafik bleibt liegen', async () => {
    const r = repo();
    const eingereiht = vi.spyOn(r.mutationQueue, 'enqueue');

    await r.delete(ID);

    expect(eingereiht).toHaveBeenCalledWith('DELETE_TOURNAMENT', ID);
    expect(storedTitle()).toBeUndefined();
    expect(await tournamentGraphicsStore.load(ID)).toEqual(LOGO);
  });

  it('@W3-030 löschen → wiederherstellen → Logo ist wieder da (gleiche ID aus der Cloud)', async () => {
    const r = repo();
    await r.delete(ID);
    expect(storedTitle()).toBeUndefined();

    const wiederhergestellt = await r.get(ID); // die Cloud liefert das Turnier unter derselben ID zurück
    await flush();

    expect(wiederhergestellt?.id).toBe(ID);
    expect(await tournamentGraphicsStore.load(ID)).toEqual(LOGO);
  });

  it('@DR-024 Co-Admin-Gerät: Turnier aus der Cloud, kein Eintrag im Gerätespeicher → leere Grafiken, kein Fehler', async () => {
    stores.raw.clear();
    stores.raw.set('tournaments', []);

    const geladen = await repo().get(ID);
    await flush();

    expect(geladen?.id).toBe(ID);
    await expect(tournamentGraphicsStore.load(ID)).resolves.toEqual({});
  });
});

describe('@W3-030 Schutz durch den Aufbau: kein Sync-Weg kennt die Grafik', () => {
  const REPOS = join(dirname(fileURLToPath(import.meta.url)), '..');

  it.each(['supabaseMappers.ts', 'OfflineRepository.ts', 'LocalStorageRepository.ts', 'SupabaseRepository.ts'])(
    '@W3-030 %s kennt weder den Schlüssel tournament-graphics noch den Grafik-Speicher',
    (file) => {
      const source = readFileSync(join(REPOS, file), 'utf8');

      expect(source).not.toMatch(/tournament-graphics|tournamentGraphics|TournamentGraphics/);
    },
  );
});
