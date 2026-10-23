/**
 * Befund C-GRUPPE-BEENDET-SCHNELLEINGABE-STILL (K1): ein beendetes Gruppenspiel öffnet im Spielplan die Schnelleingabe,
 * und „Speichern“ tat still nichts. Pflichttest echter Weg wie ScheduleTab.direkteintrag.test.tsx (echter
 * `useTournamentManager`, echte `OfflineRepository`, echter Engine-Kontext, Server-RPC gemockt).
 * Szenarien: @EK-063 (Korrektur beginnt im Spielplan), @EK-004 (ohne Grund keine Korrektur), @EK-001 (Korrektur mit
 * Grund), @FU-080 (geplantes Spiel speichert wie bisher), @HE-042 (Helfer: nur Turnierleitung).
 * `docs/anforderungen/2026-10-02_ergebnisse-korrigieren.md`, `plattform/2026-09-24_fundament-gemeinsamer-stand.md`.
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
const actorRole = vi.hoisted((): { current: 'leitung' | 'helper' } => ({ current: 'leitung' }));
vi.mock('../../../hooks/useActorRole', () => ({ useActorRole: () => actorRole.current }));
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
  const homePoints = currentStandings.find((s: Standing) => s.team.id === HOME?.id)?.points;
  return (
    <><output data-testid="home-points">{homePoints}</output><ScheduleTab
      tournament={current} schedule={schedule} currentStandings={currentStandings}
      onTournamentUpdate={(t) => { void handleTournamentUpdate(t); }} onLocalTournamentUpdate={applyRemote}
      onMatchesUpdate={(updates) => { void repo.updateMatches('T', updates); }}
    /></>
  );
}


describe('C-GRUPPE-BEENDET-SCHNELLEINGABE-STILL: beendetes Gruppenspiel im Spielplan', () => {
  let h: ScheduleEngine;

  beforeEach(async () => {
    actorRole.current = 'leitung';
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

  const eventTypes = (): string[][] => h.api.mock.calls.map((call) => call[1].map((event) => event.type));

  async function renderSchedule() {
    const view = render(
      <MemoryRouter><ToastProvider><MatchEngineContext.Provider value={h.value}><Host /></MatchEngineContext.Provider></ToastProvider></MemoryRouter>,
    );
    await act(async () => { await settle(); });
    const card = (): HTMLElement => view.container.querySelector('[data-match-card]')!;
    return { view, card };
  }

  /** Öffnet die Schnelleingabe der ersten Karte, tippt Tore (je Team) und drückt „Speichern“. */
  async function quickEntry(card: () => HTMLElement, home: number, away: number) {
    act(() => { fireEvent.click(within(card()).getAllByText(HOME?.name ?? '')[0]); });
    const expand = await within(card()).findByTestId('quick-score-expand');
    for (let i = 0; i < home; i++) { fireEvent.click(within(expand).getByLabelText(`${HOME?.name} Tor hinzufügen`)); }
    for (let i = 0; i < away; i++) { fireEvent.click(within(expand).getByLabelText(`${AWAY?.name} Tor hinzufügen`)); }
    await act(async () => { fireEvent.click(within(expand).getByTestId('quick-score-save-btn')); await settle(); });
  }

  /** Spiel 1 ist beendet (3:1), eingetragen durch die Turnierleitung über die Engine. */
  async function finishFirstMatch() {
    const entry = buildValidMatches(tournament).find((candidate) => candidate.externalId === FIRST.id)!;
    await h.engine.ensureMatch(entry.matchId, entry.ctx, 'T');
    const commands = new MatchCommands({ engine: h.engine, store: h.store, sender: h.sender, accountId: h.value.accountId });
    await commands.enterResult(entry.matchId, entry.ctx, 'leitung', { [entry.ctx.teamAId]: 3, [entry.ctx.teamBId]: 1 }, undefined, false);
    await settle();
    h.api.mockClear();
  }

  it('@EK-063:teil beendet → Speichern startet die Korrektur: Grund-Auswahl mit bisher 3:1 und neu 4:1, noch nichts gesendet', async () => {
    await finishFirstMatch();
    const { view, card } = await renderSchedule();
    expect(card().textContent).toMatch(/3\s*:\s*1/); // Ausgangslage: Spiel ist beendet und zeigt 3:1

    await quickEntry(card, 1, 0);

    const dialog = await view.findByTestId('result-entry-reason-dialog');
    expect(dialog.textContent).toContain('bisher 3:1 – neu 4:1');
    expect(h.api).not.toHaveBeenCalled();
  });

  it('@EK-001 mit Grund „Eingabefehler“ → Ausgang CORRECTION, Zeile 3:3, Tabelle rechnet mit (Heim 3 → 1 Punkt)', async () => {
    await finishFirstMatch();
    const { view, card } = await renderSchedule();
    expect(view.getByTestId('home-points').textContent).toBe('3'); // Ausgangslage: 3:1 gewonnen
    await quickEntry(card, 0, 2);
    await view.findByTestId('result-entry-reason-dialog');

    fireEvent.change(view.getByTestId('result-entry-reason'), { target: { value: 'input_error' } });
    await act(async () => { fireEvent.click(view.getByText('Speichern', { selector: 'button' })); await settle(); });

    expect(eventTypes()).toEqual([['CORRECTION']]);
    expect(card().textContent).toMatch(/3\s*:\s*3/);
    expect(view.getByTestId('home-points').textContent).toBe('1');
  });

  it('@EK-004 Abbrechen sendet nichts: die Zeile zeigt weiter 3:1', async () => {
    await finishFirstMatch();
    const { view, card } = await renderSchedule();
    await quickEntry(card, 1, 0);
    await view.findByTestId('result-entry-reason-dialog');

    await act(async () => { fireEvent.click(view.getByTestId('result-entry-cancel')); await settle(); });

    expect(h.api).not.toHaveBeenCalled();
    expect(card().textContent).toMatch(/3\s*:\s*1/);
    expect(card().textContent).not.toMatch(/4\s*:\s*1/);
  });

  it('@EK-063:teil beendet → Zusammenfassung → „Ergebnis ändern“ tut nicht still nichts, sondern öffnet die Schnelleingabe mit Grund-Weg', async () => {
    await finishFirstMatch();
    const { view, card } = await renderSchedule();

    act(() => { fireEvent.click(within(card()).getByTestId(`match-circle-${FIRST.id}`)); });
    const edit = await within(card()).findByTestId('match-summary-edit-score');
    act(() => { fireEvent.click(edit); });

    const expand = await within(card()).findByTestId('quick-score-expand');
    fireEvent.click(within(expand).getByLabelText(`${HOME?.name} Tor hinzufügen`));
    await act(async () => { fireEvent.click(within(expand).getByTestId('quick-score-save-btn')); await settle(); });
    expect((await view.findByTestId('result-entry-reason-dialog')).textContent).toContain('bisher 3:1 – neu 4:1');
  });

  it('Gegenbeispiel @FU-080: ein geplantes Spiel speichert wie bisher (RESULT_ENTRY, keine Grund-Auswahl)', async () => {
    const { view, card } = await renderSchedule();

    await quickEntry(card, 3, 1);

    expect(view.queryByTestId('result-entry-reason-dialog')).toBeNull();
    expect(eventTypes()).toEqual([['RESULT_ENTRY']]);
    expect(card().textContent).toMatch(/3\s*:\s*1/);
  });

  it('Gegenbeispiel @HE-042: als Helfer keine Korrektur, sondern der Hinweis „Korrektur nur durch die Turnierleitung“', async () => {
    await finishFirstMatch();
    actorRole.current = 'helper';
    const { view, card } = await renderSchedule();

    await quickEntry(card, 1, 0);

    expect(view.queryByTestId('result-entry-reason-dialog')).toBeNull();
    expect(await view.findByText('Korrektur nur durch die Turnierleitung')).toBeTruthy();
    expect(h.api).not.toHaveBeenCalled();
  });
});
