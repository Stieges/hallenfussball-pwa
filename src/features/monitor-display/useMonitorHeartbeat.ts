import { useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { captureFeatureError } from '../../lib/sentry';

/**
 * Heartbeat des Monitors alle 30 s, damit das Admin-Dashboard den Online-Status zeigen kann.
 * Deps nur Ids und Primitive: neue Objekte je Poll würden den Takt sonst bei jedem Poll neu starten
 * (C-MON-HEARTBEAT-JE-POLL). Der Folien-Index liegt im Takt (Bestand, Befund C-MON-HEARTBEAT-TAKT).
 */
export function useMonitorHeartbeat(
  monitorKey: string | null,
  tournamentKey: string | null,
  slideIndex: number,
  cacheStatusKey: string,
): void {
  const heartbeatErrorReported = useRef(false);
  useEffect(() => {
    if (!monitorKey || !tournamentKey) {
      return;
    }

    const sendHeartbeat = async () => {
      if (!supabase) {
        return;
      }
      const { error } = await supabase.rpc('record_monitor_heartbeat', {
        p_monitor_id: monitorKey,
        p_tournament_id: tournamentKey,
        p_slide_index: slideIndex,
        p_cache_status: cacheStatusKey,
        p_user_agent: navigator.userAgent,
      });
      if (error && !heartbeatErrorReported.current) {
        // supabase-js wirft bei PG-Fehlern nicht — einmal pro Mount signalisieren,
        // sonst bleibt ein kaputter Heartbeat-Pfad wieder monatelang unsichtbar.
        heartbeatErrorReported.current = true;
        captureFeatureError(new Error(`heartbeat failed: ${error.message}`), 'monitor', 'heartbeat');
      }
    };

    void sendHeartbeat();
    const interval = setInterval(() => void sendHeartbeat(), 30_000);
    return () => clearInterval(interval);
  }, [monitorKey, tournamentKey, slideIndex, cacheStatusKey]);
}
