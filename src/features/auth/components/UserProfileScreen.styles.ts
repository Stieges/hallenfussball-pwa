/**
 * UserProfileScreen Styles
 *
 * Extracted from UserProfileScreen.tsx for maintainability.
 * Uses design tokens for consistency.
 *
 * @see UserProfileScreen.tsx
 */

import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const styles: Record<string, CSSProperties> = {
  // =============================================================================
  // LAYOUT
  // =============================================================================

  container: {
    minHeight: 'var(--min-h-screen)',
    background: cssVars.colors.background,
    paddingBottom: '80px', // Space for bottom nav on mobile
  },

  navigationHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.surface,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },

  pageTitle: {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    margin: 0,
  },

  backButton: {
    background: 'none',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.primary,
    cursor: 'pointer',
    padding: cssVars.spacing.sm,
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  },

  contentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
    gap: cssVars.spacing.lg,
    padding: cssVars.spacing.lg,
    maxWidth: '1200px',
    margin: '0 auto',
  },

  leftColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  },

  rightColumn: {
    display: 'flex',
    flexDirection: 'column',
    minWidth: '300px',
  },

  // =============================================================================
  // CARDS
  // =============================================================================

  // =============================================================================
  // CARDS
  // =============================================================================

  card: {
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.lg,
    border: `1px solid ${cssVars.colors.border}`,
    boxShadow: cssVars.shadows.sm,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },

  cardTitle: {
    margin: 0,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    fontSize: cssVars.fontSizes.xs,
  },

  identityCard: {
    borderTop: `4px solid ${cssVars.colors.primary}`,
  },

  // =============================================================================
  // MISC
  // =============================================================================

  bannerContainer: {
    marginTop: cssVars.spacing.md,
  },
};

