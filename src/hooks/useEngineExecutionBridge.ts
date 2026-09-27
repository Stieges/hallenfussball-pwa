/**
 * useEngineExecutionBridge (I5, C3a-1 Fixrunde 1): buendelt die Engine-Anbindung fuer
 * `useMatchExecution` -- Lesepfad-Map, ein Ref darauf (fuer Effekte/Callbacks, die NICHT bei jeder
 * Engine-Aenderung neu laufen duerfen, s. C1/`useMatchExecution.ts`), den optionalen
 * MatchEngine-Kontext und die gemergte Live-Match-Map (Engine-Spiele gewinnen ueber den Altpfad).
 * Eigene Datei, damit `useMatchExecution.ts` nicht waechst (W11).
 */
import { useMemo, useRef, type RefObject } from 'react';
import type { Tournament } from '../types/tournament';
import type { LiveMatch } from '../core/models/LiveMatch';
import { useEngineMatches } from './useEngineMatches';
import { useMatchEngineContextOptional } from '../features/match-engine/useMatchEngineContext';
import type { MatchEngineContextValue } from '../features/match-engine/matchEngineContextInstance';

export interface UseEngineExecutionBridgeResult {
  engineLiveMatches: Map<string, LiveMatch>;
  engineLiveMatchesRef: RefObject<Map<string, LiveMatch>>;
  matchEngineContext: MatchEngineContextValue | null;
  mergedLiveMatches: Map<string, LiveMatch>;
}

export function useEngineExecutionBridge(
  tournament: Tournament,
  enabled: boolean,
  localLiveMatches: Map<string, LiveMatch>,
): UseEngineExecutionBridgeResult {
  const { liveMatches: engineLiveMatches } = useEngineMatches(tournament, enabled);
  const matchEngineContext = useMatchEngineContextOptional();

  const engineLiveMatchesRef = useRef(engineLiveMatches);
  engineLiveMatchesRef.current = engineLiveMatches;

  const mergedLiveMatches = useMemo(() => {
    if (engineLiveMatches.size === 0) { return localLiveMatches; }
    const merged = new Map(localLiveMatches);
    for (const [id, match] of engineLiveMatches) { merged.set(id, match); }
    return merged;
  }, [localLiveMatches, engineLiveMatches]);

  return { engineLiveMatches, engineLiveMatchesRef, matchEngineContext, mergedLiveMatches };
}
