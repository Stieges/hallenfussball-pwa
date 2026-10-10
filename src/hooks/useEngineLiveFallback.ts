/**
 * useEngineLiveFallback (A-06k, @FU-025): Ist der Realtime-Kanal unterbrochen (Status != SUBSCRIBED),
 * laedt die Engine die bereits qualifizierten Spiele alle 5 s nach (`catchUpLoaded`) -- damit ein
 * Tor eines Helfers spaetestens nach 10 s auch ohne Push sichtbar wird. Bei SUBSCRIBED stoppt das
 * Intervall. Gast (`enabled` false) bekommt nichts.
 */
import { useEffect } from 'react';
import { useRealtimeChannelStatus, isRealtimeInterrupted } from './realtimeChannelStatus';

export const ENGINE_LIVE_FALLBACK_INTERVAL_MS = 5000;

export interface EngineCatchUpPort {
  catchUpLoaded(): Promise<void>;
}

export function useEngineLiveFallback(engine: EngineCatchUpPort | null, enabled: boolean, tournamentId: string): void {
  const status = useRealtimeChannelStatus(tournamentId);
  const active = enabled && engine !== null && isRealtimeInterrupted(status);

  useEffect(() => {
    if (!active || !engine) {
      return undefined;
    }
    const timer = setInterval(() => {
      engine.catchUpLoaded().catch(() => undefined);
    }, ENGINE_LIVE_FALLBACK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [active, engine]);
}
