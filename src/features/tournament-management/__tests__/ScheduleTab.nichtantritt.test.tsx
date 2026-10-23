/**
 * B-12 Nichtantritt in der Oberfläche, echter Weg (Muster ScheduleTab.direkteintrag): ScheduleTab mit echtem
 * `useTournamentManager`, `OfflineRepository` und Engine-Kontext (Server-RPC gemockt). Die Rolle ist je Test einstellbar.
 * Testwerte aus dem Gherkin: @W2A-022 (Team fehlt → 2:0 für den Gegner, als Wertung gekennzeichnet), @W2A-024/@TM-063
 * (beide fehlen → je 0 Punkte, 0:2 Tore, keiner gewinnt), @W2A-026 (Wertung zurücknehmen → Spiel wieder offen, Tabelle neu),
 * @FU-119 (angepfiffenes Spiel: keine Taste), @SL-118 (Helfer sieht die Taste nicht).
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
const role = vi.hoisted(() => ({ current: 'leitung' }));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => role.current }));
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
import { MatchCommands } from '../../../core/match/client';
import type { MatchRules } from '../../../core/match';
import { buildValidMatches } from '../../../hooks/engineMatchModel';
import { makeScheduleEngine, settle, type ScheduleEngine } from '../../../test/scheduleEngineHarness';
import { ScheduleTab } from '../ScheduleTab';
import { useTournamentManager } from '../../../hooks/useTournamentManager';
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
  const homeRow = currentStandings.find((s: Standing) => s.team.id === HOME?.id);
  const awayRow = currentStandings.find((s: Standing) => s.team.id === AWAY?.id);
  return (
    <><output data-testid="home-points">{homeRow?.points}</output><output data-testid="away-points">{awayRow?.points}</output>
      <output data-testid="home-goals">{homeRow?.goalsFor}:{homeRow?.goalsAgainst}</output>
      <output data-testid="away-goals">{awayRow?.goalsFor}:{awayRow?.goalsAgainst}</output><ScheduleTab
      tournament={current} schedule={schedule} currentStandings={currentStandings}
      onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onLocalTournamentUpdate={applyRemote}
      onMatchesUpdate={(updates) => { void repo.updateMatches('T', updates); }}
    /></>
  );
}

describe('B-12 Nichtantritt im Spielplan der Turnierleitung', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    role.current = 'leitung';
    vi.stubGlobal('indexedDB', new IDBFactory());
    vi.mocked(localStorage.getItem).mockReturnValue(null);
    stores.raw.clear();
    stores.queue.clear();
    stores.raw.set('tournaments', [tournament]);
    h = await makeScheduleEngine();
    repo = new OfflineRepository(new LocalStorageRepository(), createFakeCloud({ tournament, revisions: new Map() }).fake as never, 'olli');
    REPOS.tournamentRepository = repo;
    authors.read.mockResolvedValue(new Map());
  });
  afterEach(() => {
    repo.mutationQueue.dispose();
    h.engine.stop();
    vi.unstubAllGlobals();
  });

  async function openFirstCard() {
    const view = render(
      <MemoryRouter><ToastProvider><MatchEngineContext.Provider value={h.value}><Host /></MatchEngineContext.Provider></ToastProvider></MemoryRouter>,
    );
    await act(async () => { await settle(); });
    const card = (): HTMLElement => view.container.querySelector('[data-match-card]')!;
    act(() => { fireEvent.click(within(card()).getAllByText(HOME?.name ?? '')[0]); });
    await within(card()).findByTestId('quick-score-expand');
    return { view, card };
  }

  async function markAs(choice: 'A' | 'B' | 'both') {
    const opened = await openFirstCard();
    fireEvent.click(within(opened.card()).getAllByTestId(`forfeit-mark-${FIRST.id}`)[0]);
    await opened.view.findByTestId('forfeit-dialog');
    fireEvent.click(opened.view.getByTestId(`forfeit-choice-${choice}`));
    await act(async () => { fireEvent.click(opened.view.getByTestId('forfeit-confirm')); await settle(); });
    return opened;
  }

  it('@W2A-022 Heimteam nicht angetreten → RESULT_ENTRY mit forfeit, 0:2 für den Gast, gewertet, Gast 3 Punkte, Heim 0', async () => {
    const { view, card } = await markAs('A');
    expect(h.api).toHaveBeenCalledTimes(1);
    const sent = h.api.mock.calls[0][1];
    expect(sent.map((event) => event.type)).toEqual(['RESULT_ENTRY']);
    expect(sent[0].payload).toMatchObject({ forfeit: { absent: 'A' } });
    expect(card().textContent).toMatch(/gewertet/);
    expect(view.getByTestId('away-points').textContent).toBe('3');
    expect(view.getByTestId('home-points').textContent).toBe('0');
  });

  it('@W2A-022 Gegenbeispiel: Gastteam nicht angetreten → das Heimteam gewinnt (nicht seitenvertauscht)', async () => {
    const { view } = await markAs('B');
    expect(h.api.mock.calls[0][1][0].payload).toMatchObject({ forfeit: { absent: 'B' } });
    expect(view.getByTestId('home-points').textContent).toBe('3');
    expect(view.getByTestId('away-points').textContent).toBe('0');
  });

  it('@W2A-024 @TM-063 beide nicht angetreten → je 0 Punkte und 0:2 Tore, keiner gewinnt, als Wertung gekennzeichnet', async () => {
    const { view, card } = await markAs('both');
    expect(h.api.mock.calls[0][1][0].payload).toMatchObject({ forfeit: { absent: 'both' } });
    expect(view.getByTestId('home-points').textContent).toBe('0');
    expect(view.getByTestId('away-points').textContent).toBe('0');
    expect(view.getByTestId('home-goals').textContent).toBe('0:2');
    expect(view.getByTestId('away-goals').textContent).toBe('0:2');
    expect(card().textContent).toMatch(/gewertet/);
  });

  it('Abbruch in der Rückfrage → nichts gesendet, Spiel bleibt geplant', async () => {
    const opened = await openFirstCard();
    fireEvent.click(within(opened.card()).getAllByTestId(`forfeit-mark-${FIRST.id}`)[0]);
    await opened.view.findByTestId('forfeit-dialog');
    expect((opened.view.getByTestId('forfeit-confirm') as HTMLButtonElement).disabled).toBe(true); // ohne Auswahl gesperrt
    await act(async () => { fireEvent.click(opened.view.getByTestId('forfeit-cancel')); await settle(); });
    expect(h.api).not.toHaveBeenCalled();
    expect(opened.view.getByTestId('away-points').textContent).toBe('0');
  });

  it('@W2A-026 Wertung zurücknehmen → Spiel wieder offen, Tabelle neu berechnet, Taste „Nicht angetreten“ wieder da', async () => {
    const { view, card } = await markAs('A');
    expect(view.getByTestId('away-points').textContent).toBe('3');
    const revoke = await within(card()).findAllByTestId(`forfeit-revoke-${FIRST.id}`);
    expect(within(card()).queryAllByTestId(`forfeit-mark-${FIRST.id}`)).toHaveLength(0); // gewertet: nur noch „zurücknehmen“
    fireEvent.click(revoke[0]);
    await view.findByText(/Die Wertung wird zurückgenommen/);
    await act(async () => { fireEvent.click(view.getAllByRole('button', { name: 'Wertung zurücknehmen' }).at(-1)!); await settle(); });
    expect(h.api.mock.calls.at(-1)?.[1].map((event) => event.type)).toEqual(['REOPEN']);
    expect(view.getByTestId('away-points').textContent).toBe('0');
    expect(card().textContent).not.toMatch(/gewertet/);
  });

  it('@SL-118 Gegenbeispiel: ein Helfer sieht die Taste „Nicht angetreten“ nicht', async () => {
    role.current = 'helper';
    const { card } = await openFirstCard();
    expect(within(card()).queryAllByTestId(`forfeit-mark-${FIRST.id}`)).toHaveLength(0);
  });

  // @FU-119 „Wenn Olli bei Spiel 9 ‚nicht angetreten‘ wählen will“ -- ein anderes Gerät pfeift an, die Karte zeigt es sofort.
  it('@FU-119 Spiel wird angepfiffen → die Taste „Nicht angetreten“ verschwindet, nichts gesendet', async () => {
    const opened = await openFirstCard();
    expect(within(opened.card()).queryAllByTestId(`forfeit-mark-${FIRST.id}`).length).toBeGreaterThan(0);
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === FIRST.id)!;
    await h.engine.ensureMatch(entry.matchId, entry.ctx, 'T');
    const rules: MatchRules = {
      sections: 1, sectionSeconds: 600, breakSeconds: 0, knockout: false, tiebreak: null, overtimeSeconds: 0,
      shootersPerTeam: 0, suddenDeathAfter: 0, penaltySeconds: 0,
    };
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    await commands.start(entry.matchId, entry.ctx, 'leitung', rules);
    await act(async () => { await settle(); });
    h.api.mockClear();
    expect(within(opened.card()).queryAllByTestId(`forfeit-mark-${FIRST.id}`)).toHaveLength(0);
    expect(h.api).not.toHaveBeenCalled();
  });

  // @SL-174 „Dann zeigt der Dialog vor dem Eintragen ‚TSV West gewinnt 2:0 (Wertung)‘ … ‚nur dieses Spiel‘ ist vorgewählt …
  // erst ‚Wertung eintragen‘ speichert“
  it('@SL-174 Vorschau „<Gast> gewinnt 2:0 (Wertung)“, „Nur dieses Spiel“ vorgewählt, gespeichert erst mit „Wertung eintragen“', async () => {
    const opened = await openFirstCard();
    fireEvent.click(within(opened.card()).getAllByTestId(`forfeit-mark-${FIRST.id}`)[0]);
    await opened.view.findByTestId('forfeit-dialog');
    fireEvent.click(opened.view.getByTestId('forfeit-choice-A'));
    expect(opened.view.getByTestId('forfeit-summary').textContent).toBe(`${AWAY?.name} gewinnt 0:2 (Wertung)`);
    expect(opened.view.queryByTestId('forfeit-rest-hint')).toBeNull(); // vorgewählt: nur dieses Spiel
    expect(opened.view.getByText('Team ist abgereist – auch alle restlichen Spiele werten')).toBeTruthy();
    expect(h.api).not.toHaveBeenCalled();
  });

  it('@W2A-023 „Team ist abgereist“ → alle noch nicht begonnenen Spiele des Teams als Wertung, gespielte bleiben unverändert', async () => {
    const other = tournament.matches.filter((m) => m.id !== FIRST.id && [m.slotA, m.slotB].some((slot) => slot.kind === 'team' && slot.teamId === HOME?.id));
    expect(other.length).toBe(2);
    const played = buildValidMatches(tournament).find((candidate) => candidate.externalId === other[0].id)!;
    await h.engine.ensureMatch(played.matchId, played.ctx, 'T');
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    await commands.enterResult(played.matchId, played.ctx, 'leitung', { [played.ctx.teamAId]: 1, [played.ctx.teamBId]: 1 }, undefined, false);
    await settle();
    h.api.mockClear();

    const opened = await openFirstCard();
    fireEvent.click(within(opened.card()).getAllByTestId(`forfeit-mark-${FIRST.id}`)[0]);
    await opened.view.findByTestId('forfeit-dialog');
    fireEvent.click(opened.view.getByTestId('forfeit-choice-A'));
    fireEvent.click(opened.view.getByTestId('forfeit-scope-rest'));
    await act(async () => { fireEvent.click(opened.view.getByTestId('forfeit-confirm')); await settle(); });

    const sent = h.api.mock.calls.flatMap(([, events]) => events).filter((event) => event.type === 'RESULT_ENTRY');
    const forfeits = sent.filter((event) => (event.payload as { forfeit?: unknown }).forfeit !== undefined);
    expect(forfeits).toHaveLength(2); // dieses Spiel + das eine noch geplante; das gespielte (1:1) bleibt unverändert
    expect(sent).toHaveLength(2);
  });

  it('@W2A-023 Gegenbeispiel: ohne die Wahl „abgereist“ wertet nur dieses Spiel', async () => {
    await markAs('A');
    expect(h.api.mock.calls.flatMap(([, events]) => events).filter((event) => event.type === 'RESULT_ENTRY')).toHaveLength(1);
  });
});
