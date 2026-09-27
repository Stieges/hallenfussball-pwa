/**
 * useEngineExecutionBridge — P1 (C3a-2a Fixrunde 3, W11): `resolveEngineLiveMatchData` kapselt
 * `engineLiveMatches.get` + `isEngineDestinedMatchId` + `ensureEngineMatchReady` an EINER Stelle,
 * damit `useMatchExecution.getLiveMatchData` auf eine Zeile schrumpft (Datei bleibt <= 819 Zeilen).
 *
 * `useEngineMatches`/`useEngineMatchReadiness` selbst sind bereits eigenstaendig getestet -- hier
 * geht es NUR um die Verdrahtung: Engine-Ansicht liefern, wirft bei unvorbereitetem Engine-Spiel,
 * `null` fuer Altspiele (damit der Aufrufer auf den Altpfad ausweichen kann).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { LiveMatch } from '../../core/models/LiveMatch';
import type { Tournament } from '../../types/tournament';

const ENGINE_MATCH_ID = 'engine-match-1';
const DESTINED_MATCH_ID = 'destined-match-1';
const OLD_MATCH_ID = 'old-match-1';
const FOREIGN_CANDIDATE_MATCH_ID = 'foreign-candidate-match-1';

const engineLiveMatch: LiveMatch = {
  id: ENGINE_MATCH_ID,
  status: 'RUNNING',
} as unknown as LiveMatch;

const engineLiveMatchesMap = new Map<string, LiveMatch>([[ENGINE_MATCH_ID, engineLiveMatch]]);

vi.mock('../useEngineMatches', () => ({
  useEngineMatches: () => ({
    liveMatches: engineLiveMatchesMap,
    isEngineMatch: (id: string) => id === ENGINE_MATCH_ID,
  }),
}));

const mockEnsureEngineMatchReady = vi.fn<(id: string) => Promise<LiveMatch | null>>();
vi.mock('../useEngineMatchReadiness', () => ({
  useEngineMatchReadiness: () => ({
    isEngineDestinedMatch: (id: string) => id === DESTINED_MATCH_ID,
    isForeignCandidateMatch: (id: string) => id === FOREIGN_CANDIDATE_MATCH_ID,
    ensureEngineMatchReady: mockEnsureEngineMatchReady,
  }),
}));

vi.mock('../../features/match-engine/useMatchEngineContext', () => ({
  useMatchEngineContextOptional: () => ({ engine: { catchUp: vi.fn() } }),
}));

import { useEngineExecutionBridge } from '../useEngineExecutionBridge';

function tournament(): Tournament {
  return { id: 'tour-resolve', matches: [] } as unknown as Tournament;
}

beforeEach(() => {
  mockEnsureEngineMatchReady.mockReset();
});

describe('useEngineExecutionBridge — resolveEngineLiveMatchData (P1)', () => {
  it('liefert die Engine-Ansicht direkt, wenn das Spiel bereits eine Engine-Kopie hat', async () => {
    const { result } = renderHook(() => useEngineExecutionBridge(tournament(), true, new Map()));

    const data = await result.current.resolveEngineLiveMatchData(ENGINE_MATCH_ID);

    expect(data).toBe(engineLiveMatch);
    expect(mockEnsureEngineMatchReady).not.toHaveBeenCalled();
  });

  it('ruft ensureEngineMatchReady fuer ein engine-bestimmtes, aber noch nicht bereites Spiel auf und liefert dessen Ansicht', async () => {
    const readyMatch: LiveMatch = { id: DESTINED_MATCH_ID, status: 'NOT_STARTED' } as unknown as LiveMatch;
    mockEnsureEngineMatchReady.mockResolvedValueOnce(readyMatch);
    const { result } = renderHook(() => useEngineExecutionBridge(tournament(), true, new Map()));

    const data = await result.current.resolveEngineLiveMatchData(DESTINED_MATCH_ID);

    expect(mockEnsureEngineMatchReady).toHaveBeenCalledWith(DESTINED_MATCH_ID);
    expect(data).toBe(readyMatch);
  });

  it('wirft, wenn ein engine-bestimmtes Spiel auch nach ensureEngineMatchReady keine Ansicht liefert', async () => {
    mockEnsureEngineMatchReady.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useEngineExecutionBridge(tournament(), true, new Map()));

    await expect(result.current.resolveEngineLiveMatchData(DESTINED_MATCH_ID)).rejects.toThrow();
  });

  it('liefert null fuer ein reines Altspiel (weder Engine-Kopie noch engine-bestimmt)', async () => {
    const { result } = renderHook(() => useEngineExecutionBridge(tournament(), true, new Map()));

    const data = await result.current.resolveEngineLiveMatchData(OLD_MATCH_ID);

    expect(data).toBeNull();
    expect(mockEnsureEngineMatchReady).not.toHaveBeenCalled();
  });

  // P2 (Fixrunde 3, E1-Randfall): fuer den "fremd"-Kandidaten (unklar, ob Server-Engine-Spiel)
  // darf ein `null`-Ergebnis von `ensureEngineMatchReady` NICHT werfen -- anders als beim klaren
  // B1-Fall oben. `null` heisst hier "bestaetigtes Altspiel", der Aufrufer weicht auf den Altweg aus.
  it('P2: liefert null OHNE zu werfen, wenn ensureEngineMatchReady fuer einen fremd-Kandidaten null liefert', async () => {
    mockEnsureEngineMatchReady.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useEngineExecutionBridge(tournament(), true, new Map()));

    const data = await result.current.resolveEngineLiveMatchData(FOREIGN_CANDIDATE_MATCH_ID);

    expect(mockEnsureEngineMatchReady).toHaveBeenCalledWith(FOREIGN_CANDIDATE_MATCH_ID);
    expect(data).toBeNull();
  });

  it('P2: liefert die Engine-Ansicht, wenn ensureEngineMatchReady fuer einen fremd-Kandidaten eine Ansicht liefert', async () => {
    const readyMatch: LiveMatch = { id: FOREIGN_CANDIDATE_MATCH_ID, status: 'RUNNING' } as unknown as LiveMatch;
    mockEnsureEngineMatchReady.mockResolvedValueOnce(readyMatch);
    const { result } = renderHook(() => useEngineExecutionBridge(tournament(), true, new Map()));

    const data = await result.current.resolveEngineLiveMatchData(FOREIGN_CANDIDATE_MATCH_ID);

    expect(data).toBe(readyMatch);
  });
});
