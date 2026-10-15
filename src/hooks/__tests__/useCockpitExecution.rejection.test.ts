/**
 * useCockpitExecution — Ablehnung mit Grund (A-08b, @FU-069/@FU-070/@FU-071).
 * Echter Engine-Weg (echte MatchEngine + LocalMatchStore, fake-indexeddb). Kein Altweg.
 *
 * Pflicht: Spiel läuft (`handleStart`), `handleFinish`, dann `handleGoal(+1)` -> kein GOAL,
 * Toast „Spiel ist beendet – Korrektur über die Turnierleitung“ (@FU-069).
 * Gegenbeispiel: Spiel ohne Engine-Ansicht -> `handleStart` lehnt ab (Toast), kein Schreibzugriff.
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Tournament } from '../../types/tournament';
import { looseVs } from '../../test/matchSlotFixtures';
import { makeEngineContext, FIXTURE_ENGINE_MATCH_ID } from '../../test/engineContextFixture';
import type { MatchEngineContextValue } from '../../features/match-engine/matchEngineContextInstance';

const toast = vi.hoisted(() => ({ showWarning: vi.fn(), showError: vi.fn(), showInfo: vi.fn() }));
vi.mock('../../components/ui/Toast/ToastContext', () => ({
  useToast: () => toast,
}));

vi.mock('../../core/contexts/RepositoryContext', () => ({
  useRepositories: () => ({ liveMatchRepository: null, isRealtimeEnabled: false, supabaseLiveMatchRepo: null }),
}));

const engineCtx = vi.hoisted(() => ({ current: null as MatchEngineContextValue | null }));
vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => engineCtx.current,
}));

vi.mock('../../lib/sentry', () => ({
  captureFeatureError: vi.fn(),
}));

vi.mock('../../features/auth/hooks/useMyTournamentRole', () => ({
  useMyTournamentRole: () => ({ role: 'owner', isLoading: false }),
}));

import { useCockpitExecution } from '../useCockpitExecution';

const ENGINE_MATCH_ID = FIXTURE_ENGINE_MATCH_ID;
const OLD_MATCH_ID = 'old-1';
const GOAL_AFTER_END = 'cockpit:engine.retract.hint.goalFinished';

function tournament(): Tournament {
  return {
    id: 'tour-reject',
    matches: [
      { id: ENGINE_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 1, matchNumber: 1 },
      { id: OLD_MATCH_ID, ...looseVs('teama', 'teamb'), round: 1, field: 2, matchNumber: 2, matchStatus: 'finished', scoreA: 3, scoreB: 1 },
    ],
    teams: [{ id: 'teama', name: 'Heim' }, { id: 'teamb', name: 'Gast' }],
    groupPhaseGameDuration: 20,
  } as unknown as Tournament;
}

/** Typen der Ereignisse im lokalen Engine-Log (Vorprüfungs-Schreibweg, ohne Server). */
async function engineLogTypes(matchId: string): Promise<string[]> {
  const ctx = engineCtx.current;
  if (!ctx) { throw new Error('Engine-Kontext fehlt'); }
  const copy = await ctx.store.load(ctx.accountId, matchId);
  return copy?.pending.map((e) => e.type) ?? [];
}

describe('useCockpitExecution — Ablehnung mit Grund (A-08b)', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    engineCtx.current = await makeEngineContext();
  });

  it('Pflicht: Tor (+1) nach Spielende -> kein GOAL im Log, Toast „Spiel ist beendet – Korrektur über die Turnierleitung“ (@FU-069)', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));
    await result.current.handleStart(ENGINE_MATCH_ID);
    await result.current.handleFinish(ENGINE_MATCH_ID);

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', 1);

    expect(await engineLogTypes(ENGINE_MATCH_ID)).not.toContain('GOAL');
    expect(toast.showWarning).toHaveBeenLastCalledWith(GOAL_AFTER_END);
  });

  it('Gegenbeispiel: laufendes Spiel nimmt Tor (+1) an -> Log [MATCH_START, GOAL]', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));
    await result.current.handleStart(ENGINE_MATCH_ID);

    await result.current.handleGoal(ENGINE_MATCH_ID, 'teama', 1);

    expect(await engineLogTypes(ENGINE_MATCH_ID)).toEqual(['MATCH_START', 'GOAL']);
  });

  it('Gegenbeispiel: Spiel ohne Engine-Ansicht -> handleStart lehnt ab (false, Toast), Engine-Log bleibt leer', async () => {
    const { result } = renderHook(() => useCockpitExecution(tournament()));

    const started = await result.current.handleStart(OLD_MATCH_ID);

    expect(started).toBe(false);
    expect(toast.showWarning).toHaveBeenCalled();
    expect(await engineLogTypes(OLD_MATCH_ID)).toEqual([]);
  });
});
