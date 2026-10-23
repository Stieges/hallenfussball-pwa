/**
 * A-15c „Gruppe abschließen / Gleichstand ohne Netz“ – Repository und Warteschlange zusammen (echte `OfflineRepository`,
 * `LocalStorageRepository`, `MutationQueue`; nur der Server ist eine Attrappe mit den Antworten von `complete_group`).
 * Aus dem Gherkin:
 * - @W2A-062 (Strafstoßschießen | „Platz teilen“): ohne Netz zeigt Ollis Gerät sofort die Entscheidung und die Gruppe als
 *   abgeschlossen; mit Netz wird nachgereicht; hat jemand anders entschieden oder ein Ergebnis geändert → „Klärung nötig“.
 * - @TM-146 Z1–Z3 (Hallencup Nord, 4:3 für TSV West, Halbfinale 2 Gast „TSV West“), @TM-147 Z1–Z5 (Nikolaus, Platz teilen).
 * - @TM-115 Z1 / @TM-116 Z1 (Abschluss ohne Gleichstand), @TM-117 (nach dem Konflikt der Stand des Servers).
 * Was der Server bei welcher Lage antwortet (ok | clarification:CODE), prüft `scripts/group-completion-check.sh` (P-7, RT-2,
 * RT-10); hier zählt, was das Gerät mit der Antwort macht.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { IStorageAdapter } from '../../storage/IStorageAdapter';
import type { Tournament } from '../../../types/tournament';

const store = new Map<string, unknown>();
vi.mock('../../storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(store.get(key) ?? null),
    set: (key: string, value: unknown) => { store.set(key, value); return Promise.resolve(); },
    remove: (key: string) => { store.delete(key); return Promise.resolve(); },
  } as unknown as IStorageAdapter),
}));
const queueStore = new Map<string, string>();
vi.mock('../../utils/safeStorage', () => ({
  safeLocalStorage: {
    setItemPersisted: vi.fn((key: string, value: string) => { queueStore.set(key, value); return true; }),
    getItem: vi.fn((key: string) => queueStore.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { queueStore.set(key, value); }),
    removeItem: vi.fn((key: string) => { queueStore.delete(key); }),
    getIsAvailable: vi.fn(() => true),
  },
}));
vi.mock('../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ supabase: null, isSupabaseConfigured: false }));
vi.mock('../../match/client/guestEngineEntries', () => ({ hasGuestEngineEntries: vi.fn(async () => false) }));

import { LocalStorageRepository } from '../LocalStorageRepository';
import { OfflineRepository } from '../OfflineRepository';
import type { SupabaseRepository } from '../SupabaseRepository';
import type { CompleteGroupRequest, CompleteGroupResult } from '../groupCompletionCloud';
import { STORAGE_KEYS } from '../../../constants/storage';
import { HC, NK, matchLabelled, tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';
import { draftToDecision, planCompletion } from '../../services/groupCompletionPlan';
import { activeCompletion } from '../../standings/groupCompletions';
import { groupState } from '../../services/GroupCompletionService';
import { rankTournamentGroup } from '../../standings/tournamentTable';
import { isPendingSlot, slotTeamId } from '../../models/matchSlot';
import type { DecisionDraft } from '../../standings/decisions';

const net = { online: true };

/** Server-Stand vor Ollis Abschluss (Version 5, Spielplan schon aus der Cloud bekannt). */
const hallencup = (): Tournament => ({ ...tournamentFromFixture('hallencup'), version: 5, serverVersion: 5, changeRevision: 3 });
const nikolaus = (): Tournament => ({ ...tournamentFromFixture('nikolaus'), placementsToPlayOut: [1, 2], version: 5, serverVersion: 5, changeRevision: 3 });

const WEST_4_3: DecisionDraft = { groupId: 'A', teamIds: [HC.sued, HC.west], order: [HC.west, HC.sued], kind: 'shootout', shootout: { winner: 4, loser: 3 } };
const PLATZ_TEILEN: DecisionDraft = { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' };

/** Anfrage wie aus dem Dialog: Plan mit der Eingabe des Kastens (`useGroupCompletion` → `planCompletion`). */
function requestOf(t: Tournament, groupId: string, draft: DecisionDraft | null, id = 'e-olli'): CompleteGroupRequest {
  const plan = planCompletion(t, groupId, draft === null ? [] : [draftToDecision(t, draft, id)]);
  if (plan.code !== 'READY') {
    throw new Error(`Testlage: Plan ${plan.code}`);
  }
  return plan.request;
}

interface Cloud {
  completeGroup: Mock<(id: string, request: CompleteGroupRequest) => Promise<CompleteGroupResult>>;
  getWithMatchRevisions: Mock;
  save: Mock;
  readBracketLog: Mock;
  recordStandingDecision: Mock;
  reopenGroup: Mock;
}

let repo: OfflineRepository | undefined;

function setup(server: Tournament) {
  store.set(STORAGE_KEYS.TOURNAMENTS, [server]);
  const cloud: Cloud = {
    completeGroup: vi.fn(),
    getWithMatchRevisions: vi.fn(() => Promise.resolve({ tournament: server, matchRevisions: new Map<string, number>() })),
    save: vi.fn(() => Promise.resolve(7)),
    readBracketLog: vi.fn(() => Promise.resolve(undefined)),
    recordStandingDecision: vi.fn(),
    reopenGroup: vi.fn(),
  };
  const local = new LocalStorageRepository();
  repo = new OfflineRepository(local, cloud as unknown as SupabaseRepository);
  return { cloud, local, repo, queue: repo.mutationQueue };
}

const local$ = async (local: LocalStorageRepository, id: string): Promise<Tournament> => {
  const t = await local.get(id);
  if (t === null) { throw new Error('lokale Kopie fehlt'); }
  return t;
};

beforeEach(() => {
  store.clear();
  queueStore.clear();
  net.online = true;
  vi.stubGlobal('navigator', { get onLine() { return net.online; } });
});
afterEach(() => {
  repo?.mutationQueue.dispose();
  repo = undefined;
  vi.unstubAllGlobals();
});

describe('@W2A-062 @TM-146 Z1 ohne Netz: Strafstoßschießen im Kasten gilt sofort und wird nachgereicht', () => {
  it('sofort: Gruppe A abgeschlossen („noch nicht gesendet“), 4:3 für West eingetragen, Halbfinale 2 Gast TSV West; nichts zum Server', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;

    const result = await repo.completeGroup(server.id, requestOf(server, 'A', WEST_4_3));

    expect(result).toMatchObject({ status: 'ok', alreadyCompleted: false, queued: true });
    expect(cloud.completeGroup).not.toHaveBeenCalled();
    const t = await local$(local, server.id);
    expect(groupState(t, 'A')).toBe('completed');
    expect(activeCompletion(t, 'A')).toMatchObject({ ranking: [HC.nord, HC.west, HC.sued, HC.ost], unsent: true });
    expect(t.standingDecisions).toEqual([expect.objectContaining({ id: 'e-olli', kind: 'shootout', order: [HC.west, HC.sued], shootout: { winner: 4, loser: 3 } })]);
    expect(slotTeamId(matchLabelled(t, '2. Halbfinale').slotB)).toBe(HC.west);
    expect(t.version).toBe(5); // die Version zählt nur der Server
    expect(queue.getPendingCount()).toBe(1);
  });

  it('sobald wieder Netz da ist: complete_group aus der Warteschlange (fromQueue) mit Abschluss und Entscheidung; danach keine Marke mehr', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;
    const request = requestOf(server, 'A', WEST_4_3);
    await repo.completeGroup(server.id, request);
    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], tournamentVersion: 6 });

    net.online = true;
    await queue.process();

    expect(cloud.completeGroup).toHaveBeenCalledTimes(1);
    expect(cloud.completeGroup).toHaveBeenCalledWith(server.id, { ...request, fromQueue: true });
    expect(cloud.completeGroup.mock.calls[0][1].tieDecisions).toEqual([expect.objectContaining({ id: 'e-olli', kind: 'shootout' })]);
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
    const t = await local$(local, server.id);
    expect(activeCompletion(t, 'A')?.unsent).toBeUndefined();
    expect(t.serverVersion).toBe(6); // eigene Basis + 1 bestätigt
  });
});

describe('@W2A-062 Z2 @TM-147 Z1 ohne Netz: „Platz teilen“ im Kasten (Nikolaus)', () => {
  it('sofort: Gruppe abgeschlossen mit TSV Petting und DJK Otting beide auf Platz 3; nachgereicht als Annahme mit dem Abschluss', async () => {
    const server = nikolaus();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;

    await repo.completeGroup(server.id, requestOf(server, '', PLATZ_TEILEN));

    const t = await local$(local, server.id);
    expect(groupState(t, '')).toBe('completed');
    expect(activeCompletion(t, '')?.unsent).toBe(true);
    const rows = rankTournamentGroup(t, '').rows;
    expect(rows.filter((r) => [NK.petting, NK.otting].includes(r.team.id)).map((r) => r.place)).toEqual([3, 3]);
    expect(cloud.completeGroup).not.toHaveBeenCalled();

    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], tournamentVersion: 6 });
    net.online = true;
    await queue.process();
    expect(cloud.completeGroup.mock.calls[0][1]).toMatchObject({ groupId: '', fromQueue: true, tieDecisions: [expect.objectContaining({ kind: 'shared' })] });
    expect(queue.getFailedCount()).toBe(0);
  });
});

describe('@W2A-062 Z3 @TM-146 Z2/Z3 @TM-147 Z2–Z4 @TM-117 Uneinigkeit → „Klärung nötig“ statt still überschreiben', () => {
  it.each([
    { zeile: '@TM-146 Z2 Maria hat ein Ergebnis von Gruppe A korrigiert', antwort: { status: 'clarification', code: 'STALE_VERSION', clarificationId: 11 } },
    { zeile: '@TM-146 Z3 Maria hat Gruppe A mit 5:4 für SV Süd abgeschlossen', antwort: { status: 'clarification', code: 'DECIDED_ELSEWHERE', clarificationId: 12 } },
    { zeile: '@TM-147 Z3 Maria hat Platz 3 angehakt (Annahme nicht mehr erlaubt)', antwort: { status: 'clarification', code: 'SHARED_NOT_ALLOWED', clarificationId: 13 } },
    { zeile: 'Server lehnt ohne Klärung ab (Tabelle passt nicht mehr)', antwort: { status: 'rejected', code: 'RANKING_MISMATCH' } },
  ] as const)('$zeile: Eintrag in der Fehlerliste als Konflikt, kein neuer Versuch, das Gerät zeigt danach den Stand des Servers', async ({ antwort }) => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;
    await repo.completeGroup(server.id, requestOf(server, 'A', WEST_4_3));
    cloud.completeGroup.mockResolvedValue(antwort);

    net.online = true;
    await queue.process();
    await queue.process(); // ein weiterer Anstoß sendet nichts erneut

    expect(cloud.completeGroup).toHaveBeenCalledTimes(1);
    expect(queue.getPendingCount()).toBe(0);
    const [failed] = queue.getFailedMutations();
    expect(failed).toMatchObject({ type: 'COMPLETE_GROUP', conflict: true });
    expect(failed.payload).toMatchObject({ request: { tieDecisions: [expect.objectContaining({ id: 'e-olli' })] } });
    // @TM-117: das Gerät holt den Stand des Servers (kein Abschluss, keine Entscheidung, Halbfinale 2 wartet auf „Zweiter A“)
    await vi.waitFor(async () => {
      const t = await local$(local, server.id);
      expect(activeCompletion(t, 'A')).toBeUndefined();
    });
    const t = await local$(local, server.id);
    expect(t.standingDecisions ?? []).toEqual([]);
    expect(isPendingSlot(matchLabelled(t, '2. Halbfinale').slotB)).toBe(true);
  });

  it('@TM-147 Z5 Gegenbeispiel: Server nimmt an (Platz 5 angehakt ist kein Konflikt) → kein Eintrag in der Fehlerliste', async () => {
    const server = nikolaus();
    const { cloud, repo, queue } = setup(server);
    net.online = false;
    await repo.completeGroup(server.id, requestOf(server, '', PLATZ_TEILEN));
    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], tournamentVersion: 7 });
    net.online = true;
    await queue.process();
    expect(queue.getFailedCount()).toBe(0);
    expect(queue.needsCloudCopy(server.id)).toBe(false);
  });
});

describe('Nachreichen ist wiederholbar (idempotent)', () => {
  it('Antwort ging verloren (Netzfehler) → zweiter Versand; der Server meldet „schon so abgeschlossen“ → erledigt, kein Konflikt', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;
    const request = requestOf(server, 'A', WEST_4_3);
    await repo.completeGroup(server.id, request);
    cloud.completeGroup
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ status: 'ok', alreadyCompleted: true, changed: [] });

    net.online = true;
    await queue.process();
    expect(queue.getPendingCount()).toBe(1); // vorübergehend: bleibt stehen, zählt nicht
    await queue.process();

    expect(cloud.completeGroup).toHaveBeenCalledTimes(2);
    expect(cloud.completeGroup.mock.calls[1][1]).toEqual(cloud.completeGroup.mock.calls[0][1]);
    expect(queue.getPendingCount()).toBe(0);
    expect(queue.getFailedCount()).toBe(0);
    expect(activeCompletion(await local$(local, server.id), 'A')?.unsent).toBeUndefined();
  });
});

describe('Gegenbeispiel mit Netz: unverändert direkt zum Server', () => {
  it('@TM-046 online: complete_group ohne Warteschlange (kein fromQueue), nichts eingereiht, keine Marke', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    const request = requestOf(server, 'A', WEST_4_3);
    cloud.completeGroup.mockResolvedValue({ status: 'rejected', code: 'STALE_VERSION' });

    expect(await repo.completeGroup(server.id, request)).toEqual({ status: 'rejected', code: 'STALE_VERSION' });
    expect(cloud.completeGroup).toHaveBeenCalledWith(server.id, request);
    expect(queue.getPendingCount()).toBe(0);
    expect(activeCompletion(await local$(local, server.id), 'A')).toBeUndefined();
  });

  it('Wiederöffnen bleibt nur mit Netz (nicht Teil von A-15c): ohne Netz NetworkError, nichts eingereiht', async () => {
    const server = hallencup();
    const { cloud, repo, queue } = setup(server);
    net.online = false;
    await expect(repo.reopenGroup(server.id, 'A', 'Ergebnis falsch')).rejects.toMatchObject({ isOffline: true });
    expect(cloud.reopenGroup).not.toHaveBeenCalled();
    expect(queue.getPendingCount()).toBe(0);
  });
});

describe('Der wartende Abschluss bleibt sichtbar, bis der Server antwortet', () => {
  it('ein Cloud-Abruf vor dem Versand nimmt den lokalen Abschluss nicht weg; Gegenbeispiel: nach dem Versand folgen die Abschlüsse der Cloud', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;
    await repo.completeGroup(server.id, requestOf(server, 'A', WEST_4_3));
    cloud.getWithMatchRevisions.mockResolvedValue({ tournament: { ...server, groupCompletions: [] }, matchRevisions: new Map() });

    net.online = true;
    await repo.get(server.id, { fresh: true });
    expect(activeCompletion(await local$(local, server.id), 'A')?.unsent).toBe(true);

    const vomServer = { groupId: 'A', ranking: [HC.nord, HC.west, HC.sued, HC.ost], openRanks: [], stale: false, completedAt: '2026-12-06T10:00:00Z' };
    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [] });
    cloud.getWithMatchRevisions.mockResolvedValue({ tournament: { ...server, groupCompletions: [vomServer] }, matchRevisions: new Map() });
    await queue.process();
    await repo.get(server.id, { fresh: true });
    expect(activeCompletion(await local$(local, server.id), 'A')).toEqual(vomServer);
  });
});

describe('Eigene Speicherung nach dem Abschluss ohne Netz ist kein Konflikt (wie @FU-110)', () => {
  it('Server zählt nur Ollis Entscheidung (5 → 6): die wartende Speicherung prüft gegen 6', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;
    await repo.completeGroup(server.id, requestOf(server, 'A', WEST_4_3));
    await repo.save({ ...(await local$(local, server.id)), title: 'Hallencup Nord 2026' });
    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], tournamentVersion: 6 });

    net.online = true;
    await queue.process();
    expect(cloud.save).toHaveBeenCalledTimes(1);
    expect((cloud.save.mock.calls[0][0] as Tournament).version).toBe(6);
  });

  it('Gegenbeispiel: hat am Server noch jemand gespeichert (5 → 7), prüft die Speicherung weiter gegen 5 (nichts still überschreiben)', async () => {
    const server = hallencup();
    const { cloud, local, repo, queue } = setup(server);
    net.online = false;
    await repo.completeGroup(server.id, requestOf(server, 'A', WEST_4_3));
    await repo.save({ ...(await local$(local, server.id)), title: 'Hallencup Nord 2026' });
    cloud.completeGroup.mockResolvedValue({ status: 'ok', alreadyCompleted: false, changed: [], tournamentVersion: 7 });

    net.online = true;
    await queue.process();
    expect((cloud.save.mock.calls[0][0] as Tournament).version).toBe(5);
  });
});
