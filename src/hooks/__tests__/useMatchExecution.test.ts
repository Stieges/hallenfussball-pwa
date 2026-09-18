/**
 * useMatchExecution — Fixwave (2026-09-18)
 *
 * FIX 1 (Critical): handleAbortPenaltyShootout — Gegenstück zu handleStartPenaltyShootout, bricht
 * ein begonnenes Elfmeterschießen ab (service.abortPenaltyShootout), OHNE das Spiel zu beenden.
 *
 * FIX 2 (Important): handleDeleteEvent war der einzige Mutation-Handler ohne catch/refreshMatchState/
 * announceMatchUpdated. Der Aufruf ist fire-and-forget (ManagementTab.tsx: `void handleDeleteEvent(...)`)
 * und LiveCockpit zeigt den Erfolgs-Toast bereits VOR Abschluss des Promises — ein nach Retries
 * fehlgeschlagenes Löschen blieb dadurch unsichtbar. Diese Tests beweisen: der Handler wirft nicht,
 * frischt den State auf und zeigt eine ehrliche Fehlermeldung.
 *
 * Alle Repository-/Kontext-Abhängigkeiten sind gemockt, damit der Hook isoliert (ohne echte Provider)
 * getestet werden kann.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMatchExecution } from '../useMatchExecution';
import { OptimisticLockError } from '../../core/errors';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDeleteEvent = vi.fn();
const mockAbortPenaltyShootout = vi.fn();

vi.mock('../../core/services/MatchExecutionService', () => {
  // Arrow-function-Implementierungen sind nicht `new`-fähig — echte Klasse statt
  // vi.fn().mockImplementation(() => ({...})), sonst wirft `new MatchExecutionService(...)`.
  class MockMatchExecutionService {
    deleteEvent = mockDeleteEvent;
    abortPenaltyShootout = mockAbortPenaltyShootout;
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

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({
    tournamentRepository: mockTournamentRepository,
    liveMatchRepository: mockLiveMatchRepository,
  }),
}));

const mockAnnounceMatchUpdated = vi.fn();
vi.mock('../useMultiTabSync', () => ({
  useMultiTabSync: () => ({
    announceActive: vi.fn(),
    announceInactive: vi.fn(),
    announceMatchStarted: vi.fn(),
    announceMatchFinished: vi.fn(),
    announceMatchPaused: vi.fn(),
    announceMatchResumed: vi.fn(),
    announceMatchUpdated: mockAnnounceMatchUpdated,
  }),
}));

const mockShowInfo = vi.fn();
const mockShowError = vi.fn();
vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({
    showSuccess: vi.fn(),
    showError: mockShowError,
    showWarning: vi.fn(),
    showInfo: mockShowInfo,
    showGoalWithUndo: vi.fn(),
    showMigrationSuccess: vi.fn(),
    dismiss: vi.fn(),
    dismissAll: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Stabile Referenz: `tournament.matches` steht als Dependency im Lade-Effekt des Hooks
// (`useEffect(..., [tournament.id, tournament.matches, ...])`). Eine bei jedem renderHook-Durchlauf
// neu erzeugte Array-Instanz würde den Effekt endlos retriggern (Render-Loop, act() hängt).
const EMPTY_MATCHES: Tournament['matches'] = [];

function makeTournament(): Tournament {
  return {
    id: 'tour-1',
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
    scheduledKickoff: new Date().toISOString(),
    durationSeconds: 600,
    homeTeam: { id: 'team-a', name: 'FC Alpha' },
    awayTeam: { id: 'team-b', name: 'SV Beta' },
    homeScore: 2,
    awayScore: 2,
    elapsedSeconds: 600,
    events: [],
    ...overrides,
  } as unknown as LiveMatch;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLiveMatchRepository.getAll.mockResolvedValue(new Map());
});

// Rendert den Hook und wartet den asynchronen Lade-Effekt (liveMatchRepository.getAll) ab, BEVOR
// ein Handler aufgerufen wird — sonst gewinnt manchmal das Race: der Lade-Effekt überschreibt den
// vom Handler gerade gesetzten liveMatches-State mit der (leeren) Map aus getAll().
async function renderAndFlush(onTournamentUpdate: (t: Tournament, r?: boolean) => void = vi.fn()) {
  const tournament = makeTournament();
  const view = renderHook(() => useMatchExecution({ tournament, onTournamentUpdate }));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

// ---------------------------------------------------------------------------
// FIX 2: handleDeleteEvent
// ---------------------------------------------------------------------------

describe('useMatchExecution — handleDeleteEvent (Fixwave FIX 2)', () => {
  it('bei fehlgeschlagenem deleteEvent (Retries erschöpft) wird der State aufgefrischt, ein Fehler gezeigt, und der Handler wirft NICHT', async () => {
    mockDeleteEvent.mockRejectedValueOnce(new Error('network down'));
    mockLiveMatchRepository.get.mockResolvedValueOnce(makeLiveMatch());

    const { result } = await renderAndFlush();

    await act(async () => {
      await expect(result.current.handleDeleteEvent('match-1', 'evt-1')).resolves.toBeUndefined();
    });

    // refreshMatchState gelaufen
    expect(mockLiveMatchRepository.get).toHaveBeenCalledWith('tour-1', 'match-1');
    // ehrliche Fehlermeldung statt stillschweigend "gelöscht"
    expect(mockShowError).toHaveBeenCalledTimes(1);
    expect(mockShowInfo).not.toHaveBeenCalled();
  });

  it('bei OptimisticLockError wird der State aufgefrischt und ein Konflikt-Hinweis gezeigt (nicht der generische Fehler)', async () => {
    mockDeleteEvent.mockRejectedValueOnce(new OptimisticLockError('match-1'));
    mockLiveMatchRepository.get.mockResolvedValueOnce(makeLiveMatch());

    const { result } = await renderAndFlush();

    await act(async () => {
      await result.current.handleDeleteEvent('match-1', 'evt-1');
    });

    expect(mockLiveMatchRepository.get).toHaveBeenCalledWith('tour-1', 'match-1');
    expect(mockShowInfo).toHaveBeenCalledTimes(1);
    expect(mockShowError).not.toHaveBeenCalled();
  });

  it('Regression: bei Erfolg wird der Live-Match-State aktualisiert und announceMatchUpdated aufgerufen, kein Fehler-Toast', async () => {
    const updated = makeLiveMatch({ events: [] });
    mockDeleteEvent.mockResolvedValueOnce(updated);

    const { result } = await renderAndFlush();

    await act(async () => {
      await result.current.handleDeleteEvent('match-1', 'evt-1');
    });

    expect(mockDeleteEvent).toHaveBeenCalledWith('tour-1', 'match-1', 'evt-1');
    expect(result.current.liveMatches.get('match-1')).toEqual(updated);
    expect(mockAnnounceMatchUpdated).toHaveBeenCalledWith('match-1');
    expect(mockShowError).not.toHaveBeenCalled();
    expect(mockLiveMatchRepository.get).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// FIX 1: handleAbortPenaltyShootout
// ---------------------------------------------------------------------------

describe('useMatchExecution — handleAbortPenaltyShootout (Fixwave FIX 1)', () => {
  it('ruft service.abortPenaltyShootout auf und übernimmt das Ergebnis in liveMatches, OHNE das Turnier neu zu laden (kein Finish)', async () => {
    const onTournamentUpdate = vi.fn();
    const aborted = makeLiveMatch({ playPhase: 'penalty', awaitingTiebreakerChoice: true, status: 'PAUSED' });
    mockAbortPenaltyShootout.mockResolvedValueOnce(aborted);
    // handleAbortPenaltyShootout übernimmt (wie sein Vorbild handleCancelTiebreaker) NICHT den
    // Rückgabewert von service.abortPenaltyShootout direkt, sondern lädt danach über
    // liveMatchRepository.get den frischen Stand — der muss hier separat gemockt werden.
    mockLiveMatchRepository.get.mockResolvedValueOnce(aborted);

    const { result } = await renderAndFlush(onTournamentUpdate);

    await act(async () => {
      await result.current.handleAbortPenaltyShootout('match-1');
    });

    expect(mockAbortPenaltyShootout).toHaveBeenCalledWith('tour-1', 'match-1');
    expect(result.current.liveMatches.get('match-1')).toEqual(aborted);
    // kein Finish-Seiteneffekt: das Match wurde nicht beendet, also gibt es nichts am Turnier zu aktualisieren
    expect(onTournamentUpdate).not.toHaveBeenCalled();
  });

  it('bei OptimisticLockError wird der State aufgefrischt und ein Konflikt-Hinweis gezeigt, der Handler wirft NICHT', async () => {
    mockAbortPenaltyShootout.mockRejectedValueOnce(new OptimisticLockError('match-1'));
    mockLiveMatchRepository.get.mockResolvedValueOnce(makeLiveMatch());

    const { result } = await renderAndFlush();

    await act(async () => {
      await expect(result.current.handleAbortPenaltyShootout('match-1')).resolves.toBeUndefined();
    });

    expect(mockLiveMatchRepository.get).toHaveBeenCalledWith('tour-1', 'match-1');
    expect(mockShowInfo).toHaveBeenCalledTimes(1);
  });
});
