/**
 * Online-probe utility — verifies actual reachability of the Supabase
 * project endpoint when `navigator.onLine` reports `false`.
 *
 * Some browser/OS combinations (notably after a SW startup with cache-hit)
 * leave `navigator.onLine` stuck at `false` even when the network is fully
 * functional. Trusting that flag alone leads to a false-offline UX that
 * blocks login indefinitely.
 *
 * The probe is intentionally lightweight: a HEAD against `/auth/v1/health`
 * with a 3 s abort timeout. CORS errors and 4xx responses still indicate
 * connectivity (the network round-trip happened), so any resolved response
 * — regardless of status — counts as proof-of-online.
 */

import { supabaseProjectUrl } from './supabase';

export type ProbeOutcome = 'online' | 'offline' | 'unknown';

export interface ProbeOptions {
  /** Test seam — override the URL used for the probe. */
  url?: string;
  /** Test seam — inject a custom fetch implementation. */
  fetchImpl?: typeof fetch;
  /** Abort timeout in ms. Default 3000. */
  timeoutMs?: number;
}

export async function probeSupabaseReachable(options: ProbeOptions = {}): Promise<ProbeOutcome> {
  // Explicit override wins; otherwise fall back to the module's project URL.
  // Empty strings count as "no URL" so callers can deliberately bypass the
  // configured Supabase URL in tests.
  const baseUrl = 'url' in options ? options.url : supabaseProjectUrl;
  if (!baseUrl) {
    return 'unknown';
  }

  const fetchImpl = options.fetchImpl ?? (typeof fetch !== 'undefined' ? fetch : undefined);
  if (!fetchImpl) {
    return 'unknown';
  }

  const timeoutMs = options.timeoutMs ?? 3000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // HEAD with no-cors mode so we get a resolved response even when CORS
    // would block reading it — we only care that the network round-trip
    // completed.
    await fetchImpl(`${baseUrl}/auth/v1/health`, {
      method: 'HEAD',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller.signal,
    });
    return 'online';
  } catch {
    return 'offline';
  } finally {
    clearTimeout(timer);
  }
}
