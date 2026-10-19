/**
 * useSpielzeitJetzt – die Spielzeit dieses Moments in ms aus der Engine-Uhr (Serverzeit, @SL-084).
 * Der Tipp merkt sich damit die Spielzeit des ERSTEN Tipps; die Nummer kommt später und ändert sie nicht.
 * Ohne Engine-Kopie des Spiels: 0.
 */
import { useCallback } from 'react';
import { elapsedAt } from '../../../core/match';
import { useMatchEngineContextOptional } from '../../../features/match-engine/useMatchEngineContext';

export function useSpielzeitJetzt(matchId: string | undefined): () => number {
  const context = useMatchEngineContextOptional();
  return useCallback((): number => {
    if (!context || !matchId) { return 0; }
    const view = context.engine.view(matchId.toLowerCase());
    return view ? elapsedAt(view.result.state.clock, context.engine.serverNow()) : 0;
  }, [context, matchId]);
}
