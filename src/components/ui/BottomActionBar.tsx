/**
 * BottomActionBar - Fixed action bar at bottom of screen
 *
 * Used for save/cancel actions in edit modes.
 * Positioned above the bottom navigation.
 *
 * Features:
 * - Fixed positioning with safe area padding
 * - Primary/secondary action buttons
 * - Consistent height from design tokens
 * - Backdrop blur for better visibility
 */

import { type CSSProperties, type ReactNode } from 'react';
import { cssVars, layoutHeights } from '../../design-tokens';

export interface BottomActionBarProps {
  /** Primary action (e.g., Save) */
  primaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
  /** Secondary action (e.g., Cancel) */
  secondaryAction?: {
    label: string;
    onClick: () => void;
    disabled?: boolean;
  };
  /** Optional additional content */
  children?: ReactNode;
  /** Test ID for E2E tests */
  testId?: string;
}

export const BottomActionBar: React.FC<BottomActionBarProps> = ({
  primaryAction,
  secondaryAction,
  children,
  testId,
}) => {
  const containerStyle: CSSProperties = {
    position: 'fixed',
    bottom: layoutHeights.bottomNav, // Position above bottom nav
    left: 0,
    right: 0,
    height: layoutHeights.bottomActionBar,
    backgroundColor: cssVars.colors.surface,
    borderTop: `1px solid ${cssVars.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: cssVars.spacing.sm,
    padding: `0 ${cssVars.spacing.md}`,
    zIndex: 100, // Below modals but above content
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
  };

  const secondaryButtonStyle: CSSProperties = {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: 'transparent',
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.15s ease',
  };

  const primaryButtonStyle: CSSProperties = {
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.lg}`,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: 'pointer',
    minHeight: '44px',
    transition: 'all 0.15s ease',
    opacity: primaryAction?.disabled ? 0.5 : 1,
  };

  return (
    <div style={containerStyle} data-testid={testId}>
      {children}

      {secondaryAction && (
        <button
          style={secondaryButtonStyle}
          onClick={secondaryAction.onClick}
          disabled={secondaryAction.disabled}
          data-testid={testId ? `${testId}-secondary` : undefined}
        >
          {secondaryAction.label}
        </button>
      )}

      {primaryAction && (
        <button
          style={primaryButtonStyle}
          onClick={primaryAction.onClick}
          disabled={primaryAction.disabled || primaryAction.loading}
          data-testid={testId ? `${testId}-primary` : undefined}
        >
          {primaryAction.loading ? 'Speichern...' : primaryAction.label}
        </button>
      )}
    </div>
  );
};

export default BottomActionBar;
