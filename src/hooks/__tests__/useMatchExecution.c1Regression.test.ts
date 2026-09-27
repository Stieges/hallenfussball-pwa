/**
 * useMatchExecution — C1 (Review Fixrunde 1, Critical): Regressionstest mit ECHTEM
 * `useEngineMatches`/`MatchEngine` (nicht gemockt) -- nur der React-Kontext-Zugriff
 * (`useMatchEngineContextOptional`) ist gemockt, wie es auch der echte `MatchEngineProvider`
 * fuer seine Konsumenten waere.
 *
 * Szenario (identisch zur beobachteten E2E-Regression "Can undo last event"): ein reines
 * Altspiel (keine Engine-Ereignisse) wird geladen. `useEngineMatches`s `ensureMatch`-Effekt legt
 * fuer dieses Spiel trotzdem eine lokale Kopie an -- das loest (ueber `engine.notify()`) eine
 * Benachrichtigung aus, OBWOHL sich an der sichtbaren Engine-Map nichts aendert (leer bleibt
 * leer). Ohne den C1-Fix haengt der Lade-Effekt in `useMatchExecution` an `engineLiveMatches` und
 * laeuft bei dieser Benachrichtigung ERNEUT -- ein zweiter, spaeter aufloesender
 * `liveMatchRepository.getAll()`-Aufruf ueberschreibt dann einen frisch per `handleStart`
 * gesetzten Zustand mit einem veralteten Snapshot.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { LocalMatchStore, MatchEngine, type ClockSync } from '../../core/match/client';
import type { Tournament, Match } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';

const OLD_MATCH_ID = 'old-1';
const ENGINE_MATCH_ID = 'engine-1';

const store = new LocalMatchStore();
const realBundle = {
  engine: new MatchEngine({
    store,
    clock: { serverNow: () => Date.now() } as unknown as ClockSync,
    sender: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn() },
    fetchConfirmed: vi.fn().mockResolvedValue({ events: [], newWatermark: 0 }),
    now: () => Date.now(),
  }),
  clock: { offsetMs: 0 },
};
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => realBundle,
}));

const mockStartMatch = vi.fn();
vi.mock('../../core/services/MatchExecutionService', () => {
  class MockMatchExecutionService {
    startMatch = mockStartMatch;
    calculateElapsedSeconds = () => 0;
  }
  return { MatchExecutionService: MockMatchExecutionService };
});

const mockLiveMatchRepository = {
  get: vi.fn(),
  getAll: vi.fn(),
  save: vi.fn(),
  saveAll: vi.fn(),
  delete: vi.fn(),
  deleteEvent: vi.fn(),
  clear: vi.fn(),
};
const mockTournamentRepository = { get: vi.fn(), getByShareCode: vi.fn(), save: vi.fn(), updateMatch: vi.fn() };
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({
    tournamentRepository: mockTournamentRepository,
    liveMatchRepository: mockLiveMatchRepository,
    isRealtimeEnabled: false,
    supabaseLiveMatchRepo: null,
  }),
}));
vi.mock('../useMultiTabSync', () => ({
  useMultiTabSync: () => ({
    announceActive: vi.fn(), announceInactive: vi.fn(), announceMatchStarted: vi.fn(),
    announceMatchFinished: vi.fn(), announceMatchPaused: vi.fn(), announceMatchResumed: vi.fn(),
    announceMatchUpdated: vi.fn(),
  }),
}));
vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(), showError: vi.fn(), showWarning: vi.fn(), showInfo: vi.fn(),
    showGoalWithUndo: vi.fn(), showMigrationSuccess: vi.fn(), dismiss: vi.fn(), dismissAll: vi.fn(),
  }),
}));

import { useMatchExecution } from '../useMatchExecution';

function oldMatch(): Match {
  return { id: OLD_MATCH_ID, teamA: 'teama', teamB: 'teamb', round: 1, field: 1, matchNumber: 1 };
}

function engineMatch(): Match {
  return { id: ENGINE_MATCH_ID, teamA: 'teamc', teamB: 'teamd', round: 1, field: 2, matchNumber: 2 };
}

// Stabile Referenz: `tournament.matches` steht als Dependency im Lade-Effekt -- eine bei jedem
// `renderHook`-Durchlauf neu erzeugte Array-/Objekt-Instanz wuerde den Effekt bei JEDEM Render
// (auch ohne jede Engine-Beteiligung) retriggern und den C1-Test verfaelschen.
const STABLE_MATCHES = [oldMatch()];

const STABLE_TOURNAMENT = {
  id: 'tour-c1-regression',
  matches: STABLE_MATCHES,
  teams: [{ id: 'teama', name: 'Heim' }, { id: 'teamb', name: 'Gast' }],
  groupPhaseGameDuration: 20,
} as unknown as Tournament;

function tournament(): Tournament {
  return STABLE_TOURNAMENT;
}

// N-I1 (Fixrunde 2): gemischtes Turnier (Altspiel + ECHTES Engine-Spiel) -- eine reine Altturnier-
// Kopie deckt Fix (a) nicht ab, siehe Testkommentar unten.
const MIXED_MATCHES = [oldMatch(), engineMatch()];
const MIXED_TOURNAMENT = {
  id: 'tour-c1-regression-mixed',
  matches: MIXED_MATCHES,
  teams: [
    { id: 'teama', name: 'Heim' }, { id: 'teamb', name: 'Gast' },
    { id: 'teamc', name: 'Heim2' }, { id: 'teamd', name: 'Gast2' },
  ],
  groupPhaseGameDuration: 20,
} as unknown as Tournament;

function mixedTournament(): Tournament {
  return MIXED_TOURNAMENT;
}

function notStarted(): LiveMatch {
  return {
    id: OLD_MATCH_ID, number: 1, status: 'NOT_STARTED', phaseLabel: 'Gruppe A', fieldId: 'field-1',
    scheduledKickoff: new Date().toISOString(), durationSeconds: 600,
    homeTeam: { id: 'teama', name: 'Heim' }, awayTeam: { id: 'teamb', name: 'Gast' },
    homeScore: 0, awayScore: 0, elapsedSeconds: 0, events: [],
  } as unknown as LiveMatch;
}

function running(): LiveMatch {
  return { ...notStarted(), status: 'RUNNING', timerStartTime: new Date().toISOString() };
}

describe('useMatchExecution — C1 (Regression, echte MatchEngine)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await realBundle.engine.start('acc-c1-regression');
    mockLiveMatchRepository.getAll.mockResolvedValue(new Map([[OLD_MATCH_ID, notStarted()]]));
    mockStartMatch.mockResolvedValue(running());
  });

  it('ein frischer Zustand (handleStart) wird NICHT von einem spaeten, durch eine Engine-Benachrichtigung ausgeloesten getAll() ueberschrieben', async () => {
    // Zweiter (bei einer Regression zusaetzlicher) `getAll()`-Aufruf haengt, bis der Test ihn
    // manuell aufloest -- mit VERALTETEN Daten (NOT_STARTED), um den Ruecksprung sichtbar zu machen.
    let secondCallResolve: ((value: Map<string, LiveMatch>) => void) | null = null;
    mockLiveMatchRepository.getAll.mockImplementation(() => {
      if (mockLiveMatchRepository.getAll.mock.calls.length === 1) {
        return Promise.resolve(new Map([[OLD_MATCH_ID, notStarted()]]));
      }
      return new Promise<Map<string, LiveMatch>>((resolve) => { secondCallResolve = resolve; });
    });

    const { result } = renderHook(() =>
      useMatchExecution({ tournament: tournament(), onLocalTournamentUpdate: vi.fn() }),
    );

    await waitFor(() => expect(result.current.liveMatches.get(OLD_MATCH_ID)?.status).toBe('NOT_STARTED'));

    // Die Engine legt fuer 'old-1' eine Kopie an (kein Engine-Spiel, aber die Benachrichtigung
    // laeuft trotzdem -- genau das ist der Ausloeser der Regression).
    await waitFor(() => expect(store.load('acc-c1-regression', OLD_MATCH_ID)).resolves.not.toBeNull());

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.handleStart(OLD_MATCH_ID);
    });
    expect(started).toBe(true);
    expect(mockStartMatch).toHaveBeenCalled();
    expect(result.current.liveMatches.get(OLD_MATCH_ID)?.status).toBe('RUNNING');

    // Falls der Lade-Effekt (Regression) einen zweiten `getAll()` ausgeloest hat, jetzt mit
    // veralteten Daten aufloesen -- das darf den frischen "RUNNING"-Zustand NICHT zuruecksetzen.
    if (mockLiveMatchRepository.getAll.mock.calls.length > 1) {
      (secondCallResolve as ((value: Map<string, LiveMatch>) => void) | null)?.(
        new Map([[OLD_MATCH_ID, notStarted()]]),
      );
    }
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.liveMatches.get(OLD_MATCH_ID)?.status).toBe('RUNNING');
    // Der C1-Fix (kein `engineLiveMatches` in den Lade-Effekt-Abhaengigkeiten) bedeutet konkret:
    // der Lade-Effekt laeuft ueberhaupt nur EINMAL (beim Mounten), unabhaengig von Engine-
    // Benachrichtigungen.
    expect(mockLiveMatchRepository.getAll).toHaveBeenCalledTimes(1);
  });

  /**
   * N-I1 (Re-Review Fixrunde 1): das obige, reine Altturnier deckt NUR Fix (b) ab (die Engine-Map
   * bleibt inhaltlich leer, `stableLiveMatches` haette allein schon gereicht). Um Fix (a) (keine
   * `engineLiveMatches`-Abhaengigkeit im Lade-Effekt) ISOLIERT zu pruefen, braucht es ein Turnier
   * mit einem ECHTEN Engine-Spiel, dessen Kopie sich waehrend des Tests INHALTLICH aendert -- dann
   * kann `stableLiveMatches` (b) die neue Map nicht mehr unterdruecken, und nur (a) verhindert noch,
   * dass der Lade-Effekt erneut laeuft und einen frischen Altspiel-Zustand ueberschreibt.
   */
  it('gemischtes Turnier (Altspiel + echtes Engine-Spiel): eine Engine-Aenderung mit echtem Inhaltswechsel darf den Lade-Effekt nicht erneut auslösen', async () => {
    const engineCtx = { matchId: ENGINE_MATCH_ID, teamAId: 'teamc', teamBId: 'teamd' };
    // 'engine-1' ist schon VOR dem Rendern ein Engine-Spiel (ein bestaetigtes MATCH_START) --
    // B1 erkennt es beim ersten `ensureMatch` sofort ueber `view.log.length > 0`.
    await store.create('acc-c1-regression', ENGINE_MATCH_ID, engineCtx, MIXED_TOURNAMENT.id);
    await store.applyConfirmed('acc-c1-regression', ENGINE_MATCH_ID, [
      {
        id: 'start-1', type: 'MATCH_START', at: 0, actor: 'leitung', section: 1, clockMs: 0,
        payload: {
          rules: { sections: 2, sectionSeconds: 600, breakSeconds: 60, knockout: false, tiebreak: null, overtimeSeconds: 0, shootersPerTeam: 5, suddenDeathAfter: 5, penaltySeconds: 120 },
        },
        seq: 1,
      },
    ], 1);

    let secondCallResolve: ((value: Map<string, LiveMatch>) => void) | null = null;
    mockLiveMatchRepository.getAll.mockImplementation(() => {
      if (mockLiveMatchRepository.getAll.mock.calls.length === 1) {
        return Promise.resolve(new Map([[OLD_MATCH_ID, notStarted()]]));
      }
      return new Promise<Map<string, LiveMatch>>((resolve) => { secondCallResolve = resolve; });
    });

    const { result } = renderHook(() =>
      useMatchExecution({ tournament: mixedTournament(), onLocalTournamentUpdate: vi.fn() }),
    );

    await waitFor(() => expect(result.current.liveMatches.get(OLD_MATCH_ID)?.status).toBe('NOT_STARTED'));
    await waitFor(() => expect(result.current.liveMatches.get(ENGINE_MATCH_ID)).toBeDefined());

    let started: boolean | undefined;
    await act(async () => {
      started = await result.current.handleStart(OLD_MATCH_ID);
    });
    expect(started).toBe(true);
    expect(result.current.liveMatches.get(OLD_MATCH_ID)?.status).toBe('RUNNING');

    // JETZT aendert sich der Inhalt der Engine-Kopie ECHT (ein neues pending-Ereignis) -- danach
    // erneut `ensureMatch`, damit die Engine die Aenderung in ihren Speicher-Cache liest und
    // `notify()` mit GEAENDERTEM Inhalt ausloest (Fix (b) kann das nicht mehr als "unveraendert"
    // erkennen -- nur Fix (a) schuetzt jetzt noch vor dem Ruecksprung).
    await store.addPending('acc-c1-regression', ENGINE_MATCH_ID, {
      id: 'goal-1', type: 'GOAL', at: 1000, actor: 'leitung', section: 1, clockMs: 500,
      teamId: 'teamc', payload: {},
    });
    await realBundle.engine.ensureMatch(ENGINE_MATCH_ID, engineCtx, MIXED_TOURNAMENT.id);

    if (mockLiveMatchRepository.getAll.mock.calls.length > 1) {
      (secondCallResolve as ((value: Map<string, LiveMatch>) => void) | null)?.(
        new Map([[OLD_MATCH_ID, notStarted()]]),
      );
    }
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.liveMatches.get(OLD_MATCH_ID)?.status).toBe('RUNNING');
    expect(mockLiveMatchRepository.getAll).toHaveBeenCalledTimes(1);
  });
});
