/**
 * Paket TB, Task TB-3: Schreibwege der Gleichstands-Entscheidung in den Repositories (Plan v2 § 3.2, R-TB-5).
 * - OfflineRepository: in der Tabelle nur mit Netz (@W2A-062, F9) – ohne Netz NetworkError, nichts geschrieben, nichts
 *   eingereiht; mit Netz Cloud-Schreibweg, danach lokale Kopie mit Entscheidungen und neuer Version.
 * - LocalStorageRepository: nur `standingDecisions`, Versionsprüfung wie die Cloud (Konflikt → OptimisticLockError).
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';
import type { StandingDecision, Tournament } from '../../../types/tournament';
import { NetworkError, OptimisticLockError } from '../../errors';
import { DATA, league } from '../../standings/__tests__/fixtures';
import { STORAGE_KEYS } from '../../../constants/storage';

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

const ENTSCHEIDUNG: StandingDecision = {
  id: 'e-1', groupId: '', teamIds: ['a', 'b'], order: ['b', 'a'], kind: 'shootout', shootout: { winner: 4, loser: 3 },
  decidedBy: { userId: 'user-olli', name: 'Olli' }, decidedAt: '2026-12-06T14:32:00.000Z', basis: 'x',
};

const turnier = (version: number): Tournament =>
  ({ ...league('RKMUNO', DATA.ET_055).tournament, id: 't1', sportId: 'football-indoor', version });

describe('TB-3 Repositories: Entscheidungen schreiben', () => {
  const net = { online: true };
  beforeEach(() => {
    store.clear();
    store.set(STORAGE_KEYS.TOURNAMENTS, [turnier(3)]);
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('@W2A-062 OfflineRepository ohne Netz: NetworkError (offline), nichts zur Cloud, nichts lokal', async () => {
    const cloud = { updateStandingDecisions: vi.fn() as Mock };
    const local = new LocalStorageRepository();
    const repo = new OfflineRepository(local, cloud as unknown as SupabaseRepository);
    net.online = false;

    const fehler = await repo.updateStandingDecisions('t1', [ENTSCHEIDUNG], 3).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(NetworkError);
    expect((fehler as NetworkError).isOffline).toBe(true);
    expect(cloud.updateStandingDecisions).not.toHaveBeenCalled();
    expect((await local.get('t1'))?.standingDecisions).toBeUndefined();

    // Gegenbeispiel: mit Netz geht es zur Cloud, die lokale Kopie übernimmt Entscheidungen und Version.
    net.online = true;
    cloud.updateStandingDecisions.mockResolvedValue(undefined);
    await repo.updateStandingDecisions('t1', [ENTSCHEIDUNG], 3);
    expect(cloud.updateStandingDecisions).toHaveBeenCalledWith('t1', [ENTSCHEIDUNG], 3);
    const nachher = await local.get('t1');
    expect(nachher?.standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect(nachher?.version).toBe(4);
  });

  it('LocalStorageRepository: schreibt nur bei passender Version, sonst OptimisticLockError und nichts geändert', async () => {
    const local = new LocalStorageRepository();
    await expect(local.updateStandingDecisions('t1', [ENTSCHEIDUNG], 2)).rejects.toBeInstanceOf(OptimisticLockError);
    expect((await local.get('t1'))?.standingDecisions).toBeUndefined();

    await local.updateStandingDecisions('t1', [ENTSCHEIDUNG], 3);
    const t = await local.get('t1');
    expect(t?.standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect(t?.version).toBe(4);
  });
});
