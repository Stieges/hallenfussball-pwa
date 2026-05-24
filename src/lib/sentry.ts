/**
 * Sentry Integration - DSGVO-konform
 *
 * - Initialisierung nur in Produktion
 * - Session Replay nur mit explizitem Consent
 * - PII wird automatisch entfernt
 *
 * @module sentry
 */

import * as Sentry from '@sentry/react';
import { getConsentStatus } from './consent';

let isInitialized = false;

/**
 * Initialize Sentry (called once at app start)
 *
 * - Skips in development mode
 * - Skips if no DSN configured
 * - Skips if user hasn't given consent
 * - Enables Session Replay only with explicit consent
 */
export function initSentry(): void {
  // Only in production
  if (!import.meta.env.PROD) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.log('[Sentry] Skipped in development mode');
    }
    return;
  }

  // Only initialize once
  if (isInitialized) {
    return;
  }

  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    console.warn('[Sentry] VITE_SENTRY_DSN not configured');
    return;
  }

  const consent = getConsentStatus();

  // Without consent: No tracking
  if (!consent?.errorTracking) {
    // eslint-disable-next-line no-console
    console.log('[Sentry] No consent, skipping initialization');
    return;
  }

  // Using ReturnType to get the correct integration type
  const integrations: ReturnType<typeof Sentry.replayIntegration>[] = [];

  // Session Replay only with explicit consent
  if (consent.sessionReplay) {
    integrations.push(
      Sentry.replayIntegration({
        // DSGVO: Mask all text and block all media
        maskAllText: true,
        blockAllMedia: true,
      })
    );
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `hallenfussball-pwa@${__BUILD_HASH__}`,

    // Sampling Rates
    tracesSampleRate: 0.1, // 10% of transactions
    replaysSessionSampleRate: consent.sessionReplay ? 0.1 : 0, // 10% of sessions
    replaysOnErrorSampleRate: consent.sessionReplay ? 1.0 : 0, // 100% on errors

    integrations,

    // Remove PII
    beforeSend(event) {
      // Remove IP address
      if (event.user) {
        delete event.user.ip_address;
      }

      // Minimize request data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      return event;
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Keep navigation breadcrumbs but don't add anything sensitive
      return breadcrumb;
    },
  });

  isInitialized = true;
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[Sentry] Initialized', { sessionReplay: consent.sessionReplay });
  }
}

/**
 * Re-initialize after consent change
 * (e.g., if user later enables Session Replay)
 */
export async function reinitializeSentry(): Promise<void> {
  if (!import.meta.env.PROD) {
    return;
  }

  // Close Sentry client and reinitialize
  await Sentry.close();
  isInitialized = false;
  initSentry();
}

/**
 * Capture a feature-specific error
 *
 * @param error - The error to capture
 * @param feature - Feature name (e.g., 'auth', 'sync', 'tournament')
 * @param action - Optional action name (e.g., 'login', 'processQueue')
 * @param extra - Optional extra context data
 */
export function captureFeatureError(
  error: Error,
  feature: string,
  action?: string,
  extra?: Record<string, unknown>
): void {
  if (!import.meta.env.PROD) {
    console.error(`[${feature}${action ? `:${action}` : ''}]`, error);
    return;
  }

  Sentry.captureException(error, {
    tags: {
      feature,
      ...(action && { action }),
    },
    extra,
  });
}

/**
 * Capture a message (non-error event)
 *
 * @param message - The message to capture
 * @param level - Severity level
 * @param extra - Optional extra context data
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  extra?: Record<string, unknown>
): void {
  if (!import.meta.env.PROD) {
    // eslint-disable-next-line no-console
    console.log(`[Sentry:${level}]`, message, extra);
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra,
  });
}

/**
 * Set user context for error tracking
 * Only sets non-PII data (id only, no email)
 *
 * @param userId - User ID (or null to clear)
 */
export function setUserContext(userId: string | null): void {
  if (!import.meta.env.PROD) {
    return;
  }

  if (userId) {
    Sentry.setUser({ id: userId });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for user actions
 *
 * @param category - Category (e.g., 'ui', 'navigation')
 * @param message - Breadcrumb message
 * @param data - Optional extra data
 */
export function addBreadcrumb(
  category: string,
  message: string,
  data?: Record<string, unknown>
): void {
  if (!import.meta.env.PROD) {
    return;
  }

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
}

/**
 * Boot-Context payload sent to Sentry once per app start, capturing the
 * client-side state we need to diagnose stale-cache and false-offline bugs:
 * - build hash actually executing (vs. the latest deploy in Vercel)
 * - service-worker state (none/installing/waiting/active/redundant)
 * - cache-storage keys present (e.g. workbox-precache-v2-* identifies stale precache)
 * - navigator.onLine initial value (false-positives feed false-offline UX)
 * - indexedDB DBs present (anonymous, no row data)
 *
 * Sent as a structured message at level=info so it shows up in Issue search
 * by tag. PII-free by construction.
 */
export interface BootContext {
  buildHash: string;
  swState: 'none' | 'installing' | 'waiting' | 'active' | 'redundant' | 'unsupported';
  swScriptURL: string | null;
  cacheNames: string[];
  navigatorOnLine: boolean;
  idbDatabases: string[];
}

export async function collectBootContext(): Promise<BootContext> {
  const ctx: BootContext = {
    buildHash: __BUILD_HASH__,
    swState: 'unsupported',
    swScriptURL: null,
    cacheNames: [],
    navigatorOnLine: typeof navigator !== 'undefined' ? navigator.onLine : true,
    idbDatabases: [],
  };

  if (typeof navigator === 'undefined') {
    return ctx;
  }

  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    const controller = navigator.serviceWorker.controller;
    if (controller) {
      ctx.swState = controller.state as BootContext['swState'];
      ctx.swScriptURL = controller.scriptURL;
    } else {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.length === 0) {
          ctx.swState = 'none';
        } else {
          const reg = regs[0];
          if (reg.installing) {
            ctx.swState = 'installing';
            ctx.swScriptURL = reg.installing.scriptURL;
          } else if (reg.waiting) {
            ctx.swState = 'waiting';
            ctx.swScriptURL = reg.waiting.scriptURL;
          } else if (reg.active) {
            ctx.swState = 'active';
            ctx.swScriptURL = reg.active.scriptURL;
          }
        }
      } catch {
        // getRegistrations may throw in some sandboxed contexts
      }
    }
  }

  if (typeof caches !== 'undefined') {
    try {
      ctx.cacheNames = await caches.keys();
    } catch {
      // caches API may be unavailable
    }
  }

  if ('databases' in indexedDB && typeof indexedDB.databases === 'function') {
    try {
      const dbs = await indexedDB.databases();
      ctx.idbDatabases = dbs.map((d) => d.name ?? '<unnamed>').filter(Boolean);
    } catch {
      // Some browsers don't support indexedDB.databases()
    }
  }

  return ctx;
}

/**
 * Sends a one-shot boot event to Sentry with cache/SW/online state.
 *
 * Intentionally a `captureMessage` (info-level) rather than `captureException`
 * so it doesn't pollute the Issues stream — appears under Discover/Events with
 * the `boot` tag for ad-hoc querying.
 *
 * No-op in dev (where Sentry isn't initialized). Safe to call before consent
 * is given; if Sentry isn't initialized, captureMessage's existing dev-mode
 * branch logs to console instead.
 */
export async function captureBootContext(): Promise<void> {
  let context: BootContext;
  try {
    context = await collectBootContext();
  } catch (error) {
    // Don't let telemetry break the app under any circumstances
    if (import.meta.env.DEV) {
      console.warn('[BootContext] collection failed:', error);
    }
    return;
  }

  // Always log in dev so we can see what would have been sent
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log('[BootContext]', context);
    return;
  }

  captureMessage('app.boot', 'info', {
    boot: context,
  });

  // Also surface key fields as Sentry tags so they're queryable as facets
  if (isInitialized) {
    Sentry.setTag('build_hash', context.buildHash);
    Sentry.setTag('sw_state', context.swState);
    Sentry.setTag('navigator_on_line', String(context.navigatorOnLine));
    Sentry.setTag('cache_count', String(context.cacheNames.length));
  }
}

// Re-export Sentry for direct access if needed
export { Sentry };
