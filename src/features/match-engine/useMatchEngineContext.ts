import { useContext } from 'react';
import { MatchEngineContext, type MatchEngineContextValue } from './matchEngineContextInstance';

export function useMatchEngineContext(): MatchEngineContextValue {
  const context = useContext(MatchEngineContext);
  if (!context) {
    throw new Error('useMatchEngineContext must be used within a MatchEngineProvider');
  }
  return context;
}
