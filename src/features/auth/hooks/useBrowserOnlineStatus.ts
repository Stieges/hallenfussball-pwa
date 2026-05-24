/**
 * Tracks the real browser-level online status independently of the auth
 * connection-state machine. The login form uses this to decide whether to
 * show the loud `OfflineBanner` or a subtler connecting indicator.
 *
 * `navigator.onLine` is the source of truth in most cases, but on some
 * browser/OS combinations (notably after a Service-Worker startup with
 * cache-hit) it stays stuck at `false` even when the network is fully
 * functional. To recover from that false-positive we run a one-shot
 * HEAD probe against the Supabase project URL on mount. If the probe
 * succeeds we flip browserOnline=true and the loud banner stays hidden;
 * if it fails or times out we trust the original `navigator.onLine` value.
 *
 * The probe runs at most once per component lifecycle (no polling).
 */

import { useEffect, useState } from 'react';

import { probeSupabaseReachable, type ProbeOptions } from '../../../lib/onlineProbe';
import { addBreadcrumb } from '../../../lib/sentry';

function getInitialBrowserOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export interface UseBrowserOnlineStatusOptions {
  /** Test seam — swap the probe implementation. */
  probe?: (opts?: ProbeOptions) => Promise<'online' | 'offline' | 'unknown'>;
}

export function useBrowserOnlineStatus(
  options: UseBrowserOnlineStatusOptions = {},
): boolean {
  const [browserOnline, setBrowserOnline] = useState(getInitialBrowserOnline);

  // Listen for live online/offline transitions while the component is mounted.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const goOnline = () => setBrowserOnline(true);
    const goOffline = () => setBrowserOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // One-shot probe: if navigator.onLine reports false at mount, verify with
  // a real network request. The probe deliberately runs only when the flag
  // is false — we don't want to add latency on the happy path.
  useEffect(() => {
    if (typeof navigator === 'undefined' || navigator.onLine) {
      return;
    }
    let cancelled = false;
    const probe = options.probe ?? probeSupabaseReachable;
    void probe().then((outcome) => {
      if (cancelled) {
        return;
      }
      if (outcome === 'online') {
        // Browser reported offline but the network actually works — flip
        // the flag and log a breadcrumb so we can observe how often this
        // false-positive class triggers in production.
        addBreadcrumb(
          'auth',
          'navigator.onLine false-positive detected — flipping browserOnline=true',
          { outcome },
        );
        setBrowserOnline(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [options.probe]);

  return browserOnline;
}
