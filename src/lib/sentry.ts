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
    release: `hallenfussball-pwa@${(import.meta.env.VITE_APP_VERSION as string) || '1.0.0'}`,

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

// Re-export Sentry for direct access if needed
export { Sentry };
