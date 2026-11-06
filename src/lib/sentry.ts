/**
 * Sentry Integration - DSGVO-konform (@RE-002)
 *
 * - Initialisierung nur in Produktion
 * - Läuft ohne Einwilligung (berechtigtes Interesse), abschaltbar in den Einstellungen („Fehlerberichte senden“)
 * - Keine Sitzungsaufzeichnung, keine IP-Adresse, keine Nutzerdaten außer einer zufälligen Kennung
 *
 * @module sentry
 */

import * as Sentry from '@sentry/react';
import { isErrorReportingEnabled } from './errorReportPreference';
import { scrubBreadcrumb, scrubEventUrls, scrubEventUser } from './sentryScrub';

let isInitialized = false;

/**
 * Initialize Sentry (called once at app start)
 *
 * - Skips in development mode
 * - Skips if no DSN configured
 * - Skips if the user switched error reports off on this device
 */
export function initSentry(): void {
  // Only in production
  if (!import.meta.env.PROD) {
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

  // Aus = nichts senden (auch nach Neuladen)
  if (!isErrorReportingEnabled()) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `hallenfussball-pwa@${__BUILD_HASH__}`,

    // Keine Standard-Personendaten (IP, Cookies, Header); keine Sitzungsaufzeichnung (keine Replay-Integration)
    sendDefaultPii: false,

    // Sampling Rates
    tracesSampleRate: 0.1, // 10% of transactions

    // Remove PII
    beforeSend(event) {
      // Gerät hat abgeschaltet, nachdem das Ereignis entstand: nichts senden
      if (!isErrorReportingEnabled()) {
        return null;
      }

      // Minimize request data
      if (event.request) {
        delete event.request.cookies;
        delete event.request.headers;
      }

      // Keine IP-Adresse, keine E-Mail, kein Name: nur die zufällige Kennung bleibt
      scrubEventUser(event);

      // A-17b: Helfer-Code (`/join/<code>`) und `token=` nie an Sentry (HashRouter: steht in jeder Adresse)
      return scrubEventUrls(event);
    },

    beforeSendTransaction(event) {
      if (!isErrorReportingEnabled()) {
        return null;
      }
      scrubEventUser(event);
      return scrubEventUrls(event);
    },

    // Filter breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      // Keep navigation breadcrumbs but don't add anything sensitive (Helfer-Code und Token gekürzt)
      return scrubBreadcrumb(breadcrumb);
    },
  });

  isInitialized = true;
}

/**
 * Nach dem Umschalten in den Einstellungen: aus = Client schließen (sendet nichts mehr), an = neu starten.
 */
export async function applyErrorReportingPreference(): Promise<void> {
  if (!import.meta.env.PROD) {
    return;
  }

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
 * No-op in dev (where Sentry isn't initialized). Safe to call when error reports
 * are switched off; if Sentry isn't initialized, captureMessage's existing dev-mode
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
