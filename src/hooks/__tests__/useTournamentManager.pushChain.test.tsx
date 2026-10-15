/**
 * A-08f3b2 (C-SPIELPLAN-PUSH-KANAL-OFFEN, @FU-087): die Push-Kette OHNE Mock von `realtimeService`.
 * Echter `RealtimeService` -> echter `useRealtimeTournament` -> `useTournamentManager` (frisch lesen) -> echtes
 * `OfflineRepository` mit Fake-Cloud. Nur der Supabase-Client ist ein Fake-Server, der sich wie Supabase Realtime
 * verhält (am lokalen Stack belegt, A-08f3b2-Probe): Steht eine Bindung auf einer Tabelle, die NICHT in der
 * Publikation `supabase_realtime` ist, meldet der Server nach dem Beitritt eine System-Nachricht mit
 * `status: 'error'` und liefert für den GANZEN Kanal keine Änderungen -- der Kanal bleibt trotzdem `SUBSCRIBED`.
 * Publikation laut Migration 20260928_001 § 9 und `scripts/db-drift-check.sh` (REALTIME_PUBLICATION_TABLES).
 * Anforderung: @FU-087 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import type { Tournament } from '../../core/models/types';

type Handler = (payload: Record<string, unknown>) => void;
interface Binding { type: string; filter: { table?: string; filter?: string }; cb: Handler }
interface FakeChannel {
  name: string;
  bindings: Binding[];
  poisoned: boolean;
  statusCb: ((status: string) => void) | null;
  on: (type: string, filter: Binding['filter'], cb: Handler) => FakeChannel;
  subscribe: (cb: (status: string) => void) => FakeChannel;
}

const server = vi.hoisted(() => {
  const PUBLISHED = new Set(['match_events', 'matches', 'teams', 'monitor_heartbeats']);
  const channels: FakeChannel[] = [];
  const makeChannel = (name: string): FakeChannel => {
    const ch: FakeChannel = {
      name, bindings: [], poisoned: false, statusCb: null,
      on: (type, filter, cb) => { ch.bindings.push({ type, filter, cb }); return ch; },
      subscribe: (cb) => { ch.statusCb = cb; return ch; },
    };
    channels.push(ch);
    return ch;
  };
  /** Beitritt wie Supabase Realtime: erst SUBSCRIBED, dann die System-Nachricht der postgres_changes-Erweiterung. */
  const join = (): void => {
    for (const ch of channels) {
      ch.statusCb?.('SUBSCRIBED');
      const unpublished = ch.bindings.filter((b) => b.type === 'postgres_changes' && !PUBLISHED.has(b.filter.table ?? ''));
      ch.poisoned = unpublished.length > 0;
      const message = ch.poisoned
        ? { status: 'error', extension: 'postgres_changes', message: `Unable to subscribe to changes with given parameters: table ${unpublished[0].filter.table}` }
        : { status: 'ok', extension: 'postgres_changes', message: 'Subscribed to PostgreSQL' };
      for (const b of ch.bindings) { if (b.type === 'system') { b.cb(message); } }
    }
  };
  /** Der Server schreibt eine Zeile (z. B. `append_match_events` aktualisiert `matches`). */
  const write = (table: string, row: Record<string, unknown>): void => {
    for (const ch of channels) {
      if (ch.poisoned) { continue; }
      for (const b of ch.bindings) {
        if (b.type !== 'postgres_changes' || b.filter.table !== table) { continue; }
        const [column, value] = (b.filter.filter ?? '').replace('=eq.', '=').split('=');
        if (column && row[column] !== value) { continue; }
        b.cb({ eventType: 'UPDATE', new: row, old: {} });
      }
    }
  };
  return {
    PUBLISHED,
    channels,
    join,
    write,
    supabase: {
      auth: { getSession: async () => ({ data: { session: null }, error: null }) },
      channel: (name: string) => makeChannel(name),
      removeChannel: (ch: FakeChannel) => { channels.splice(channels.indexOf(ch), 1); return Promise.resolve('ok'); },
    },
  };
});

const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
const REPOS = vi.hoisted(() => ({ tournamentRepository: null as object | null, isRealtimeEnabled: true }));

vi.mock('../../lib/supabase', () => ({ isSupabaseConfigured: true, supabase: server.supabase }));
vi.mock('../../core/storage/StorageFactory', () => ({
  createStorage: () => Promise.resolve({
    get: (key: string) => Promise.resolve(stores.raw.get(key)),
    set: (key: string, value: unknown) => { stores.raw.set(key, structuredClone(value)); return Promise.resolve(); },
  }),
}));
vi.mock('../../core/utils/safeStorage', () => ({
  safeLocalStorage: {
    getItem: vi.fn((key: string) => stores.queue.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { stores.queue.set(key, value); }),
    setItemPersisted: vi.fn((key: string, value: string) => { stores.queue.set(key, value); return true; }),
    getIsAvailable: vi.fn(() => true),
    removeItem: vi.fn((key: string) => { stores.queue.delete(key); }),
  },
}));
vi.mock('../../lib/sentry', () => ({ captureFeatureError: vi.fn() }));
vi.mock('../../core/contexts/RepositoryContext', () => ({ useRepositories: () => REPOS }));

import { generateFullSchedule } from '../../core/generators';
import { createMockTournament } from '../../test/factories';
import { testUuid } from '../../test/testIds';
import { OfflineRepository } from '../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../core/repositories/LocalStorageRepository';
import { createFakeCloud } from '../../test/fakeCloudRepository';
import { useTournamentManager } from '../useTournamentManager';
import { REALTIME_POLL_FALLBACK_INTERVAL_MS } from '../realtimePollFallback';

const TID = testUuid(900);
const teams = [1, 2, 3, 4].map((n) => ({ id: testUuid(n), name: `Team ${n}`, group: 'A' }));
const base = createMockTournament({ id: TID, ownerId: 'olli', version: 5, teams, numberOfTeams: 4, numberOfGroups: 1, numberOfFields: 1 });
const allMatches = generateFullSchedule(base).allMatches as unknown as Tournament['matches'];
const FIRST = allMatches[0];
const withScore = (scoreA: number): Tournament => ({ ...base, matches: allMatches.map((m) => (m.id === FIRST.id ? { ...m, scoreA, scoreB: 0, matchStatus: 'running' } : m)) });
const revisions = (first: number) => new Map(allMatches.map((m) => [m.id, m.id === FIRST.id ? first : 1]));

function Host() {
  const { tournament } = useTournamentManager(TID);
  const first = tournament?.matches.find((m) => m.id === FIRST.id);
  return <output data-testid="score">{first ? `${first.scoreA ?? '-'}:${first.scoreB ?? '-'}` : 'leer'}</output>;
}

async function tick(ms: number): Promise<void> {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  await act(async () => { for (let i = 0; i < 20; i++) { await new Promise<void>((r) => setImmediate(r)); } });
}

describe('A-08f3b2 Push-Kette Kanal offen → Spielplan frisch (@FU-087)', () => {
  let repo: OfflineRepository;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    stores.raw.clear();
    stores.queue.clear();
    server.channels.length = 0;
    server.PUBLISHED.add('matches');
  });
  afterEach(() => {
    repo.mutationQueue.dispose();
    vi.useRealTimers();
  });

  async function mount(cloud: ReturnType<typeof createFakeCloud>) {
    stores.raw.set('tournaments', [withScore(1)]);
    repo = new OfflineRepository(new LocalStorageRepository(), cloud.fake as never, 'olli');
    REPOS.tournamentRepository = repo;
    const view = render(<Host />);
    await tick(0);
    return view;
  }

  it('Kanal SUBSCRIBED: ein Server-Schreiben auf matches lädt frisch, „2:0“ ohne Abfrage-Tick', async () => {
    const cloud = createFakeCloud({ tournament: withScore(1), revisions: revisions(2) });
    const view = await mount(cloud);
    expect(view.getByTestId('score').textContent).toBe('1:0');
    act(() => server.join());
    await tick(0);
    const readsBefore = cloud.fake.getWithMatchRevisions.mock.calls.length;

    cloud.setState({ tournament: withScore(2), revisions: revisions(3) });
    act(() => server.write('matches', { id: FIRST.id, tournament_id: TID, score_a: 2 }));
    await tick(0);

    expect(view.getByTestId('score').textContent).toBe('2:0');
    expect(cloud.fake.getWithMatchRevisions.mock.calls.length).toBe(readsBefore + 1);
  });

  it('Kein Kanal-Abo auf eine Tabelle außerhalb der Publikation (sonst liefert der Server für den ganzen Kanal nichts)', async () => {
    const cloud = createFakeCloud({ tournament: withScore(1), revisions: revisions(2) });
    await mount(cloud);
    act(() => server.join());
    expect(server.channels.length).toBeGreaterThan(0);
    for (const ch of server.channels) { expect(ch.poisoned, ch.name).toBe(false); }
  });

  it('Server meldet Abo-Fehler nach SUBSCRIBED (matches fehlt in der Publikation) → Abfrage-Ausweichen greift nach 5 s', async () => {
    server.PUBLISHED.delete('matches');
    const cloud = createFakeCloud({ tournament: withScore(1), revisions: revisions(2) });
    const view = await mount(cloud);
    act(() => server.join());
    await tick(0);

    cloud.setState({ tournament: withScore(2), revisions: revisions(3) });
    act(() => server.write('matches', { id: FIRST.id, tournament_id: TID, score_a: 2 }));
    await tick(0);
    expect(view.getByTestId('score').textContent).toBe('1:0'); // kein Push: der Kanal ist vergiftet

    await tick(REALTIME_POLL_FALLBACK_INTERVAL_MS);
    expect(view.getByTestId('score').textContent).toBe('2:0');
  });
});
