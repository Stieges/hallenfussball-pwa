/**
 * A-08f3b (Plan `task-A-08f3-plan.md` v4, Pflichttest Bildschirm, Helfer-Verlauf, H-1): Spielplan und Tabelle beim
 * Turnierleiter zeigen fremde Tore ohne Hinweis. Wirt = `useTournamentManager` + `ScheduleTab` OHNE Service-Mock, echtes
 * `OfflineRepository` + `LocalStorageRepository`, Fake-Storage, Fake-Cloud, Kanal über `realtimeService` (Fake).
 * Anforderungen: @FU-087, @FU-001, @FU-023 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { Standing, Team, Tournament } from '../../../types/tournament';
import type { RealtimeConnectionStatus, RealtimePayload } from '../../../core/realtime';
import type { MatchEngineContextValue } from '../../match-engine/matchEngineContextInstance';

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

const HOME = FIRST.slotA.kind === 'team' ? FIRST.slotA.teamId : '';
function Host() {
  const { tournament, schedule, currentStandings, handleTournamentUpdate, applyRemote } = useTournamentManager('T');
  if (!tournament || !schedule) { return null; }
  const homePoints = currentStandings.find((s: Standing) => s.team.id === HOME)?.points;
  return (
    <><output data-testid="home-points">{homePoints}</output><ScheduleTab
      tournament={tournament} schedule={schedule} currentStandings={currentStandings}
      onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onLocalTournamentUpdate={applyRemote} onMatchesUpdate={vi.fn()}
    /></>
  );
}

const firstCard = (container: HTMLElement): string => container.querySelector('[data-match-card]')?.textContent ?? '';

async function tick(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  await act(async () => { for (let i = 0; i < 20; i++) { await new Promise<void>((r) => setImmediate(r)); } });
}

describe('A-08f3b Spielplan zeigt fremde Tore beim Turnierleiter (@FU-087, @FU-001, @FU-023)', () => {
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

  async function mount(account: string, cloud: ReturnType<typeof createFakeCloud>, engine?: MatchEngineContextValue) {
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, account);
    REPOS.tournamentRepository = repo;
    const wrap = (node: ReactNode) => (engine ? <MatchEngineContext.Provider value={engine}>{node}</MatchEngineContext.Provider> : node);
    const view = render(<MemoryRouter><ToastProvider>{wrap(<Host />)}</ToastProvider></MemoryRouter>);
    await tick(0);
    return view;
  }

  it('Pflicht: Kanal CLOSED → nach dem ersten 5-s-Tick zeigt Spiel 1 „1:0“, Tabelle 3 Punkte, kein Hinweis', async () => {
    stores.raw.set('tournaments', [withFirst(7, {})]);
    const cloud = createFakeCloud({ tournament: withFirst(7, {}), revisions: revisions(1) });
    const view = await mount('olli', cloud);
    act(() => channel.status('connected'));
    act(() => channel.status('disconnected'));
    cloud.setState({ tournament: withFirst(7, { scoreA: 1, scoreB: 0, matchStatus: 'finished' }), revisions: revisions(3) });

    await tick(5000);

    expect(firstCard(view.container)).toContain('1:0');
    expect(view.getByTestId('home-points').textContent).toBe('3');
    expect(view.queryByText(/Live-Verbindung unterbrochen/)).toBeNull();
  });

  it('Push statt Tick: „1:0“ ohne zweiten Push; Gegenbeispiel SUBSCRIBED ohne Push → keine weiteren Abrufe', async () => {
    stores.raw.set('tournaments', [withFirst(7, {})]);
    const cloud = createFakeCloud({ tournament: withFirst(7, {}), revisions: revisions(1) });
    const view = await mount('olli', cloud);
    act(() => channel.status('connected'));
    await tick(30000);
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(1);

    cloud.setState({ tournament: withFirst(7, { scoreA: 1, scoreB: 0, matchStatus: 'running' }), revisions: revisions(3) });
    act(() => channel.push({} as RealtimePayload));
    await tick(0);

    expect(firstCard(view.container)).toContain('1:0');
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(2);
  });

  it('Helfer-Verlauf: tom, Turnier-Version fest 3, je Tick +1 Tor und +1 Revision → Tick k zeigt „k:0“, Aufrufe 1 + 12', async () => {
    const cloud = createFakeCloud({ tournament: withFirst(3, { matchStatus: 'running', scoreA: 0, scoreB: 0 }), revisions: revisions(2) });
    const view = await mount('tom', cloud);
    act(() => channel.status('connected'));
    act(() => channel.status('disconnected'));

    for (let k = 1; k <= 12; k++) {
      cloud.setState({ tournament: withFirst(3, { matchStatus: 'running', scoreA: k, scoreB: 0 }), revisions: revisions(2 + k) });
      await tick(5000);
      expect(firstCard(view.container)).toContain(`${k}:0`);
    }
    expect(cloud.fake.getWithMatchRevisions).toHaveBeenCalledTimes(13);
  });
});
