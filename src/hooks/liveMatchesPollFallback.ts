/**
 * A-08f1 (@FU-087, Spielplan-Teil): Ist der Realtime-Kanal unterbrochen (Status != SUBSCRIBED),
 * laedt `useLiveMatches` den Turnierstand alle 5 s per Abfrage nach -- ohne Hinweis und ohne Toast.
 * Bei SUBSCRIBED oder Unmount stoppt die Abfrage. Der Monitor nutzt denselben Hook (Monitor-Teil: B-18).
 * Gast (`enabled` false) bekommt nichts.
 */
import { useEffect, useRef } from 'react';
import { useRealtimeChannelStatus, isRealtimeInterrupted } from './realtimeChannelStatus';

export const LIVE_MATCHES_POLL_FALLBACK_INTERVAL_MS = 5000;

export function useLiveMatchesPollFallback(
  tournamentId: string,
  enabled: boolean,
  refresh: () => Promise<void>,
): void {
  const status = useRealtimeChannelStatus(tournamentId);
  const active = enabled && tournamentId !== '' && isRealtimeInterrupted(status);
  // Immer die aktuelle Aktualisierung aufrufen, ohne das Intervall bei jedem Render neu zu starten.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    if (!active) {
      return undefined;
    }
    const timer = setInterval(() => {
      refreshRef.current().catch(() => undefined);
    }, LIVE_MATCHES_POLL_FALLBACK_INTERVAL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [active]);
}
