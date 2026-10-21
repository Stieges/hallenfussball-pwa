/**
 * Fixrunde TB-6: schmaler Speicherweg der Einstellung „Diese Plätze müssen bei Gleichstand ausgespielt werden“
 * (`updatePlacementsToPlayOut`, Controller-Entscheidung 2026-10-21). Er schreibt nur `config.placementsToPlayOut` mit
 * Versionsprüfung und nimmt `standingDecisions` NICHT aus dem lokalen Stand mit. Zwei Geräte: Maria trägt eine Entscheidung
 * ein, Olli (veralteter Stand) ändert die Einstellung – Marias Entscheidung bleibt; ein Versionskonflikt wird sichtbar
 * (`OptimisticLockError`, im Dienst `STALE`), nie still überschrieben. Records `2026-09-27_wizard-regelinhalte` (@W2A-068, @W2A-050).
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';
import type { StandingDecision, Tournament } from '../../../types/tournament';
import { NetworkError, OptimisticLockError } from '../../errors';
import { STORAGE_KEYS } from '../../../constants/storage';
import { writePlacementsToPlayOutToCloud, writeStandingDecisionsToCloud } from '../standingDecisionsCloud';
import { PlayOutPlacesService } from '../../services/PlayOutPlacesService';
import { MemoryRepo, nikolaus, shootout } from '../../standings/__tests__/decisionTestKit';
import { DATA, league } from '../../standings/__tests__/fixtures';
import type { ITournamentRepository } from '../ITournamentRepository';

const store = new Map<string, unknown>();
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); },
    remove: (key: string) => { store.delete(key); return Promise.resolve(); },
  } as unknown as IStorageAdapter),
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));

import { LocalStorageRepository } from '../LocalStorageRepository';
import { OfflineRepository } from '../OfflineRepository';
import type { SupabaseRepository } from '../SupabaseRepository';

const MARIA: StandingDecision = { id: 'e-maria', groupId: '', teamIds: ['a', 'b'], order: ['b', 'a'], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x' };
const turnier = (version: number): Tournament =>
  ({ ...league('RKMUNO', DATA.ET_055).tournament, id: 't1', sportId: 'football-indoor', version, standingDecisions: [MARIA] });

/** Zeile der Cloud-Tabelle mit Versionslogik wie `tournaments` (Update nur bei gleicher Version). */
function cloudClient(row: { config: Record<string, unknown>; version: number | null }) {
  return {
    row,
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { config: row.config, version: row.version }, error: null }) }) }),
      update: (payload: { config: Record<string, unknown>; version: number }) => {
        // PostgREST: `.eq('version', 0)` trifft eine Zeile mit `version IS NULL` NICHT, `.is('version', null)` schon.
        const treffer = (passt: boolean) => ({
          select: () => {
            if (!passt) { return Promise.resolve({ data: [], error: null }); }
            row.config = payload.config; row.version = payload.version;
            return Promise.resolve({ data: [{ id: 't1' }], error: null });
          },
        });
        return {
          eq: () => ({
            eq: (_c: string, erwartet: number) => treffer(row.version === erwartet),
            is: (_c: string, wert: null) => treffer(row.version === wert),
          }),
        };
      },
    }),
  };
}

describe('Cloud: schreibt nur das Feld der Einstellung (@W2A-068)', () => {
  it('Marias Entscheidung im config bleibt, die Einstellung und die Version ändern sich; Gegenbeispiel: falsche Version → OptimisticLockError, nichts geändert', async () => {
    const client = cloudClient({ config: { standingDecisions: [MARIA], andere: 1, placementsToPlayOut: [1] }, version: 3 });
    await writePlacementsToPlayOutToCloud(client as never, 't1', [3, 1], 3);
    expect(client.row.config).toEqual({ standingDecisions: [MARIA], andere: 1, placementsToPlayOut: [1, 3] });
    expect(client.row.version).toBe(4);
    await expect(writePlacementsToPlayOutToCloud(client as never, 't1', [1], 3)).rejects.toBeInstanceOf(OptimisticLockError);
    expect(client.row.config.placementsToPlayOut).toEqual([1, 3]);
  });
});

describe('Cloud: Zeile ohne Version (version IS NULL, etwa vom Seed des Durchstichs)', () => {
  it('Befund Durchstich N6d: eine Zeile mit version NULL lässt sich beschreiben (Version 0 → 1), Entscheidungen bleiben; Gegenbeispiel: erwartete Version 3 → OptimisticLockError', async () => {
    const client = cloudClient({ config: { standingDecisions: [MARIA] }, version: null });
    await expect(writePlacementsToPlayOutToCloud(client as never, 't1', [1], 3)).rejects.toBeInstanceOf(OptimisticLockError);
    expect(client.row.version).toBeNull();
    await writePlacementsToPlayOutToCloud(client as never, 't1', [1, 3], 0);
    expect(client.row).toEqual({ config: { standingDecisions: [MARIA], placementsToPlayOut: [1, 3] }, version: 1 });
    // derselbe Weg für die Entscheidungen selbst
    const zweite = cloudClient({ config: { placementsToPlayOut: [1] }, version: null });
    await writeStandingDecisionsToCloud(zweite as never, 't1', [MARIA], 0);
    expect(zweite.row.version).toBe(1);
    expect(zweite.row.config).toMatchObject({ placementsToPlayOut: [1], standingDecisions: [MARIA] });
  });
});

describe('LocalStorageRepository und OfflineRepository', () => {
  const net = { online: true };
  beforeEach(() => {
    store.clear();
    store.set(STORAGE_KEYS.TOURNAMENTS, [turnier(3)]);
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('lokal: nur die Einstellung, `standingDecisions` bleiben; falsche Version → OptimisticLockError, nichts geändert', async () => {
    const local = new LocalStorageRepository();
    await expect(local.updatePlacementsToPlayOut('t1', [1, 3], 2)).rejects.toBeInstanceOf(OptimisticLockError);
    expect((await local.get('t1'))?.placementsToPlayOut).toEqual([1]); // unverändert: Voreinstellung
    await local.updatePlacementsToPlayOut('t1', [1, 3], 3);
    const t = await local.get('t1');
    expect(t?.placementsToPlayOut).toEqual([1, 3]);
    expect(t?.standingDecisions).toEqual([MARIA]);
    expect(t?.version).toBe(4);
  });

  it('Offline-Repository ohne Netz: NetworkError (offline), nichts geschrieben; mit Netz Cloud-Weg, lokale Kopie behält die Entscheidungen', async () => {
    const cloud = { updatePlacementsToPlayOut: vi.fn() as Mock };
    const local = new LocalStorageRepository();
    const repo = new OfflineRepository(local, cloud as unknown as SupabaseRepository);
    net.online = false;
    const fehler = await repo.updatePlacementsToPlayOut('t1', [1, 3], 3).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(NetworkError);
    expect(cloud.updatePlacementsToPlayOut).not.toHaveBeenCalled();
    net.online = true;
    cloud.updatePlacementsToPlayOut.mockResolvedValue(undefined);
    await repo.updatePlacementsToPlayOut('t1', [1, 3], 3);
    expect(cloud.updatePlacementsToPlayOut).toHaveBeenCalledWith('t1', [1, 3], 3);
    const nachher = await local.get('t1');
    expect(nachher).toMatchObject({ placementsToPlayOut: [1, 3], version: 4, standingDecisions: [MARIA] });
  });
});

describe('PlayOutPlacesService: zwei Geräte (Controller-Entscheidung)', () => {
  it('Maria trägt 4:3 ein, Olli (veralteter Stand, ohne Entscheidung) ändert die Einstellung: Marias Entscheidung bleibt erhalten', async () => {
    const repo = new MemoryRepo(nikolaus());
    const ollisStand = JSON.parse(JSON.stringify(repo.tournament)) as Tournament; // Olli hat vor Marias Eintrag gelesen
    expect((await repo.service(['e-maria']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(ollisStand.standingDecisions).toBeUndefined();
    const result = await new PlayOutPlacesService(repo as unknown as ITournamentRepository).update(repo.tournament.id, [1, 3]);
    expect(result).toEqual({ ok: true });
    expect(repo.tournament.placementsToPlayOut).toEqual([1, 3]);
    expect(repo.tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-maria']);
  });

  it('Gegenbeispiel: ändert sich das Turnier zwischen Lesen und Schreiben, wird einmal frisch gelesen; bleibt der Konflikt, meldet der Dienst STALE und schreibt nichts', async () => {
    const repo = new MemoryRepo(nikolaus());
    const alt = JSON.parse(JSON.stringify(repo.tournament)) as Tournament;
    repo.tournament = { ...repo.tournament, version: 2 }; // jemand hat inzwischen gespeichert
    const service = new PlayOutPlacesService(repo as unknown as ITournamentRepository);
    repo.staleReads = [alt];
    expect(await service.update(repo.tournament.id, [1, 3])).toEqual({ ok: true }); // zweiter Versuch mit frischem Stand
    expect(repo.tournament.version).toBe(3);
    repo.staleReads = [alt, alt];
    expect(await service.update(repo.tournament.id, [1, 2])).toEqual({ ok: false, code: 'STALE' });
    expect(repo.tournament.placementsToPlayOut).toEqual([1, 3]); // nichts überschrieben
  });

  it('ohne Netz: OFFLINE, nichts geschrieben; unbrauchbare Werte werden bereinigt (sortiert, ohne Doppelte)', async () => {
    const repo = new MemoryRepo(nikolaus());
    const service = new PlayOutPlacesService(repo as unknown as ITournamentRepository);
    repo.online = false;
    expect(await service.update(repo.tournament.id, [1, 3])).toEqual({ ok: false, code: 'OFFLINE' });
    expect(repo.writes).toBe(0);
    repo.online = true;
    await service.update(repo.tournament.id, [3, 1, 3, 0, 2.5]);
    expect(repo.tournament.placementsToPlayOut).toEqual([1, 3]);
  });
});
