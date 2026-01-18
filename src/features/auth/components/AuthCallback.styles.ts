/**
 * AuthCallback Styles
 *
 * Extracted from AuthCallback.tsx for maintainability.
 */

import { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const authCallbackStyles: Record<string, CSSProperties> = {
  container: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: cssVars.colors.background,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: cssVars.spacing.xl,
    maxWidth: '400px',
    textAlign: 'center',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: `4px solid ${cssVars.colors.border}`,
    borderTopColor: cssVars.colors.primary,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    marginBottom: cssVars.spacing.lg,
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.background,
    background: cssVars.colors.error,
    borderRadius: cssVars.borderRadius.full,
    marginBottom: cssVars.spacing.lg,
  },
  title: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textPrimary,
    margin: 0,
    marginBottom: cssVars.spacing.sm,
  },
  text: {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    margin: 0,
    marginBottom: cssVars.spacing.lg,
  },
  button: {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.xl}`,
    background: cssVars.colors.primary,
    color: cssVars.colors.background,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
  },
};
