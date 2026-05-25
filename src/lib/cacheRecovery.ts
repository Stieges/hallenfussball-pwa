/**
 * Cache-Recovery utility — the last-resort reset for users stuck in a
 * stale-SW state. Triggered from the OfflineBanner recovery button.
 *
 * Order of operations is load-bearing:
 *   1. Sentry breadcrumb (so we can correlate user clicks with their state)
 *   2. Unregister all service workers (stops further intercepts)
 *   3. Delete all caches (frees the precached bundle)
 *   4. location.reload() (forces a fresh network fetch)
 *
 * Each step is wrapped in its own try/catch — even partial recovery is
 * better than failing silently, and a hard reload at the end always works.
 */

import { captureFeatureError } from './sentry';

export interface RecoveryContext {
  buildHash: string;
  onLine: boolean;
}

export interface CacheRecoveryDeps {
  /** Test seam — defaults to global navigator.serviceWorker. */
  serviceWorker?: ServiceWorkerContainer;
  /** Test seam — defaults to global caches. */
  cacheStorage?: CacheStorage;
  /** Test seam — defaults to location.reload(). */
  reload?: () => void;
  /** Test seam — defaults to captureFeatureError from ./sentry. */
  capture?: typeof captureFeatureError;
}

export async function clearCachesAndReload(
  context: RecoveryContext,
  deps: CacheRecoveryDeps = {},
): Promise<void> {
  const sw =
    deps.serviceWorker ??
    (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined);
  const cacheStorage =
    deps.cacheStorage ?? (typeof caches !== 'undefined' ? caches : undefined);
  const reload =
    deps.reload ??
    (() => {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    });
  const capture = deps.capture ?? captureFeatureError;

  // Always log the recovery attempt so we can spot a runaway loop or a
  // diagnostic pattern (e.g. "every user on build X resets within 10s")
  try {
    capture(new Error('UserTriggeredCacheReset'), 'auth', 'recovery', {
      buildHash: context.buildHash,
      onLine: context.onLine,
    });
  } catch {
    // captureFeatureError must never throw, but defensive anyway
  }

  if (sw) {
    try {
      const registrations = await sw.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    } catch {
      // SW unregister failure shouldn't block cache clear
    }
  }

  if (cacheStorage) {
    try {
      const names = await cacheStorage.keys();
      await Promise.all(names.map((n) => cacheStorage.delete(n)));
    } catch {
      // Cache clear failure shouldn't block reload
    }
  }

  reload();
}
