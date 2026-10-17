/**
 * A-08f3b H-1 (Review `task-A-08f3-plan-review-v3.md`): Eine schon geladene Engine-Kopie (Live-Tab besucht) verdeckt
 * den Feldweg nicht. Übernimmt der Abruf für Spiel 1 eine höhere Revision, lädt `useEngineCatchUpOnCloudChange` die
 * Kopie nach; die Zeile zeigt „2:0“ statt der alten Überlagerung „1:0“. Echter Engine-Kontext (MatchEngine +
 * LocalMatchStore + fake-indexeddb), echtes `OfflineRepository`, Wirt `useTournamentManager` + `ScheduleTab`.
 * Anforderungen: @FU-087, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Team, Tournament } from '../../../types/tournament';
import type { RealtimeConnectionStatus, RealtimePayload } from '../../../core/realtime';
import type { MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';
import { ClockSync, LocalMatchStore, MatchEngine } from '../../../core/match/client';
import { goal, start, withSeq } from '../../../core/match/client/__tests__/fixtures';

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
const REPOS = vi.hoisted(() => ({
  tournamentRepository: null as object | null,
  liveMatchRepository: { getAll: () => Promise.resolve(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll: () => Promise.resolve(new Map()), subscribe: () => undefined, unsubscribe: () => undefined, unsubscribeAll: () => undefined },
  publicLiveMatchRepo: null,
}));
const channel: { status: (s: RealtimeConnectionStatus) => void; push: (p: RealtimePayload) => void } = vi.hoisted(() => ({
  status: () => undefined,
  push: () => undefined,
}));

vi.mock('../../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../../core/utils/safeStorage', () => ({
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
  supabase: { auth: { getSession: vi.fn(async () => ({ data: { session: null }, error: null })) } },
}));
vi.mock('../../../core/contexts/RepositoryContext', () => ({ useRepositories: () => REPOS }));
// A-08f3e2: die Schnelleingabe fragt die Akteursrolle ab (useActorRole braucht sonst den AuthProvider).
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
vi.mock('../../../hooks/usePermissions', () => ({
  usePermissions: () => ({ canCorrectResults: true, hasPermission: () => true }),
}));
vi.mock('../../../core/realtime', () => ({
  realtimeService: {
    subscribeTournament: (o: { onStatusChange: (s: RealtimeConnectionStatus) => void; onMatchChange: (p: RealtimePayload) => void }) => {
      channel.status = o.onStatusChange;
      channel.push = o.onMatchChange;
    },
    unsubscribeTournament: vi.fn(), pause: vi.fn(), resume: vi.fn(),
  },
}));

import { generateFullSchedule } from '../../../core/generators';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';
import { OfflineRepository } from '../../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../../core/repositories/LocalStorageRepository';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { MatchEngineContext } from '../../match-engine/matchEngineContextInstance';
import { ScheduleTab } from '../ScheduleTab';
import { useTournamentManager } from '../../../hooks/useTournamentManager';

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);
const base = createMockTournament({
  id: 'T', ownerId: 'olli', version: 7, teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
});
const allMatches = generateFullSchedule(base).allMatches as unknown as Tournament['matches'];
const FIRST = allMatches[0];

function withFirst(version: number, first: Partial<Tournament['matches'][number]>): Tournament {
  return { ...base, version, matches: allMatches.map((m) => (m.id === FIRST.id ? { ...m, ...first } : m)) };
}
const revisions = (first: number) => new Map(allMatches.map((m) => [m.id, m.id === FIRST.id ? first : 1]));

function Host() {
  const { tournament, schedule, currentStandings, handleTournamentUpdate, applyRemote } = useTournamentManager('T');
  if (!tournament || !schedule) { return null; }
  return (
    <ScheduleTab
      tournament={tournament} schedule={schedule} currentStandings={currentStandings}
      onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onLocalTournamentUpdate={applyRemote} onMatchesUpdate={vi.fn()}
    />
  );
}

const firstCard = (container: HTMLElement): string => container.querySelector('[data-match-card]')?.textContent ?? '';
const sideId = (slot: Tournament['matches'][number]['slotA']): string => (slot.kind === 'team' ? slot.teamId.toLowerCase() : '');

async function tick(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  await act(async () => { for (let i = 0; i < 30; i++) { await new Promise<void>((r) => setImmediate(r)); } });
}

let accountCounter = 0;
async function engineWithLoadedCopy() {
  const fetchConfirmed = vi.fn();
  const engine = new MatchEngine({
    store: new LocalMatchStore(),
    clock: new ClockSync(() => Promise.resolve(1_790_000_000_000), () => 1_790_000_000_000, { get: () => null, set: () => undefined }),
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed,
    now: () => 1_790_000_000_000,
  });
  const accountId = `olli-h1-${(accountCounter += 1)}`;
  await engine.start(accountId);
  const matchId = FIRST.id.toLowerCase();
  const ctx = { matchId, teamAId: sideId(FIRST.slotA), teamBId: sideId(FIRST.slotB) };
  await engine.ensureMatch(matchId, ctx, 'T');
  // Live-Tab: Kopie geladen und nachgeholt (Anpfiff + 1:0)
  fetchConfirmed.mockResolvedValueOnce({ events: [withSeq(start(), 1), withSeq(goal('g1', ctx.teamAId, 2000, 60_000), 2)], newWatermark: 2 });
  await engine.catchUp(matchId);
  // Danach am Server: das 2:0
  fetchConfirmed.mockResolvedValue({ events: [withSeq(goal('g2', ctx.teamAId, 3000, 120_000), 3)], newWatermark: 3 });
  const value = { engine, store: null, clock: null, sender: { kick: vi.fn() }, accountId } as unknown as MatchEngineContextValue;
  return { value, fetchConfirmed, catchUp: vi.spyOn(engine, 'catchUp') };
}

describe('A-08f3b H-1: geladene Engine-Kopie wird nach höherer Revision nachgeladen', () => {
  let repo: OfflineRepository;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    stores.raw.clear();
    stores.queue.clear();
  });
  afterEach(() => {
    repo.mutationQueue.dispose();
    vi.useRealTimers();
  });

  it('Pflicht H-1: Kopie zeigt 1:0, Cloud 2:0 (Revision 5) → Tick → catchUp, Zeile zeigt „2:0“', async () => {
    const { value, catchUp } = await engineWithLoadedCopy();
    stores.raw.set('tournaments', [withFirst(7, {})]);
    const cloud = createFakeCloud({ tournament: withFirst(7, {}), revisions: revisions(1) });
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    REPOS.tournamentRepository = repo;
    const view = render(
      <MemoryRouter><ToastProvider><MatchEngineContext.Provider value={value}><Host /></MatchEngineContext.Provider></ToastProvider></MemoryRouter>,
    );
    await tick(0);
    expect(firstCard(view.container)).toContain('1:0');

    act(() => channel.status('connected'));
    act(() => channel.status('disconnected'));
    cloud.setState({ tournament: withFirst(7, { scoreA: 2, scoreB: 0, matchStatus: 'running' }), revisions: revisions(5) });
    await tick(5000);

    expect(catchUp).toHaveBeenCalledWith(FIRST.id.toLowerCase());
    expect(firstCard(view.container)).toContain('2:0');
  });
});
