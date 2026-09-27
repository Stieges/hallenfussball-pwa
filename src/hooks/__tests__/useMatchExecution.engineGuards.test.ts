/**
 * useMatchExecution — C3a-1 (B4/B5): Wachen fuer Engine-Spiele.
 *
 * B4: liveMatchRepository.save/initializeMatch/syncMatchMetadata werden fuer ein Engine-Spiel NIE
 * aufgerufen (Lade-Effekt, getLiveMatchData, handleReopenMatch).
 * B5: ein Realtime-Push fuer ein Engine-Spiel ueberschreibt `liveMatches` NICHT, sondern stoesst
 * `engine.catchUp(matchId)` an.
 *
 * `useEngineMatches` selbst ist bereits eigenstaendig getestet (useEngineMatches.test.tsx) — hier
 * geht es NUR um die Verdrahtung in useMatchExecution.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { LiveMatch } from '../../core/models/LiveMatch';
import type { ScheduledMatch } from '../../core/generators';

const ENGINE_MATCH_ID = 'engine-match-1';

const engineLiveMatch: LiveMatch = {
  id: ENGINE_MATCH_ID,
  number: 1,
  status: 'RUNNING',
  phaseLabel: 'Gruppe A',
  fieldId: 'field-1',
  scheduledKickoff: new Date().toISOString(),
  durationSeconds: 600,
  homeTeam: { id: 'team-a', name: 'FC Alpha' },
  awayTeam: { id: 'team-b', name: 'SV Beta' },
  homeScore: 1,
  awayScore: 0,
  elapsedSeconds: 120,
  events: [],
} as unknown as LiveMatch;

// Referentiell stabil (EIN Map-Objekt fuer den ganzen Testlauf) -- sonst haelt jeder Aufrufer,
// der sie in einer Abhaengigkeitsliste fuehrt (der Lade-Effekt in useMatchExecution), nie an.
const engineLiveMatchesMap = new Map<string, LiveMatch>([[ENGINE_MATCH_ID, engineLiveMatch]]);

const NEW_ENGINE_MATCH_ID = 'new-engine-match-1';
// P2 (Fixrunde 3, E1-Randfall): steht wie NEW_ENGINE_MATCH_ID NICHT in `engineLiveMatchesMap` --
// simuliert ein auf einem ANDEREN Geraet laufendes Engine-Spiel (matchStatus != scheduled), das
// dieses Geraet noch nicht als Engine-Spiel kennt.
const FOREIGN_MATCH_ID = 'foreign-match-1';

const mockCatchUp = vi.fn().mockResolvedValue(undefined);
// Referentiell stabil (s. o.) -- `matchEngineContext` steht als Dependency in
// `handleRealtimeChange` (useCallback) in useMatchExecution.ts.
const mockMatchEngineContext = { engine: { catchUp: mockCatchUp } };
// Fixrunde 2, Item 2 (B4-Race): NEW_ENGINE_MATCH_ID steht bewusst NICHT in `engineLiveMatchesMap`
// (so wie ein brandneues Engine-Spiel im allerersten Render, bevor `ensureMatch` eine lokale
// Kopie angelegt hat) -- `isEngineDestinedMatch` markiert es trotzdem als Engine-Spiel.
const mockEnsureEngineMatchReady = vi.fn<(id: string) => Promise<LiveMatch | null>>();
vi.mock('../useEngineMatches', () => ({
  useEngineMatches: () => ({
    liveMatches: engineLiveMatchesMap,
    isEngineMatch: (id: string) => id === ENGINE_MATCH_ID,
  }),
  // useEngineCommandWiring braucht buildValidMatches nur fuer die ctx-Map (handleStart/Goal/...);
  // diese Suite prueft ausschliesslich B4/B5 (Lade-Effekt/getLiveMatchData/handleReopenMatch/
  // Realtime), keine Befehle -- ein Stub-Eintrag reicht.
  buildValidMatches: () => [
    { matchId: ENGINE_MATCH_ID, externalId: ENGINE_MATCH_ID, ctx: { matchId: ENGINE_MATCH_ID, teamAId: 'team-a', teamBId: 'team-b' } },
  ],
}));
// Fixrunde 2, Item 2 (B4-Race): `isEngineDestinedMatch`/`ensureEngineMatchReady` sitzen in einer
// eigenen Datei (`useEngineMatchReadiness`, W11/Report-Auflage Item 7 -- `useEngineMatches.ts`
// darf nicht weiter wachsen), deshalb ein eigener Mock statt im `useEngineMatches`-Mock oben.
vi.mock('../useEngineMatchReadiness', () => ({
  useEngineMatchReadiness: () => ({
    isEngineDestinedMatch: (id: string) => id === NEW_ENGINE_MATCH_ID || id === FOREIGN_MATCH_ID,
    isForeignCandidateMatch: (id: string) => id === FOREIGN_MATCH_ID,
    ensureEngineMatchReady: mockEnsureEngineMatchReady,
  }),
}));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => mockMatchEngineContext,
}));

const mockInitializeMatch = vi.fn();
const mockSyncMatchMetadata = vi.fn();
vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

vi.mock('../../core/services/MatchExecutionService', () => {
  class MockMatchExecutionService {
    initializeMatch = mockInitializeMatch;
    syncMatchMetadata = mockSyncMatchMetadata;
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
/** Faengt den Realtime-Callback ein, damit der Test einen Push simulieren kann (B5). */
let capturedOnMatchChange: ((matchId: string, match: LiveMatch | null) => void) | null = null;
const mockSupabaseLiveMatchRepo = {
  subscribe: vi.fn((_tournamentId: string, handlers: { onMatchChange: typeof capturedOnMatchChange }) => {
    capturedOnMatchChange = handlers.onMatchChange;
  }),
  unsubscribe: vi.fn(),
};
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({
    tournamentRepository: mockTournamentRepository,
    liveMatchRepository: mockLiveMatchRepository,
    isRealtimeEnabled: true,
    supabaseLiveMatchRepo: mockSupabaseLiveMatchRepo,
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

import { useMatchExecution } from '../useMatchExecution';

const EMPTY_MATCHES: Tournament['matches'] = [];

function makeTournament(matches: Tournament['matches'] = EMPTY_MATCHES): Tournament {
  return { id: 'tour-engine-guards', matches } as unknown as Tournament;
}

async function renderAndFlush(tournament: Tournament = makeTournament()) {
  const view = renderHook(() => useMatchExecution({ tournament, onLocalTournamentUpdate: vi.fn() }));
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return view;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockLiveMatchRepository.getAll.mockResolvedValue(new Map());
  mockEnsureEngineMatchReady.mockReset();
});

describe('useMatchExecution — B4: kein liveMatchRepository.save/initializeMatch fuer Engine-Spiele', () => {
  it('Lade-Effekt ruft syncMatchMetadata nicht fuer ein Engine-Spiel', async () => {
    // Review I7/M1: `tournament.matches` MUSS einen Eintrag mit ABWEICHENDEM Schiri enthalten --
    // sonst findet `tournament.matches.find(...)` nie etwas, und der `if (scheduled)`-Block laeuft
    // so oder so nie an (die Mutation "B4-Wache entfernt" bliebe unbemerkt gruen).
    const tournament = makeTournament([
      { id: ENGINE_MATCH_ID, referee: 7 } as unknown as Tournament['matches'][number],
    ]);
    // Der Alt-Repo liefert (kuenstlich) auch eine Zeile fuer die Engine-match-ID zurueck --
    // realistisch, falls das Spiel frueher ueber den Altpfad lief. Der Guard muss trotzdem greifen.
    mockLiveMatchRepository.getAll.mockResolvedValue(
      new Map([[ENGINE_MATCH_ID, { ...engineLiveMatch, refereeName: undefined }]]),
    );
    await renderAndFlush(tournament);
    expect(mockSyncMatchMetadata).not.toHaveBeenCalled();
  });

  it('getLiveMatchData liefert die Engine-Ansicht, ruft aber service.initializeMatch nicht auf', async () => {
    const { result } = await renderAndFlush();
    const scheduled = { id: ENGINE_MATCH_ID } as unknown as ScheduledMatch;

    const data = await act(() => result.current.getLiveMatchData(scheduled));

    expect(data).toBe(engineLiveMatch);
    expect(mockInitializeMatch).not.toHaveBeenCalled();
    expect(mockLiveMatchRepository.save).not.toHaveBeenCalled();
  });

  it('handleReopenMatch speichert fuer ein Engine-Spiel nichts im Alt-Repo', async () => {
    const { result } = await renderAndFlush();
    const scheduled = { id: ENGINE_MATCH_ID } as unknown as ScheduledMatch;

    await act(() => result.current.handleReopenMatch(scheduled));

    expect(mockLiveMatchRepository.get).not.toHaveBeenCalled();
    expect(mockLiveMatchRepository.save).not.toHaveBeenCalled();
  });

  it('liveMatches (Rueckgabe) enthaelt die Engine-Ansicht fuer das Engine-Spiel', async () => {
    const { result } = await renderAndFlush();
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID)).toBe(engineLiveMatch);
  });

  it('Fixrunde 2 (Item 2, B4-Race): ein NEUES Engine-Spiel (noch keine Engine-Kopie) ruft ensureEngineMatchReady statt initializeMatch/save auf', async () => {
    const readyMatch: LiveMatch = { ...engineLiveMatch, id: NEW_ENGINE_MATCH_ID };
    mockEnsureEngineMatchReady.mockResolvedValueOnce(readyMatch);
    const { result } = await renderAndFlush();
    const scheduled = { id: NEW_ENGINE_MATCH_ID } as unknown as ScheduledMatch;

    const data = await act(() => result.current.getLiveMatchData(scheduled));

    expect(mockEnsureEngineMatchReady).toHaveBeenCalledWith(NEW_ENGINE_MATCH_ID);
    expect(data).toBe(readyMatch);
    expect(mockInitializeMatch).not.toHaveBeenCalled();
    expect(mockLiveMatchRepository.save).not.toHaveBeenCalled();
  });

  it('Fixrunde 2 (Item 2, B4-Race): loest die Engine noch keine Ansicht auf (ensureMatch noch nicht fertig), faellt getLiveMatchData TROTZDEM nicht auf initializeMatch/save zurueck', async () => {
    mockEnsureEngineMatchReady.mockResolvedValueOnce(null);
    const { result } = await renderAndFlush();
    const scheduled = { id: NEW_ENGINE_MATCH_ID } as unknown as ScheduledMatch;

    await expect(act(() => result.current.getLiveMatchData(scheduled))).rejects.toThrow();

    expect(mockInitializeMatch).not.toHaveBeenCalled();
    expect(mockLiveMatchRepository.save).not.toHaveBeenCalled();
  });

  it('P2 (Fixrunde 3, E1-Randfall): ein fremd (auf einem anderen Geraet) laufendes Engine-Spiel ruft 0x initializeMatch/save, kein Altweg-Anpfiff', async () => {
    const readyMatch: LiveMatch = { ...engineLiveMatch, id: FOREIGN_MATCH_ID };
    mockEnsureEngineMatchReady.mockResolvedValueOnce(readyMatch);
    const { result } = await renderAndFlush();
    const scheduled = { id: FOREIGN_MATCH_ID } as unknown as ScheduledMatch;

    const data = await act(() => result.current.getLiveMatchData(scheduled));

    expect(mockEnsureEngineMatchReady).toHaveBeenCalledWith(FOREIGN_MATCH_ID);
    expect(data).toBe(readyMatch);
    expect(mockInitializeMatch).not.toHaveBeenCalled();
    expect(mockLiveMatchRepository.save).not.toHaveBeenCalled();
  });

  it('P2 (Fixrunde 3, E1-Randfall): hat der Server fuer den fremd-Kandidaten KEINE Ereignisse, faellt getLiveMatchData auf initializeMatch (Altweg) zurueck -- OHNE zu werfen', async () => {
    mockEnsureEngineMatchReady.mockResolvedValueOnce(null);
    const oldStyleMatch: LiveMatch = { ...engineLiveMatch, id: FOREIGN_MATCH_ID };
    mockInitializeMatch.mockResolvedValueOnce(oldStyleMatch);
    const { result } = await renderAndFlush();
    const scheduled = { id: FOREIGN_MATCH_ID } as unknown as ScheduledMatch;

    const data = await act(() => result.current.getLiveMatchData(scheduled));

    expect(mockEnsureEngineMatchReady).toHaveBeenCalledWith(FOREIGN_MATCH_ID);
    expect(mockInitializeMatch).toHaveBeenCalledTimes(1);
    expect(data).toBe(oldStyleMatch);
  });
});

describe('useMatchExecution — B5: Realtime ignoriert Engine-Spiele und stoesst catchUp an', () => {
  it('ein Push fuer ein Engine-Spiel ueberschreibt liveMatches nicht und ruft engine.catchUp genau einmal', async () => {
    const { result } = await renderAndFlush();
    expect(capturedOnMatchChange).not.toBeNull();
    const before = result.current.liveMatches.get(ENGINE_MATCH_ID);

    const pushedFromServer: LiveMatch = { ...engineLiveMatch, homeScore: 99 };
    act(() => {
      capturedOnMatchChange?.(ENGINE_MATCH_ID, pushedFromServer);
    });

    expect(mockCatchUp).toHaveBeenCalledWith(ENGINE_MATCH_ID);
    expect(mockCatchUp).toHaveBeenCalledTimes(1);
    // Der Alt-Push (homeScore 99) darf NICHT uebernommen worden sein.
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID)).toBe(before);
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID)?.homeScore).not.toBe(99);
  });

  it('ein Push fuer ein Altspiel wird weiterhin normal uebernommen (Regression)', async () => {
    const { result } = await renderAndFlush();
    const oldMatchPush: LiveMatch = { ...engineLiveMatch, id: 'old-match-1', homeScore: 5 };

    act(() => {
      capturedOnMatchChange?.('old-match-1', oldMatchPush);
    });

    expect(mockCatchUp).not.toHaveBeenCalled();
    expect(result.current.liveMatches.get('old-match-1')).toEqual(oldMatchPush);
  });

  it('N2-m3: ein Push mit abweichender Schreibweise (Server liefert match_id klein) wird trotzdem als Engine-Spiel erkannt', async () => {
    const { result } = await renderAndFlush();
    const before = result.current.liveMatches.get(ENGINE_MATCH_ID);

    act(() => {
      capturedOnMatchChange?.(ENGINE_MATCH_ID.toUpperCase(), { ...engineLiveMatch, homeScore: 99 });
    });

    expect(mockCatchUp).toHaveBeenCalledWith(ENGINE_MATCH_ID.toUpperCase());
    // Kein Fallback auf den Alt-Pfad -- der Push wird NICHT als eigener (grossgeschriebener)
    // Alt-Eintrag uebernommen.
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID.toUpperCase())).toBeUndefined();
    expect(result.current.liveMatches.get(ENGINE_MATCH_ID)).toBe(before);
  });
});
