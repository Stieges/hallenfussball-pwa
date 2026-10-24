/**
 * @W2A-077 (Record `2026-09-27_wizard-regelinhalte`, R2 PR 1, Probe K5 im Nachreview Version-Fix):
 *   Gegeben Olli hat eben auf seinem Gerät das Strafstoßschießen 4:3 für DJK Kammer eingetragen
 *   Und auf seinem Gerät ist noch eine Ansicht des Turniers von vor dieser Entscheidung offen
 *   Wenn Olli aus dieser älteren Ansicht speichert
 *   Dann übernimmt die App das Speichern nicht, Ollis Entscheidung bleibt bestehen
 *   Und sie nennt als Grund „Nicht übernommen: Der Stand hat sich inzwischen durch deine eigene Entscheidung geändert“
 *   Und sie nennt kein anderes Gerät
 * Hier: Repository + Warteschlange (Merkmal `ownDecision` am abgelegten Eintrag); der Text selbst in
 * `SyncFailedList.eigeneEntscheidung.test.tsx`. Aufbau wie `OfflineRepository.bestaetigteVersion.test.ts`.
 * Gegenbeispiel: hat jemand anders (Maria) entschieden, bleibt es der Konflikt „anderes Gerät“.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { CompleteGroupRequest, CompleteGroupResult, RecordDecisionRequest, RecordDecisionResult } from '../groupCompletionCloud';

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
import { flush, liveCup } from '../../../test/queueGuardFixtures';
import { StandingDecisionService } from '../../services/StandingDecisionService';
import { nikolaus, shootout } from '../../standings/__tests__/decisionTestKit';
import type { Tournament } from '../../models/types';

const OLLI = 'olli';

const revisions = (): Map<string, number> => new Map([['spiel-4', 1], ['hf-1', 1]]);


const DECISION = { id: 'e-1', groupId: '', teamIds: ['a', 'b'], order: ['b', 'a'], kind: 'shootout' as const, shootout: { winner: 4, loser: 3 }, basis: 'x' };

describe('@W2A-077 abgelehntes Speichern nach der eigenen Entscheidung nennt kein anderes Gerät', () => {
  const repos: OfflineRepository[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = OLLI;
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    for (const r of repos.splice(0)) { r.mutationQueue.dispose(); }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Fake-Cloud mit `record_standing_decision` (CAS wie der Server). */
  function cloudMitEntscheidung() {
    const cloud = createFakeCloud({ tournament: liveCup(7), revisions: revisions() });
    Object.assign(cloud.fake, {
      recordStandingDecision: vi.fn(async (_id: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> => {
        const current = (await cloud.fake.get('T'))!;
        if ((current.version ?? 0) !== expectedVersion) { return { status: 'rejected', code: 'STALE', version: current.version ?? 0 }; }
        const standingDecisions = request.action === 'decide' ? [...(current.standingDecisions ?? []), request.decision] : [];
        cloud.setState({ tournament: { ...current, standingDecisions, version: expectedVersion + 1 }, revisions: revisions() });
        return { status: 'ok', alreadyApplied: false, version: expectedVersion + 1 };
      }),
      readBracketLog: vi.fn(async () => undefined),
      // Wie `complete_group`: nur eine neue Entscheidung zählt die Version (Review #368 H1)
      completeGroup: vi.fn(async (_id: string, request: CompleteGroupRequest): Promise<CompleteGroupResult> => {
        const current = (await cloud.fake.get('T'))!;
        const known = new Set(request.knownDecisionIds);
        const fresh = request.tieDecisions.filter((d) => !known.has(d.id));
        const version = (current.version ?? 0) + (fresh.length > 0 ? 1 : 0);
        cloud.setState({ tournament: { ...current, standingDecisions: [...(current.standingDecisions ?? []), ...fresh], version }, revisions: revisions() });
        return { status: 'ok', alreadyCompleted: false, changed: [], tournamentVersion: version };
      }),
    });
    return cloud;
  }

  async function olliMitAlterAnsicht() {
    stores.raw.set('tournaments', [{ ...liveCup(7), ownerId: OLLI }]);
    const cloud = cloudMitEntscheidung();
    const olli = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, OLLI);
    repos.push(olli);
    await olli.get('T', { fresh: true });
    const alteAnsicht = (await olli.get('T'))!; // Stand von vor der Entscheidung (Version 7)
    return { cloud, olli, alteAnsicht };
  }

  it('@W2A-077 Olli entscheidet (7 → 8), speichert dann aus der Ansicht von Version 7: nicht übernommen, Grund eigene Entscheidung, Entscheidung bleibt', async () => {
    const { cloud, olli, alteAnsicht } = await olliMitAlterAnsicht();
    await olli.recordStandingDecision('T', { action: 'decide', decision: DECISION }, 7);

    await olli.save({ ...alteAnsicht, title: 'Aus der alten Ansicht' });
    await flush();

    const server = (await cloud.fake.get('T'))!;
    expect(server.title).not.toBe('Aus der alten Ansicht'); // übernimmt das Speichern nicht
    expect(server.standingDecisions).toEqual([DECISION]); // Ollis Entscheidung bleibt
    const failed = olli.mutationQueue.getFailedMutations();
    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ conflict: true, ownDecision: true });
  });

  it('@W2A-077 @W2A-074 Entscheidung im Kasten der Tabelle (schließt die Gruppe ab, 7 → 8), danach Speichern aus der alten Ansicht: Grund eigene Entscheidung', async () => {
    const { olli, alteAnsicht } = await olliMitAlterAnsicht();
    await olli.completeGroup('T', { groupId: '', ranking: [], openRanks: [], tieDecisions: [DECISION], knownDecisionIds: [], expectedState: [] });

    await olli.save({ ...alteAnsicht, title: 'Aus der alten Ansicht' });
    await flush();

    expect(olli.mutationQueue.getFailedMutations()[0]).toMatchObject({ conflict: true, ownDecision: true });
  });

  it('@W2A-077 Gegenbeispiel: hat Maria (anderes Gerät) entschieden, bleibt es der Konflikt „anderes Gerät“ (kein Merkmal der eigenen Entscheidung)', async () => {
    const { cloud, olli, alteAnsicht } = await olliMitAlterAnsicht();
    const recordAtServer = (cloud.fake as unknown as { recordStandingDecision: (id: string, r: RecordDecisionRequest, v: number) => Promise<RecordDecisionResult> }).recordStandingDecision;
    await recordAtServer('T', { action: 'decide', decision: DECISION }, 7); // Marias Gerät schreibt direkt am Server

    await olli.save({ ...alteAnsicht, title: 'Aus der alten Ansicht' });
    await flush();

    const failed = olli.mutationQueue.getFailedMutations();
    expect(failed).toHaveLength(1);
    expect(failed[0].conflict).toBe(true);
    expect(failed[0].ownDecision).toBeUndefined();
  });
});

/**
 * Review-Auflage B4 / Review #382 M1: die echte Kette auf demselben Gerät – entscheiden (7 → 8) über `StandingDecisionService`
 * und das echte `OfflineRepository` (zieht die bestätigte Version nach), danach sofort zurücknehmen (@W2A-070) → gelingt
 * gegen 8, ohne Konflikt. Nikolaus-Lage (Petting/Otting gleich auf Platz 3, Platz teilen erlaubt wie Strafstoß).
 */
describe('@W2A-070 entscheiden und sofort auf demselben Gerät zurücknehmen (bestätigte Version folgt der eigenen Kette)', () => {
  const repos: OfflineRepository[] = [];

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    stores.raw.clear();
    stores.queue.clear();
    session.userId = OLLI;
    net.online = true;
    vi.stubGlobal('navigator', { get onLine() { return net.online; } });
  });

  afterEach(() => {
    for (const r of repos.splice(0)) { r.mutationQueue.dispose(); }
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('@W2A-070 Strafstoßschießen 4:3 eintragen (Basis 7), dann zurücknehmen: beide gelingen, geprüft gegen 7 und 8', async () => {
    const start: Tournament = { ...nikolaus(), id: 'T', ownerId: OLLI, version: 7 };
    const revs = new Map(start.matches.map((m) => [m.id, 1]));
    stores.raw.set('tournaments', [start]);
    const cloud = createFakeCloud({ tournament: start, revisions: revs });
    const expected: number[] = [];
    Object.assign(cloud.fake, {
      recordStandingDecision: vi.fn(async (_id: string, request: RecordDecisionRequest, expectedVersion: number): Promise<RecordDecisionResult> => {
        expected.push(expectedVersion);
        const current = (await cloud.fake.get('T'))!;
        if ((current.version ?? 0) !== expectedVersion) { return { status: 'rejected', code: 'STALE', version: current.version ?? 0 }; }
        const others = (current.standingDecisions ?? []).filter((d) => d.id !== request.decision.id);
        const standingDecisions = request.action === 'decide' ? [...others, request.decision] : others;
        cloud.setState({ tournament: { ...current, standingDecisions, version: expectedVersion + 1 }, revisions: revs });
        return { status: 'ok', alreadyApplied: false, version: expectedVersion + 1 };
      }),
      readBracketLog: vi.fn(async () => undefined),
    });
    const olli = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, OLLI);
    repos.push(olli);
    await olli.get('T', { fresh: true });
    const service = new StandingDecisionService(olli, { groupClosed: () => false, newId: () => 'e-olli' });

    const decided = await service.decide('T', shootout('D', 'P', 4, 3));
    expect(decided.ok).toBe(true);
    expect(await service.withdraw('T', 'e-olli')).toEqual({ ok: true });
    await flush();

    expect(expected).toEqual([7, 8]);
    expect((await cloud.fake.get('T'))?.standingDecisions ?? []).toEqual([]);
  });
});
