/**
 * useMonitorHeartbeats - Live monitor online-status tracking
 *
 * Subscribes to monitor_heartbeats via Supabase Realtime and provides
 * a Map of monitor statuses (online/stale/offline) for the admin dashboard.
 *
 * Thresholds:
 * - online:  last_seen < 60s ago
 * - stale:   last_seen < 90s ago
 * - offline: last_seen >= 90s ago
 *
 * @see MONITOR-LIVE-SCORE-REDESIGN.md Section 12
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// =============================================================================
// TYPES
// =============================================================================

export type HeartbeatStatus = 'online' | 'stale' | 'offline';

export interface MonitorHeartbeat {
  monitorId: string;
  lastSeen: Date;
  status: HeartbeatStatus;
  slideIndex: number | null;
  cacheStatus: string | null;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const ONLINE_THRESHOLD_MS = 60_000;  // < 60s → online
const STALE_THRESHOLD_MS = 90_000;   // < 90s → stale, >= 90s → offline
const REFRESH_INTERVAL_MS = 15_000;  // Re-evaluate status every 15s

// =============================================================================
// HELPERS
// =============================================================================

function deriveStatus(lastSeen: Date): HeartbeatStatus {
  const age = Date.now() - lastSeen.getTime();
  if (age < ONLINE_THRESHOLD_MS) {
    return 'online';
  }
  if (age < STALE_THRESHOLD_MS) {
    return 'stale';
  }
  return 'offline';
}

// =============================================================================
// HOOK
// =============================================================================

export function useMonitorHeartbeats(tournamentId: string | undefined): Map<string, MonitorHeartbeat> {
  const [heartbeats, setHeartbeats] = useState<Map<string, MonitorHeartbeat>>(new Map());
  const rawRef = useRef<Map<string, { lastSeen: Date; slideIndex: number | null; cacheStatus: string | null }>>(new Map());

  // Re-derive status from raw timestamps (handles aging without new data)
  const refreshStatuses = useCallback(() => {
    const updated = new Map<string, MonitorHeartbeat>();
    rawRef.current.forEach((raw, monitorId) => {
      updated.set(monitorId, {
        monitorId,
        lastSeen: raw.lastSeen,
        status: deriveStatus(raw.lastSeen),
        slideIndex: raw.slideIndex,
        cacheStatus: raw.cacheStatus,
      });
    });
    setHeartbeats(updated);
  }, []);

  // Initial fetch + Realtime subscription
  useEffect(() => {
    if (!tournamentId || !supabase) {
      return;
    }

    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- monitor_heartbeats not yet in generated types */
    const sb: any = supabase;

    // Fetch existing heartbeats
    const fetchHeartbeats = async () => {
      try {
        const { data } = await sb
          .from('monitor_heartbeats')
          .select('monitor_id, last_seen, slide_index, cache_status')
          .eq('tournament_id', tournamentId);

        if (data) {
          const raw = new Map<string, { lastSeen: Date; slideIndex: number | null; cacheStatus: string | null }>();
          for (const row of data as { monitor_id: string; last_seen: string; slide_index: number | null; cache_status: string | null }[]) {
            raw.set(row.monitor_id, {
              lastSeen: new Date(row.last_seen),
              slideIndex: row.slide_index,
              cacheStatus: row.cache_status,
            });
          }
          rawRef.current = raw;
          refreshStatuses();
        }
      } catch {
        // Non-critical — admin dashboard still works without heartbeats
      }
    };

    void fetchHeartbeats();

    // Subscribe to realtime changes
    const channel = sb
      .channel(`heartbeats:${tournamentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'monitor_heartbeats',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as {
            monitor_id: string;
            last_seen: string;
            slide_index: number | null;
            cache_status: string | null;
          };
          if (row?.monitor_id) {
            rawRef.current.set(row.monitor_id, {
              lastSeen: new Date(row.last_seen),
              slideIndex: row.slide_index,
              cacheStatus: row.cache_status,
            });
            refreshStatuses();
          }
        },
      )
      .subscribe();
    /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

    return () => {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      void sb.removeChannel(channel);
    };
  }, [tournamentId, refreshStatuses]);

  // Periodic status refresh (handles aging: online → stale → offline)
  useEffect(() => {
    if (!tournamentId) {
      return;
    }

    const timer = setInterval(refreshStatuses, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [tournamentId, refreshStatuses]);

  return heartbeats;
}
