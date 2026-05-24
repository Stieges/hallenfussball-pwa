/**
 * ConnectingIndicator — subtle non-blocking pill that surfaces a degraded
 * but-not-offline connection state on auth screens. Replaces the scary
 * full-width OfflineBanner for cases where the browser is technically
 * online but the Supabase auth handshake is slow or has timed out.
 *
 * Used by LoginScreen for two states:
 *   - "connecting" (handshake in progress beyond a soft threshold)
 *   - "stalled"    (handshake timed out, login can still be attempted)
 */

import React from 'react';
import { cssVars } from '../../../design-tokens';

interface ConnectingIndicatorProps {
  variant: 'connecting' | 'stalled';
  label: string;
  retryLabel?: string;
  onRetry?: () => void;
  'data-testid'?: string;
}

const styles = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    marginBottom: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.full,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    maxWidth: '100%',
  } as React.CSSProperties,
  spinner: {
    width: '14px',
    height: '14px',
    border: `2px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'connecting-indicator-spin 0.8s linear infinite',
    flexShrink: 0,
  } as React.CSSProperties,
  stalledIcon: {
    fontSize: cssVars.fontSizes.md,
    flexShrink: 0,
  } as React.CSSProperties,
  retryButton: {
    marginLeft: cssVars.spacing.xs,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    minHeight: '32px',
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.sm,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.xs,
    cursor: 'pointer',
    flexShrink: 0,
  } as React.CSSProperties,
};

const keyframes = `@keyframes connecting-indicator-spin { to { transform: rotate(360deg); } }`;

export const ConnectingIndicator: React.FC<ConnectingIndicatorProps> = ({
  variant,
  label,
  retryLabel,
  onRetry,
  'data-testid': testId,
}) => (
  <>
    <style>{keyframes}</style>
    <div
      style={styles.pill}
      role="status"
      aria-live="polite"
      data-testid={testId}
      data-variant={variant}
    >
      {variant === 'connecting' ? (
        <span style={styles.spinner} aria-hidden="true" />
      ) : (
        <span style={styles.stalledIcon} aria-hidden="true">⏱</span>
      )}
      <span>{label}</span>
      {variant === 'stalled' && retryLabel && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={styles.retryButton}
          data-testid={testId ? `${testId}-retry` : undefined}
        >
          {retryLabel}
        </button>
      )}
    </div>
  </>
);
