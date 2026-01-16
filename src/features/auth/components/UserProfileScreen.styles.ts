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

  identityHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.lg,
  },

  profileInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  userName: {
    margin: 0,
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
  },

  userEmail: {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  },

  // =============================================================================
  // BADGES
  // =============================================================================

  badgeGuest: {
    display: 'inline-block',
    marginTop: cssVars.spacing.xs,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.warningSubtle,
    color: cssVars.colors.warning,
    fontSize: cssVars.fontSizes.xs,
    alignSelf: 'flex-start',
  },

  badgeVerify: {
    display: 'inline-block',
    marginTop: cssVars.spacing.xs,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.xs,
    alignSelf: 'flex-start',
  },

  // =============================================================================
  // STATS
  // =============================================================================

  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: cssVars.spacing.md,
  },

  statItem: {
    textAlign: 'center',
    padding: cssVars.spacing.sm,
    background: cssVars.colors.background,
    borderRadius: cssVars.borderRadius.md,
  },

  statValue: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    marginBottom: '4px',
  },

  statLabel: {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  },

  // =============================================================================
  // PREFERENCES & LIST ITEMS
  // =============================================================================

  listRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'pointer',
  },

  listLabel: {
    fontSize: cssVars.fontSizes.md,
  },

  listValue: {
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
  },

  divider: {
    height: '1px',
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.xs} 0`,
  },

  // =============================================================================
  // ACTION BUTTONS
  // =============================================================================

  actionButton: {
    width: '100%',
    textAlign: 'left',
    padding: `${cssVars.spacing.sm} 0`,
    background: 'none',
    border: 'none',
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  },

  actionButtonDisabled: {
    color: cssVars.colors.textMuted,
    cursor: 'not-allowed',
    opacity: 0.6,
  },

  selectInput: {
    padding: '4px 8px',
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
    cursor: 'pointer',
  },

  // =============================================================================
  // TOGGLE SWITCH
  // =============================================================================

  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} 0`,
    cursor: 'pointer',
  },

  toggleLabel: {
    fontSize: cssVars.fontSizes.md,
  },

  toggleSwitch: {
    width: '44px',
    height: '24px',
    borderRadius: '12px',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    transition: 'background 0.2s ease',
  },

  toggleKnob: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    background: cssVars.colors.textOnDark,
    boxShadow: `0 1px 2px ${cssVars.colors.shadowSoft}`,
  },

  // =============================================================================
  // TOURNAMENTS SECTION
  // =============================================================================

  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: cssVars.spacing.md,
  },

  sectionTitle: {
    margin: 0,
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
  },

  sortSelect: {
    padding: cssVars.spacing.xs,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    color: cssVars.colors.textPrimary,
  },

  tournamentList: {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  },

  // =============================================================================
  // EMPTY & LOADING STATES
  // =============================================================================

  emptyState: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    background: cssVars.colors.surface,
    borderRadius: cssVars.borderRadius.lg,
    border: `1px dashed ${cssVars.colors.border}`,
    color: cssVars.colors.textSecondary,
  },

  emptyText: {
    marginBottom: cssVars.spacing.md,
  },

  loadingState: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textSecondary,
  },

  // =============================================================================
  // AVATAR
  // =============================================================================

  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: cssVars.borderRadius.full,
    background: cssVars.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  avatarImage: {
    width: '64px',
    height: '64px',
    borderRadius: cssVars.borderRadius.full,
    objectFit: 'cover' as const,
    flexShrink: 0,
  },

  avatarInitials: {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
  },

  // =============================================================================
  // MISC
  // =============================================================================

  bannerContainer: {
    marginTop: cssVars.spacing.md,
  },
};
