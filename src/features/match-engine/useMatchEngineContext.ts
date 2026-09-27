import { useContext } from 'react';
import { MatchEngineContext, type MatchEngineContextValue } from './matchEngineContextInstance';

export function useMatchEngineContext(): MatchEngineContextValue {
  const context = useContext(MatchEngineContext);
  if (!context) {
    throw new Error('useMatchEngineContext must be used within a MatchEngineProvider');
  }
  return context;
}

/**
 * Gleicher Kontext, aber `null` statt Wurf ohne `MatchEngineProvider` -- fuer Aufrufer, die im
 * Bestand ODER isoliert (Tests ohne den Provider) funktionieren muessen, z. B.
 * `useEngineMatches` (C3a-1, 1.3): ein Turnier ohne umgebenden Provider zeigt dann einfach keine
 * Engine-Spiele (identisch zum bisherigen Verhalten), statt die App abstuerzen zu lassen.
 */
export function useMatchEngineContextOptional(): MatchEngineContextValue | null {
  return useContext(MatchEngineContext);
}
