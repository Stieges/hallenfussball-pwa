/**
 * A-08f1/F (@FU-087): Ist ein Realtime-Kanal unterbrochen (gemeldeter Status != SUBSCRIBED), ruft dieser
 * Hook `refresh` alle 5 s auf -- ohne Hinweis und ohne Toast. Bei SUBSCRIBED oder Unmount stoppt die
 * Abfrage. Generisch: `statusKey` ist der Schluessel in `realtimeChannelStatus` (Live-Kanal: Turnier-ID,
 * Turnier-Kanal: `tournament-<id>`). Der Monitor nutzt denselben Hook (Monitor-Teil: B-18).
 * `enabled` false (z. B. Gast) bekommt nichts.
 */
import { useEffect, useRef } from 'react';
import { useRealtimeChannelStatus, isRealtimeInterrupted } from './realtimeChannelStatus';

export const REALTIME_POLL_FALLBACK_INTERVAL_MS = 5000;

export function useRealtimePollFallback(
  statusKey: string,
  enabled: boolean,
  refresh: () => Promise<void>,
): void {
  const status = useRealtimeChannelStatus(statusKey);
  const active = enabled && statusKey !== '' && isRealtimeInterrupted(status);
  // Immer die aktuelle Aktualisierung aufrufen, ohne das Intervall bei jedem Render neu zu starten.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const timer = setInterval(() => {
      refreshRef.current().catch(() => undefined);
    }, REALTIME_POLL_FALLBACK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
}
