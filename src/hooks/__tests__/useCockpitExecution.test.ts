/**
 * useCockpitExecution (A-08a, @FU-069): Cockpit nur über Engine-Ereignisse.
 * Pflichttest: echter Engine-Weg (Spiel 1, scheduled). Gegenbeispiel: Schnelleingabe-Ergebnis (Spiel 2)
 * wird NICHT über einen Altweg gebaut, sondern wirft `MatchNotOnEngineError('resultEntered')`.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import type { ScheduledMatch } from '../../core/generators';
import { MatchAwaitingTeamsError, MatchNotOnEngineError } from '../../core/errors';
import { groupRank, looseVs, slots, testTeamSlot } from '../../test/matchSlotFixtures';
import { makeEngineContext, FIXTURE_ENGINE_MATCH_ID } from '../../test/engineContextFixture';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

const mockLiveRepo = vi.hoisted(() => ({
  save: vi.fn(),
  get: vi.fn(),
  getAll: vi.fn(),
  saveAll: vi.fn(),
  delete: vi.fn(),
  deleteEvent: vi.fn(),
  clear: vi.fn(),
}));
vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ liveMatchRepository: mockLiveRepo, isRealtimeEnabled: false, supabaseLiveMatchRepo: null }),
}));

const engineCtx = vi.hoisted(() => ({ current: null as MatchEngineContextValue | null }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineCtx.current,
}));

vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }),
}));

vi.mock('../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { useCockpitExecution } from '../useCockpitExecution';

const ENGINE_MATCH_ID = FIXTURE_ENGINE_MATCH_ID;
const RESULT_MATCH_ID = 'old-1';
const OPEN_SIDE_MATCH_ID = 'open-1';
const FOREIGN_RUNNING_MATCH_ID = 'run-1';

function tournament(): Tournament {
  return {
    id: 'tour-cockpit',
    matches: [
      { id: ENGINE_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 1 },
      {
        id: RESULT_MATCH_ID,
        ...looseVs('teama', 'teamb'),
        round: 1,
        field: 2,
        matchNumber: 2,
        matchStatus: 'finished',
        scoreA: 3,
        scoreB: 1,
      },
      // A1 (@TM-033): Seite B noch offen (Gruppenplatz, kein Team).
      {
        id: OPEN_SIDE_MATCH_ID,
        ...slots(testTeamSlot('teama'), groupRank('A', 2)),
        round: 2,
        field: 1,
        matchNumber: 3,
      },
      // A3: Fremd-Spiel läuft (anderes Gerät) mit Projektionsstand 1:0 – kein Ergebnis-Hinweis.
      {
        id: FOREIGN_RUNNING_MATCH_ID,
        ...looseVs('teama', 'teamb'),
        round: 3,
        field: 2,
        matchNumber: 4,
        matchStatus: 'running',
        scoreA: 1,
        scoreB: 0,
      },
    ],
    teams: [
      { id: 'teama', name: 'Heim' },
      { id: 'teamb', name: 'Gast' },
    ],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

function scheduled(id: string): ScheduledMatch {
  return { id } as unknown as ScheduledMatch;
}

describe('useCockpitExecution (A-08a, @FU-069)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    engineCtx.current = await makeEngineContext();
  });

  it('Pflicht: Engine-Spiel (scheduled) liefert NOT_STARTED 0:0 aus der Engine', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));

    const view = await result.current.getLiveMatchData(scheduled(ENGINE_MATCH_ID));

    expect(view.status).toBe('NOT_STARTED');
    expect(view.homeScore).toBe(0);
    expect(view.awayScore).toBe(0);
  });

  it('Pflicht: handleStart schreibt genau ein MATCH_START in den Engine-Log', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));

    await result.current.handleStart(ENGINE_MATCH_ID);

    const ctx = engineCtx.current;
    if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
    await waitFor(async () => {
      const copy = await ctx.store.load(ctx.accountId, ENGINE_MATCH_ID);
      expect(copy?.pending.map((e) => e.type)).toEqual(['MATCH_START']);
    });
  });

  it('Gegenbeispiel: Ergebnis schon eingetragen -> MatchNotOnEngineError(resultEntered), kein Altweg', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));

    const attempt = result.current.getLiveMatchData(scheduled(RESULT_MATCH_ID));

    await expect(attempt).rejects.toBeInstanceOf(MatchNotOnEngineError);
    await expect(attempt).rejects.toMatchObject({ reason: 'resultEntered' });
    expect(mockLiveRepo.save).not.toHaveBeenCalled();
    expect(mockLiveRepo.get).not.toHaveBeenCalled();
    expect(mockLiveRepo.getAll).not.toHaveBeenCalled();
  });

  it('@TM-033 Gegenbeispiel: Spiel mit offener Seite B -> MatchAwaitingTeamsError(openSides [B]), kein Altweg, Repo 0x', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));

    const attempt = result.current.getLiveMatchData(scheduled(OPEN_SIDE_MATCH_ID));

    await expect(attempt).rejects.toBeInstanceOf(MatchAwaitingTeamsError);
    await expect(attempt).rejects.toMatchObject({ matchId: OPEN_SIDE_MATCH_ID, openSides: ['B'] });
    expect(mockLiveRepo.save).not.toHaveBeenCalled();
    expect(mockLiveRepo.get).not.toHaveBeenCalled();
    expect(mockLiveRepo.getAll).not.toHaveBeenCalled();
  });

  it('A3 (@FU-069): laufendes Fremd-Spiel mit Stand 1:0 -> reason other (Engine-Klärung), nicht resultEntered', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));

    const attempt = result.current.getLiveMatchData(scheduled(FOREIGN_RUNNING_MATCH_ID));

    await expect(attempt).rejects.toBeInstanceOf(MatchNotOnEngineError);
    await expect(attempt).rejects.toMatchObject({ reason: 'other' });
  });
});
