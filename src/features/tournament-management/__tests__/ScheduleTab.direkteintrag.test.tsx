/**
 * A-08f3e2 Pflichttest echter Weg (Plan A-08f3 v4 § 3): ScheduleTab mit echtem `useTournamentManager`, echter
 * `OfflineRepository` und echtem Engine-Kontext (Store + MatchEngine + OutboxSender, Server-RPC gemockt).
 * Olli trägt im Spielplan 3:1 ein → Ausgang `RESULT_ENTRY`, Zeile 3:1, Tabelle rechnet mit; `updateMatches`
 * enthält keine Spielstand-Felder. Szenario @FU-080 (`plattform/2026-09-24_fundament-gemeinsamer-stand.md`).
 * UR: „Und das Protokoll zeigt ‚Ergebnis eingetragen von Olli‘“ über das Cockpit-Protokoll (echte DE-Texte), die
 * Server-Lesefunktion match_event_author_names gemockt mit ihrer Antwort.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { Standing, Team, Tournament } from '../../../types/tournament';

vi.unmock('i18next');
vi.unmock('react-i18next');
const stores = vi.hoisted(() => ({ raw: new Map<string, unknown>(), queue: new Map<string, string>() }));
const REPOS = vi.hoisted(() => ({
  tournamentRepository: null as object | null,
  liveMatchRepository: { getAll: () => Promise.resolve(new Map()) },
  isRealtimeEnabled: true,
  supabaseLiveMatchRepo: { getAll: () => Promise.resolve(new Map()), subscribe: () => undefined, unsubscribe: () => undefined, unsubscribeAll: () => undefined },
  publicLiveMatchRepo: null,
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
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => 'leitung' }));
// A-11: Rechte nur über useCan (der Stub usePermissions ist gelöscht) -- hier die Turnierleitung, alles erlaubt.
vi.mock('../../auth/hooks/useCan', () => ({ useCan: () => true }));
// UR: Olli ist angemeldet und Eigentümer von „T“; Antwort der Lesefunktion je Test.
vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: true, user: { id: 'olli', name: 'Olli' } }) }));
vi.mock('../../auth/hooks/useMyTournamentRole', () => ({ useMyTournamentRole: () => ({ role: 'owner', isLoading: false }) }));
const authors = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../../core/repositories/eventAuthorNamesRpc', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../core/repositories/eventAuthorNamesRpc')>()),
  readEventAuthorNames: authors.read,
}));
vi.mock('../../../core/realtime', () => ({
  realtimeService: { subscribeTournament: vi.fn(), unsubscribeTournament: vi.fn(), pause: vi.fn(), resume: vi.fn() },
}));

import { generateFullSchedule } from '../../../core/generators';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ToastProvider } from '../../../components/ui/Toast';
import { OfflineRepository } from '../../../core/repositories/OfflineRepository';
import { LocalStorageRepository } from '../../../core/repositories/LocalStorageRepository';
import { createFakeCloud } from '../../../test/fakeCloudRepository';
import { MatchEngineContext } from '../../match-engine/matchEngineContextInstance';
import { makeScheduleEngine, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { ScheduleTab } from '../ScheduleTab';
import { useTournamentManager } from '../../../hooks/useTournamentManager';
import { Sidebar } from '../../../components/live-cockpit/components/Sidebar';
import { initRealDeI18n } from '../../../test/realDeI18n';

await initRealDeI18n();

const teams: Team[] = ['A', 'B'].flatMap((group, g) =>
  [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })),
);
const base = createMockTournament({
  id: 'T', ownerId: 'olli', version: 7, teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: 1, groupSystem: 'groupsAndFinals',
  finalsConfig: { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' } },
});
const tournament: Tournament = { ...base, matches: generateFullSchedule(base).allMatches as unknown as Tournament['matches'] };
const FIRST = tournament.matches[0];
const teamOf = (slot: Tournament['matches'][number]['slotA']) => teams.find((t) => slot.kind === 'team' && t.id === slot.teamId);
const HOME = teamOf(FIRST.slotA);
const AWAY = teamOf(FIRST.slotB);

let repo: OfflineRepository;

function Host() {
  const { tournament: current, schedule, currentStandings, handleTournamentUpdate, applyRemote } = useTournamentManager('T');
  if (!current || !schedule) { return null; }
  const homePoints = currentStandings.find((s: Standing) => s.team.id === HOME?.id)?.points;
  return (
    <><output data-testid="home-points">{homePoints}</output><ScheduleTab
      tournament={current} schedule={schedule} currentStandings={currentStandings}
      onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onLocalTournamentUpdate={applyRemote}
      onMatchesUpdate={(updates) => { void repo.updateMatches('T', updates); }}
    /></>
  );
}

describe('A-08f3e2 Pflichttest echter Weg: Spielplan → Server-Eintrag (@FU-080)', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    stores.raw.clear();
    stores.queue.clear();
    stores.raw.set('tournaments', [tournament]);
    h = await makeScheduleEngine();
    repo = new OfflineRepository(new LocalStorageRepository(), createFakeCloud({ tournament, revisions: new Map() }).fake as never, 'olli');
    REPOS.tournamentRepository = repo;
    authors.read.mockReset();
    authors.read.mockResolvedValue(new Map());
  });
  afterEach(() => {
    repo.mutationQueue.dispose();
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  async function enterInFirstCard(home: number, away: number) {
    const view = render(
      <MemoryRouter><ToastProvider><MatchEngineContext.Provider value={h.value}><Host /></MatchEngineContext.Provider></ToastProvider></MemoryRouter>,
    );
    await act(async () => { await settle(); });
    const card = (): HTMLElement => view.container.querySelector('[data-match-card]')!;
    act(() => { fireEvent.click(within(card()).getAllByText(HOME?.name ?? '')[0]); });
    const expand = await within(card()).findByTestId('quick-score-expand');
    for (let i = 0; i < home; i++) { fireEvent.click(within(expand).getByLabelText(`${HOME?.name} Tor hinzufügen`)); }
    for (let i = 0; i < away; i++) { fireEvent.click(within(expand).getByLabelText(`${AWAY?.name} Tor hinzufügen`)); }
    await act(async () => { fireEvent.click(within(expand).getByTestId('quick-score-save-btn')); await settle(); });
    return { view, card };
  }

  it('@FU-080 Olli trägt 3:1 ein → Ausgang RESULT_ENTRY, Zeile 3:1, Tabelle rechnet mit, updateMatches ohne Spielstand', async () => {
    const updateMatches = vi.spyOn(repo, 'updateMatches');
    const { view, card } = await enterInFirstCard(3, 1);

    expect(h.api).toHaveBeenCalledTimes(1);
    expect(h.api.mock.calls[0][1].map((event) => event.type)).toEqual(['RESULT_ENTRY']);
    expect(card().textContent).toMatch(/3\s*:\s*1/);
    expect(view.getByTestId('home-points').textContent).toBe('3');
    const scoreFields = updateMatches.mock.calls.flatMap(([, updates]) => updates.flatMap((u) => Object.keys(u)))
      .filter((key) => /score|matchStatus/i.test(key));
    expect(scoreFields).toEqual([]);
  });

  // UR (Baustein Regel 3/4 umgeschrieben): vorher am Code abgelesen („actorUser: 'olli' in der gesendeten Payload“),
  // jetzt das Gherkin -- das Protokoll von Spiel 9 (hier: dem ersten Spiel) zeigt „Ergebnis eingetragen von Olli“.
  it('@FU-080 das Protokoll zeigt „Ergebnis eingetragen von Olli“ (Urheber am Eintrag)', async () => {
    await enterInFirstCard(3, 1);
    const sentId = h.api.mock.calls[0][1][0].id;
    authors.read.mockResolvedValue(new Map([[sentId, { name: 'Olli', role: 'owner' }]]));
    const protocol = render(
      <MatchEngineContext.Provider value={h.value}>
        <Sidebar activePenalties={[]} events={[]} homeTeamName={HOME?.name ?? ''} awayTeamName={AWAY?.name ?? ''}
          homeTeamId={HOME?.id ?? ''} awayTeamId={AWAY?.id ?? ''} matchId={FIRST.id} />
      </MatchEngineContext.Provider>,
    );
    expect(await protocol.findByText('Ergebnis eingetragen von Olli')).toBeTruthy();
  });
});
