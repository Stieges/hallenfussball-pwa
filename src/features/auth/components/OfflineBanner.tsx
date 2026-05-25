/**
 * OfflineBanner - Shared offline state banner for auth screens
 *
 * Displays a warning banner when the cloud backend is unreachable.
 * Used in LoginScreen and RegisterScreen.
 *
 * Optionally surfaces a "Cache leeren & neu laden" recovery action for the
 * known stale-SW-precache class of bugs. The recovery button is armed only
 * after a short delay so that a flickering banner during a fast handshake
 * can't be reset by an accidental click.
 */

import React, { useEffect, useState } from 'react';
import { cssVars } from '../../../design-tokens';

/** Time the banner must stay visible before the recovery button arms. */
export const RECOVERY_ARM_DELAY_MS = 5000;

interface OfflineBannerProps {
  subtitle: string;
  onRetry: () => void;
  /**
   * Optional recovery action — unregister SW + drop caches + reload.
   * When omitted, the recovery button is not rendered.
   */
  onClearCache?: () => void | Promise<void>;
  /** Localised label for the recovery button (e.g. "Cache leeren & neu laden"). */
  clearCacheLabel?: string;
  /** Localised disclaimer shown beneath the recovery button. */
  clearCacheDisclaimer?: string;
  'data-testid'?: string;
}

const styles = {
  banner: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.md,
    backgroundColor: cssVars.colors.warningMedium,
    border: `1px solid ${cssVars.colors.warning}`,
    borderRadius: cssVars.borderRadius.md,
  } as React.CSSProperties,
  primaryRow: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  } as React.CSSProperties,
  icon: {
    fontSize: cssVars.fontSizes.lg,
    flexShrink: 0,
  } as React.CSSProperties,
  textContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
    gap: '2px',
  } as React.CSSProperties,
  title: {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.warning,
  } as React.CSSProperties,
  subtitle: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  } as React.CSSProperties,
  retryButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: `1px solid ${cssVars.colors.warning}`,
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,
  recoveryRow: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '2px',
    paddingTop: cssVars.spacing.xs,
    borderTop: `1px dashed ${cssVars.colors.warning}`,
  } as React.CSSProperties,
  recoveryButton: {
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    minHeight: '44px',
    background: 'transparent',
    border: `1px solid ${cssVars.colors.warning}`,
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  } as React.CSSProperties,
  recoveryDisclaimer: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    fontStyle: 'italic' as const,
  } as React.CSSProperties,
};

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  subtitle,
  onRetry,
  onClearCache,
  clearCacheLabel,
  clearCacheDisclaimer,
  'data-testid': testId,
}) => {
  const [recoveryArmed, setRecoveryArmed] = useState(false);

  useEffect(() => {
    if (!onClearCache) {
      return;
    }
    const timer = setTimeout(() => setRecoveryArmed(true), RECOVERY_ARM_DELAY_MS);
    return () => { clearTimeout(timer); };
  }, [onClearCache]);

  return (
    <div style={styles.banner} role="alert" data-testid={testId}>
      <div style={styles.primaryRow}>
        <span style={styles.icon}>📡</span>
        <div style={styles.textContainer}>
          <span style={styles.title}>Cloud nicht erreichbar</span>
          <span style={styles.subtitle}>{subtitle}</span>
        </div>
        <button
          type="button"
          onClick={onRetry}
          style={styles.retryButton}
          data-testid={testId ? `${testId}-retry` : undefined}
        >
          Erneut
        </button>
      </div>
      {onClearCache && recoveryArmed && (
        <div style={styles.recoveryRow}>
          <button
            type="button"
            onClick={() => void onClearCache()}
            style={styles.recoveryButton}
            data-testid={testId ? `${testId}-recovery` : undefined}
          >
            {clearCacheLabel ?? 'Cache leeren & neu laden'}
          </button>
          {clearCacheDisclaimer && (
            <span style={styles.recoveryDisclaimer}>{clearCacheDisclaimer}</span>
          )}
        </div>
      )}
    </div>
  );
};
