/**
 * A-08f3a2 (Plan `task-A-08f3-plan.md` v4, M1): Übergangssperre der Schnelleingabe für server-geführte Spiele.
 * Nach dem Feldweg (A-08f3a) steht ein fremdes Engine-Spiel lokal als „läuft 1:0“ (Revision 3). Die heutige Sperre
 * (`isEngineControlledScoreChange`) erkennt es daran nicht mehr; die Vereinigung mit den server-geführten Spielen
 * hält das heutige Verhalten bis e2. Befund C-SCHNELLEINGABE-SPERRE-STATUS; Szenarien: keine neuen.
 * Echtes `OfflineRepository` + `LocalStorageRepository`, Fake-Storage, Fake-Cloud.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament, Match } from '../../../../types/tournament';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
const repos = vi.hoisted(() => ({ tournamentRepository: null as object | null }));

vi.mock('../../../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../../../lib/supabase', () => ({
  isSupabaseConfigured: true,
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: 'olli' } } }, error: null })) } },
}));
vi.mock('../../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => repos }));

import { OfflineRepository } from '../../../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../../../core/repositories/LocalStorageRepository';
import { createFakeCloud } from '../../../../test/fakeCloudRepository';
import { createMockMatch, createMockTournament } from '../../../../test/factories';
import { groupRank, slots } from '../../../../test/matchSlotFixtures';
import { useScheduleTabActions } from '../useScheduleTabActions';

function tournament(m1: Partial<Match>): Tournament {
  const matches = [
    createMockMatch({ id: 'm1', matchStatus: 'scheduled', ...m1 }),
    createMockMatch({ id: 'm9', matchStatus: 'scheduled', ...slots(groupRank('A', 1), groupRank('B', 1)) }),
  ];
  return createMockTournament({ id: 'T', ownerId: 'olli', version: 7, matches });
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) { await new Promise<void>((resolve) => setImmediate(resolve)); }
}

describe('A-08f3a2 Schnelleingabe: fremdes Engine-Spiel nach dem Feldweg bleibt gesperrt', () => {
  let repo: OfflineRepository;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.stubGlobal('navigator', { onLine: true });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    stores.raw.clear();
    stores.queue.clear();
    stores.raw.set('tournaments', [tournament({})]);
    const cloud = createFakeCloud({
      tournament: tournament({ scoreA: 1, scoreB: 0, matchStatus: 'running' }),
      revisions: new Map([['m1', 3], ['m9', 1]]),
    });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    repos.tournamentRepository = repo;
    await repo.get('T');
    await flush();
  });

  afterEach(() => {
    repo.mutationQueue.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function enterScore(matchId: string) {
    const current = await repo.get('T');
    if (!current) { throw new Error('Turnier fehlt'); }
    const onMatchesUpdate = vi.fn();
    const showWarning = vi.fn();
    const { result } = renderHook(() => useScheduleTabActions({
      tournament: current, onTournamentUpdate: vi.fn(), onLocalTournamentUpdate: vi.fn(), onMatchesUpdate,
      isEditing: false, saveToHistory: vi.fn(), showSuccess: vi.fn(), showWarning,
      setPendingReferee: vi.fn(), setPendingField: vi.fn(), lockFinishedResults: false,
    }));
    act(() => result.current.handleScoreChange(matchId, 2, 0));
    return { current, onMatchesUpdate, showWarning };
  }

  it('Pflichttest: fremdes Spiel läuft 1:0 (Revision 3) → Hinweis „noch nicht“ wie heute, updateMatches 0×', async () => {
    const { current, onMatchesUpdate, showWarning } = await enterScore('m1');

    expect(current.matches.find((m) => m.id === 'm1')).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    expect(repo.serverLedMatchIds('T')).toEqual(new Set(['m1']));
    expect(showWarning).toHaveBeenCalledTimes(1);
    expect(onMatchesUpdate).not.toHaveBeenCalled();
  });

  it('Gegenbeispiel: Spiel ohne Teams (Revision 1) → Schnelleingabe wie heute', async () => {
    const { onMatchesUpdate, showWarning } = await enterScore('m9');

    expect(showWarning).not.toHaveBeenCalled();
    expect(onMatchesUpdate).toHaveBeenCalledTimes(1);
    expect(onMatchesUpdate.mock.calls[0][0]).toEqual([expect.objectContaining({ id: 'm9', scoreA: 2, scoreB: 0 })]);
  });

  it('A-08f3b-F F3: Neuladen ohne Netz (Cloud wirft) → Sperre aus den gespeicherten Revisionen bleibt', async () => {
    repo.mutationQueue.dispose();
    const offline = createFakeCloud({ tournament: tournament({}), revisions: new Map() });
    offline.fake.getWithMatchRevisions.mockRejectedValue(new Error('offline'));
    repo = new OfflineRepository(new LocalStorageRepository(), offline.fake as never, 'olli'); // neue Instanz = Neuladen
    repos.tournamentRepository = repo;

    const { current, onMatchesUpdate, showWarning } = await enterScore('m1');

    expect(current.matches.find((m) => m.id === 'm1')).toMatchObject({ scoreA: 1, scoreB: 0, matchStatus: 'running' });
    expect(showWarning).toHaveBeenCalledTimes(1);
    expect(onMatchesUpdate).not.toHaveBeenCalled();
  });
});
