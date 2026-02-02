/**
 * OfflineBanner - Shared offline state banner for auth screens
 *
 * Displays a warning banner when the cloud backend is unreachable.
 * Used in LoginScreen and RegisterScreen.
 */

import React from 'react';
import { cssVars } from '../../../design-tokens';

interface OfflineBannerProps {
  subtitle: string;
  onRetry: () => void;
  'data-testid'?: string;
}

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.md,
    backgroundColor: cssVars.colors.warningMedium,
    border: `1px solid ${cssVars.colors.warning}`,
    borderRadius: cssVars.borderRadius.md,
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
};

export const OfflineBanner: React.FC<OfflineBannerProps> = ({
  subtitle,
  onRetry,
  'data-testid': testId,
}) => (
  <div style={styles.banner} role="alert" data-testid={testId}>
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
);
