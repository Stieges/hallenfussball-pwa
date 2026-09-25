/**
 * useMatchExecution — Realtime im Cockpit (Task 14, M2.5a)
 *
 * Bis hierher hatte das Cockpit KEIN Realtime-Abo: `useLiveMatches` abonniert, wird aber nur von
 * Monitor und Spielplan benutzt. Zwei Geräte am selben Turnier sahen dadurch unterschiedliche
 * Spielstände, bis eines schrieb und im OptimisticLockError landete.
 *
 * Diese Tests sichern die beiden tragenden Guards ab — jeweils in BEIDE Richtungen:
 *
 *  1. `match === null` löscht NICHT. Der Repo schickt `null` bei DELETE und auch dann, wenn ein
 *     UPDATE ein Match inaktiv macht (ein beendetes Spiel landet also hier). Das Cockpit braucht
 *     beendete Spiele weiterhin zum Wiedereröffnen und Korrigieren.
 *  2. Eine laufende eigene Mutation wird nicht überschrieben. Sonst kippt eine veraltete
 *     Server-Kopie ein gerade erfasstes Tor zurück.
 *
 * Dazu: Abmelden bei Unmount und bei Turnierwechsel, und `onError` meldet statt zu schweigen.
 *
 * Alle Repository-/Kontext-Abhängigkeiten sind gemockt, damit der Hook isoliert (ohne echte
 * Provider) getestet werden kann.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchExecution } from '../useMatchExecution';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE';
type MatchChangeHandler = (matchId: string, match: LiveMatch | null, changeType: ChangeType) => void;

interface SubscribeOptions {
  onMatchChange?: MatchChangeHandler;
  onError?: (error: Error) => void;
}

const mockSubscribe = vi.fn<(tournamentId: string, options: SubscribeOptions) => void>();
const mockUnsubscribe = vi.fn<(tournamentId: string) => void>();

const mockRecordGoal = vi.fn();

vi.mock('../../core/services/MatchExecutionService', () => {
  // Arrow-Implementierungen sind nicht `new`-fähig — echte Klasse statt vi.fn().mockImplementation().
  class MockMatchExecutionService {
    recordGoal = mockRecordGoal;
    syncMatchMetadata = vi.fn();
    calculateElapsedSeconds = vi.fn(() => 0);
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

const mockTournamentRepository = {
  get: vi.fn(),
  getByShareCode: vi.fn(),
  save: vi.fn(),
  updateMatch: vi.fn(),
};

// Stabile Instanz: der Hook hängt das Abo an die Identität des aufgelösten Repos. Eine bei jedem
// Render neue Instanz würde das Abo in jedem Render neu aufbauen und die Tests verfälschen.
const mockSupabaseLiveMatchRepo = {
  subscribe: mockSubscribe,
  unsubscribe: mockUnsubscribe,
};

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({
    tournamentRepository: mockTournamentRepository,
    liveMatchRepository: mockLiveMatchRepository,
    isRealtimeEnabled: true,
    supabaseLiveMatchRepo: mockSupabaseLiveMatchRepo,
    publicLiveMatchRepo: null,
  }),
}));

vi.mock('../useMultiTabSync', () => ({
  useMultiTabSync: () => ({
    announceActive: vi.fn(),
    announceInactive: vi.fn(),
    announceMatchStarted: vi.fn(),
    announceMatchFinished: vi.fn(),
    announceMatchPaused: vi.fn(),
    announceMatchResumed: vi.fn(),
    announceMatchUpdated: vi.fn(),
  }),
}));

vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    showGoalWithUndo: vi.fn(),
    showMigrationSuccess: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

const mockCaptureFeatureError = vi.fn();
vi.mock('../../lib/sentry', () => ({
  captureFeatureError: (...args: Parameters<typeof mockCaptureFeatureError>) =>
    mockCaptureFeatureError(...args),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Stabile Referenz: `tournament.matches` steht als Dependency im Lade-Effekt des Hooks. Ein bei
// jedem Render neu erzeugtes Array würde den Effekt endlos retriggern (Render-Loop, act() hängt).
const EMPTY_MATCHES: Tournament['matches'] = [];

function makeTournament(id = 'tour-1'): Tournament {
  return {
    id,
    matches: EMPTY_MATCHES,
  } as unknown as Tournament;
}

function makeLiveMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'match-1',
    number: 1,
    status: 'PAUSED',
    phaseLabel: 'Finale',
    fieldId: 'field-1',
    scheduledKickoff: '2026-09-18T10:00:00.000Z',
    durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' },
    awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 0,
    awayScore: 0,
    elapsedSeconds: 120,
    events: [],
    ...overrides,
  } as unknown as LiveMatch;
}

const LOCAL_MATCH = makeLiveMatch();

beforeEach(() => {
  vi.clearAllMocks();
  mockSubscribe.mockImplementation(() => undefined);
  mockUnsubscribe.mockImplementation(() => undefined);
  mockLiveMatchRepository.getAll.mockResolvedValue(new Map([[LOCAL_MATCH.id, LOCAL_MATCH]]));
});

/**
 * Rendert den Hook und wartet den asynchronen Lade-Effekt (liveMatchRepository.getAll) ab — sonst
 * überschreibt dieser später den gerade per Push gesetzten State.
 */
async function renderAndFlush(tournament: Tournament = makeTournament()) {
  const view = renderHook(
    (props: { tournament: Tournament }) =>
      useMatchExecution({ tournament: props.tournament, onLocalTournamentUpdate: vi.fn() }),
    { initialProps: { tournament } }
  );
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

/** Holt den Push-Callback, den der Hook beim letzten subscribe() übergeben hat. */
function latestOnMatchChange(): MatchChangeHandler {
  const calls = mockSubscribe.mock.calls;
  const last = calls[calls.length - 1];
  const handler = last?.[1]?.onMatchChange;
  if (!handler) {
    throw new Error('subscribe() wurde nicht (oder ohne onMatchChange) aufgerufen');
  }
  return handler;
}

/** Holt den Fehler-Callback des letzten subscribe(). */
function latestOnError(): (error: Error) => void {
  const calls = mockSubscribe.mock.calls;
  const last = calls[calls.length - 1];
  const handler = last?.[1]?.onError;
  if (!handler) {
    throw new Error('subscribe() wurde nicht (oder ohne onError) aufgerufen');
  }
  return handler;
}

// ---------------------------------------------------------------------------
// Guard 1: null ignorieren — beide Richtungen
// ---------------------------------------------------------------------------

describe('useMatchExecution — Realtime-Push', () => {
  it('übernimmt einen Push mit Match in liveMatches (Gegenrichtung zu Guard 1)', async () => {
    const { result } = await renderAndFlush();

    const fromServer = makeLiveMatch({ homeScore: 1, awayScore: 0 });
    act(() => {
      latestOnMatchChange()('match-1', fromServer, 'UPDATE');
    });

    expect(result.current.liveMatches.get('match-1')).toEqual(fromServer);
  });

  it('entfernt bei einem null-Push den lokalen Eintrag NICHT (DELETE)', async () => {
    const { result } = await renderAndFlush();
    expect(result.current.liveMatches.get('match-1')).toEqual(LOCAL_MATCH);

    act(() => {
      latestOnMatchChange()('match-1', null, 'DELETE');
    });

    expect(result.current.liveMatches.has('match-1')).toBe(true);
    expect(result.current.liveMatches.get('match-1')).toEqual(LOCAL_MATCH);
  });

  it('entfernt den Eintrag auch dann nicht, wenn ein UPDATE das Match inaktiv macht (beendetes Spiel ⇒ null)', async () => {
    const { result } = await renderAndFlush();

    act(() => {
      latestOnMatchChange()('match-1', null, 'UPDATE');
    });

    expect(result.current.liveMatches.get('match-1')).toEqual(LOCAL_MATCH);
  });
});

// ---------------------------------------------------------------------------
// Guard 2: laufende eigene Mutation nicht überschreiben — beide Richtungen
// ---------------------------------------------------------------------------

describe('useMatchExecution — Realtime-Push vs. laufende Mutation', () => {
  it('ignoriert einen Push, solange eine eigene Mutation läuft (sonst geht das gerade erfasste Tor verloren)', async () => {
    let resolveGoal: (match: LiveMatch) => void = () => undefined;
    mockRecordGoal.mockReturnValueOnce(
      new Promise<LiveMatch>((resolve) => {
        resolveGoal = resolve;
      })
    );

    const { result } = await renderAndFlush();

    let goalPromise: Promise<void> = Promise.resolve();
    await act(async () => {
      goalPromise = result.current.handleGoal('match-1', 'team-a', 1);
      await Promise.resolve();
    });

    // Vorbedingung: die Mutation läuft wirklich noch.
    expect(result.current.loadingStates.goal).toBe(true);

    const staleFromServer = makeLiveMatch({ homeScore: 0, awayScore: 0, elapsedSeconds: 999 });
    act(() => {
      latestOnMatchChange()('match-1', staleFromServer, 'UPDATE');
    });

    expect(result.current.liveMatches.get('match-1')).toEqual(LOCAL_MATCH);

    // Eigene Mutation abschließen — ihr Ergebnis gewinnt.
    const ownResult = makeLiveMatch({ homeScore: 1, awayScore: 0 });
    await act(async () => {
      resolveGoal(ownResult);
      await goalPromise;
    });

    expect(result.current.liveMatches.get('match-1')).toEqual(ownResult);
  });

  it('übernimmt einen Push, wenn keine Mutation mehr läuft', async () => {
    const ownResult = makeLiveMatch({ homeScore: 1, awayScore: 0 });
    mockRecordGoal.mockResolvedValueOnce(ownResult);

    const { result } = await renderAndFlush();

    await act(async () => {
      await result.current.handleGoal('match-1', 'team-a', 1);
    });
    expect(result.current.loadingStates.goal).toBe(false);

    const fromServer = makeLiveMatch({ homeScore: 1, awayScore: 1 });
    act(() => {
      latestOnMatchChange()('match-1', fromServer, 'UPDATE');
    });

    expect(result.current.liveMatches.get('match-1')).toEqual(fromServer);
  });
});

// ---------------------------------------------------------------------------
// Lebenszyklus des Abos
// ---------------------------------------------------------------------------

describe('useMatchExecution — Abo-Lebenszyklus', () => {
  it('abonniert das Turnier und meldet sich bei Unmount wieder ab', async () => {
    const { unmount } = await renderAndFlush();

    expect(mockSubscribe).toHaveBeenCalledWith('tour-1', expect.anything());
    expect(mockUnsubscribe).not.toHaveBeenCalled();

    unmount();

    expect(mockUnsubscribe).toHaveBeenCalledWith('tour-1');
  });

  it('meldet bei Turnierwechsel zuerst das alte Turnier ab und abonniert dann das neue', async () => {
    const order: string[] = [];
    mockSubscribe.mockImplementation((tournamentId) => {
      order.push(`subscribe:${tournamentId}`);
    });
    mockUnsubscribe.mockImplementation((tournamentId) => {
      order.push(`unsubscribe:${tournamentId}`);
    });

    const { rerender } = await renderAndFlush();
    expect(order).toEqual(['subscribe:tour-1']);

    await act(async () => {
      rerender({ tournament: makeTournament('tour-2') });
      await Promise.resolve();
    });

    expect(order).toEqual(['subscribe:tour-1', 'unsubscribe:tour-1', 'subscribe:tour-2']);
  });

  it('meldet einen Subscription-Fehler, statt ihn zu schlucken', async () => {
    await renderAndFlush();

    const error = new Error('Realtime subscription failed');
    act(() => {
      latestOnError()(error);
    });

    expect(mockCaptureFeatureError).toHaveBeenCalledWith(error, 'hooks', 'cockpitRealtime', {
      tournamentId: 'tour-1',
    });
  });
});
