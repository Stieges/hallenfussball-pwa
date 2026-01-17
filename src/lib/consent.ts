/**
 * DSGVO-konformes Consent-System für Analytics/Error-Tracking
 *
 * - errorTracking: Anonymisiert, keine PII - nach Consent erlaubt
 * - sessionReplay: Nur mit expliziter Zustimmung ("Alle akzeptieren")
 *
 * @module consent
 */

const CONSENT_KEY = 'app:consent';

/**
 * Consent status stored in localStorage
 */
export interface ConsentStatus {
  /** Error-Tracking (anonymisiert) - true after user consents */
  errorTracking: boolean;

  /** Session Replay - only with explicit consent */
  sessionReplay: boolean;

  /** Timestamp der Zustimmung (für Audit) */
  timestamp: number;

  /** Consent-Version (für zukünftige Updates) */
  version: number;
}

/** Current consent version - increment when consent requirements change */
const CURRENT_VERSION = 1;

/**
 * Read consent status from localStorage
 * Returns null if no consent has been given or version is outdated
 */
export function getConsentStatus(): ConsentStatus | null {
  try {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as ConsentStatus;

    // Version-Check: If old version, require consent again
    if (parsed.version !== CURRENT_VERSION) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

/**
 * Save consent status to localStorage
 * Automatically adds timestamp and version
 */
export function setConsentStatus(
  status: Omit<ConsentStatus, 'timestamp' | 'version'>
): void {
  const fullStatus: ConsentStatus = {
    ...status,
    timestamp: Date.now(),
    version: CURRENT_VERSION,
  };
  localStorage.setItem(CONSENT_KEY, JSON.stringify(fullStatus));
}

/**
 * Check if consent has been given
 * Returns true if user has made a consent decision (regardless of choice)
 */
export function hasConsent(): boolean {
  return getConsentStatus() !== null;
}

/**
 * Revoke consent (e.g., from Settings screen)
 * User will see consent dialog again on next visit
 */
export function revokeConsent(): void {
  localStorage.removeItem(CONSENT_KEY);
}

/**
 * Check if session replay is enabled
 * Convenience function for checking replay consent
 */
export function isSessionReplayEnabled(): boolean {
  const status = getConsentStatus();
  return status?.sessionReplay ?? false;
}

/**
 * Check if error tracking is enabled
 * Convenience function for checking error tracking consent
 */
export function isErrorTrackingEnabled(): boolean {
  const status = getConsentStatus();
  return status?.errorTracking ?? false;
}
