/**
 * Paket TB Task TB-3 / GA4 A-13b-C: Schreibwege der Gleichstands-Entscheidung und des Abschlusses in den Repositories
 * (Plan v2 § 3.2, R-TB-5, R-GA4v2-1).
 * - OfflineRepository: nur mit Netz (@W2A-062, F9) – ohne Netz NetworkError, nichts geschrieben, nichts eingereiht; mit Netz
 *   `record_standing_decision`, danach lokale Kopie mit Entscheidungen, Verlauf und neuer Version.
 * - Wiederöffnen ebenso nur mit Netz. „Gruppe abschließen“ geht seit A-15c auch ohne Netz (sofort lokal, nachgereicht über die
 *   Warteschlange; Anforderung @W2A-062 am 23.10. geändert) – Einzelheiten in `groupCompletion.offline.test.ts`.
 * - LocalStorageRepository: Versionsprüfung wie die Cloud (Konflikt → `rejected STALE`), Abschluss und Wiederöffnen lokal.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';
import type { StandingDecision, Tournament } from '../../../types/tournament';
import { NetworkError } from '../../errors';
import { DATA, league } from '../../standings/__tests__/fixtures';
import type { CompleteGroupRequest, RecordDecisionRequest } from '../groupCompletionCloud';
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
import { testUuid } from '../../../test/testIds';

/** Team-IDs sind UUIDs (wie am Server, `standing_decision_valid`, A-13b-S Punkt 7). */
const TEAM_A = testUuid(1);
const TEAM_B = testUuid(2);

const ENTSCHEIDUNG: StandingDecision = {
  id: 'e-1', groupId: '', teamIds: [TEAM_A, TEAM_B], order: [TEAM_B, TEAM_A], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x',
};

const turnier = (version: number): Tournament =>
  ({ ...league('RKMUNO', DATA.ET_055).tournament, id: 't1', sportId: 'football-indoor', version });

const ANNAHME: RecordDecisionRequest = { action: 'decide', decision: ENTSCHEIDUNG };

const ABSCHLUSS: CompleteGroupRequest = { groupId: '', ranking: [TEAM_A, TEAM_B], openRanks: [], tieDecisions: [], knownDecisionIds: [], expectedState: [] };

describe('TB-3 Repositories: Entscheidungen schreiben', () => {
  const net = { online: true };
  beforeEach(() => {
    store.clear();
    store.set(STORAGE_KEYS.TOURNAMENTS, [turnier(3)]);
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  function offlineRepo() {
    const cloud = {
      recordStandingDecision: vi.fn() as Mock, completeGroup: vi.fn() as Mock, reopenGroup: vi.fn() as Mock,
      readBracketLog: vi.fn().mockResolvedValue(undefined) as Mock,
      getWithMatchRevisions: vi.fn().mockResolvedValue(null) as Mock,
    };
    const local = new LocalStorageRepository();
    return { cloud, local, repo: new OfflineRepository(local, cloud as unknown as SupabaseRepository) };
  }

  it('@W2A-062 OfflineRepository ohne Netz: NetworkError (offline), nichts zur Cloud, nichts lokal', async () => {
    const { cloud, local, repo } = offlineRepo();
    net.online = false;

    const fehler = await repo.recordStandingDecision('t1', ANNAHME, 3).catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(NetworkError);
    expect((fehler as NetworkError).isOffline).toBe(true);
    expect(cloud.recordStandingDecision).not.toHaveBeenCalled();
    expect((await local.get('t1'))?.standingDecisions).toBeUndefined();

    // Gegenbeispiel: mit Netz geht es zur Cloud, die lokale Kopie übernimmt Entscheidungen, Verlauf und Version.
    net.online = true;
    cloud.recordStandingDecision.mockResolvedValue({ status: 'ok', alreadyApplied: false, version: 4 });
    cloud.readBracketLog.mockResolvedValue([{ id: 1, kind: 'standing_decision', detail: { id: 'e-1' }, actorName: 'Olli', at: '2026-12-06T14:32:00Z' }]);
    expect(await repo.recordStandingDecision('t1', ANNAHME, 3)).toEqual({ status: 'ok', alreadyApplied: false, version: 4 });
    expect(cloud.recordStandingDecision).toHaveBeenCalledWith('t1', ANNAHME, 3);
    const nachher = await local.get('t1');
    expect(nachher?.standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect(nachher?.version).toBe(4);
    expect(nachher?.decisionLog?.[0]).toMatchObject({ actorName: 'Olli' });
  });

  it('eine abgelehnte Entscheidung (STALE) verändert die lokale Kopie nicht', async () => {
    const { cloud, local, repo } = offlineRepo();
    cloud.recordStandingDecision.mockResolvedValue({ status: 'rejected', code: 'STALE', version: 5 });
    expect(await repo.recordStandingDecision('t1', ANNAHME, 3)).toEqual({ status: 'rejected', code: 'STALE', version: 5 });
    expect((await local.get('t1'))?.standingDecisions).toBeUndefined();
    expect((await local.get('t1'))?.version).toBe(3);
  });

  it('@W2A-070 Zurücknehmen entfernt die Entscheidung aus der lokalen Kopie', async () => {
    const { cloud, local, repo } = offlineRepo();
    cloud.recordStandingDecision.mockResolvedValue({ status: 'ok', alreadyApplied: false, version: 4 });
    await repo.recordStandingDecision('t1', ANNAHME, 3);
    cloud.recordStandingDecision.mockResolvedValue({ status: 'ok', alreadyApplied: false, version: 5 });
    await repo.recordStandingDecision('t1', { action: 'withdraw', decision: { id: 'e-1' } }, 4);
    expect((await local.get('t1'))?.standingDecisions).toEqual([]);
    expect((await local.get('t1'))?.version).toBe(5);
  });

  it('@TM-115 „Gruppe abschließen“ ohne Netz gilt sofort (eingereiht, Cloud nicht gerufen); Wiederöffnen ohne Netz: NetworkError', async () => {
    const { cloud, local, repo } = offlineRepo();
    net.online = false;
    expect(await repo.completeGroup('t1', ABSCHLUSS)).toMatchObject({ status: 'ok', queued: true });
    expect((await local.get('t1'))?.groupCompletions).toEqual([expect.objectContaining({ groupId: '', unsent: true })]);
    expect(repo.mutationQueue.getPendingCount()).toBe(1);
    const fehler = await repo.reopenGroup('t1', '', 'Ergebnis falsch').catch((e: unknown) => e);
    expect(fehler).toBeInstanceOf(NetworkError);
    expect((fehler as NetworkError).isOffline).toBe(true);
    expect(cloud.completeGroup).not.toHaveBeenCalled();
    expect(cloud.reopenGroup).not.toHaveBeenCalled();
    repo.mutationQueue.dispose();
  });

  it('@TM-046 mit Netz geht „Gruppe abschließen“ an die Cloud; eine Ablehnung wird unverändert weitergegeben und holt nichts nach', async () => {
    const { cloud, repo } = offlineRepo();
    cloud.completeGroup.mockResolvedValue({ status: 'rejected', code: 'OPEN_MATCHES', open: 1 });
    expect(await repo.completeGroup('t1', ABSCHLUSS)).toEqual({ status: 'rejected', code: 'OPEN_MATCHES', open: 1 });
    expect(cloud.completeGroup).toHaveBeenCalledWith('t1', ABSCHLUSS);
    expect(cloud.getWithMatchRevisions).not.toHaveBeenCalled();
    // Gegenbeispiel: nach einem Erfolg liest die App den Cloud-Stand frisch (Abschluss, besetzte Folgespiele)
    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [] });
    await repo.completeGroup('t1', ABSCHLUSS);
    expect(cloud.getWithMatchRevisions).toHaveBeenCalledWith('t1');
  });

  it('LocalStorageRepository: Entscheidung nur bei passender Version, sonst rejected STALE und nichts geändert', async () => {
    const local = new LocalStorageRepository();
    expect(await local.recordStandingDecision('t1', ANNAHME, 2)).toMatchObject({ status: 'rejected', code: 'STALE', version: 3 });
    expect((await local.get('t1'))?.standingDecisions).toBeUndefined();

    expect(await local.recordStandingDecision('t1', ANNAHME, 3)).toEqual({ status: 'ok', alreadyApplied: false, version: 4 });
    const t = await local.get('t1');
    expect(t?.standingDecisions).toEqual([ENTSCHEIDUNG]);
    expect(t?.version).toBe(4);
  });

  it('@W2A-070 LocalStorageRepository: nach dem Abschluss kein Zurücknehmen (WITHDRAW_NOT_ALLOWED), nach dem Wiederöffnen wieder', async () => {
    const local = new LocalStorageRepository();
    await local.recordStandingDecision('t1', ANNAHME, 3);
    expect(await local.completeGroup('t1', ABSCHLUSS)).toMatchObject({ status: 'ok' });
    expect((await local.get('t1'))?.groupCompletions).toEqual([expect.objectContaining({ groupId: '', ranking: [TEAM_A, TEAM_B], stale: false })]);
    expect(await local.recordStandingDecision('t1', { action: 'withdraw', decision: { id: 'e-1' } }, 4)).toMatchObject({ status: 'rejected', code: 'WITHDRAW_NOT_ALLOWED' });

    expect(await local.reopenGroup('t1', '', 'Ergebnis falsch')).toEqual({ status: 'ok' });
    expect((await local.get('t1'))?.groupCompletions?.[0].reopenedAt).toEqual(expect.any(String));
    expect(await local.recordStandingDecision('t1', { action: 'withdraw', decision: { id: 'e-1' } }, 4)).toMatchObject({ status: 'ok' });
  });

  it('@TM-099 Wiederöffnen ohne Abschluss: rejected NOT_COMPLETED', async () => {
    const local = new LocalStorageRepository();
    expect(await local.reopenGroup('t1', '', 'x')).toEqual({ status: 'rejected', code: 'NOT_COMPLETED' });
  });

  it('@TM-057 Jeder gegen jeden: ein Abschluss unter „all“ gilt als Gruppe „“ (eine Abbildung)', async () => {
    const local = new LocalStorageRepository();
    await local.completeGroup('t1', { ...ABSCHLUSS, groupId: 'all' });
    expect((await local.get('t1'))?.groupCompletions?.map((c) => c.groupId)).toEqual(['']);
  });

  it('@TM-116 adoptCloudRead (Feldweg) schreibt Abschlüsse und Verlauf in die lokale Kopie – Version und Spiele bleiben', async () => {
    const local = new LocalStorageRepository();
    const vorher = await local.get('t1');
    await local.adoptCloudRead('t1', () => ({
      revisions: new Map(),
      serverTables: {
        groupCompletions: [{ groupId: '', ranking: [TEAM_A, TEAM_B], openRanks: [], stale: false, completedAt: '2026-12-06T10:00:00Z' }],
        decisionLog: [{ id: 1, kind: 'complete_group', detail: {}, actorName: 'Olli', at: '2026-12-06T10:00:00Z' }],
      },
    }));
    const nachher = await local.get('t1');
    expect(nachher?.groupCompletions?.[0].groupId).toBe('');
    expect(nachher?.decisionLog?.[0].actorName).toBe('Olli');
    expect(nachher?.version).toBe(vorher?.version);
    expect(nachher?.matches).toEqual(vorher?.matches);
  });
});
