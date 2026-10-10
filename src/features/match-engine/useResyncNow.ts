import { useContext } from 'react';
import { ResyncNowContext } from './resyncNowContext';

/** Liefert `resyncNow` des umgebenden MatchEngineProvider (ohne Provider: No-op). */
export function useResyncNow(): () => Promise<void> {
  return useContext(ResyncNowContext);
}
