/**
 * Stile des mobilen Admin-Hubs (aus AdminMobileHub.tsx herausgelöst, H4-8, Verhalten gleich).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { ADMIN_LAYOUT } from '../constants/admin.constants';

export const styles = {
  container: {
    minHeight: '100vh',
    background: cssVars.colors.background,
    paddingBottom: 'env(safe-area-inset-bottom)',
  } as CSSProperties,

  header: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    background: cssVars.colors.surface,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  } as CSSProperties,

  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: '1.25rem',
    cursor: 'pointer',
  } as CSSProperties,

  headerTitle: {
    flex: 1,
    fontSize: cssVars.fontSizes.titleMd,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  content: {
    padding: cssVars.spacing.md,
  } as CSSProperties,

  groupLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${cssVars.spacing.md} 0 ${cssVars.spacing.sm}`,
  } as CSSProperties,

  categoryCard: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    marginBottom: cssVars.spacing.sm,
    background: cssVars.colors.surface,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    minHeight: ADMIN_LAYOUT.mobileHubItemHeight,
    width: '100%',
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  } as CSSProperties,

  categoryCardDanger: {
    background: cssVars.colors.dangerSubtle,
    borderColor: cssVars.colors.dangerBorder,
  } as CSSProperties,

  categoryCardWarning: {
    background: cssVars.colors.warningSubtle,
    borderColor: cssVars.colors.warningBorder,
  } as CSSProperties,

  categoryCardDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as CSSProperties,

  categoryIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  } as CSSProperties,

  categoryContent: {
    flex: 1,
    minWidth: 0,
  } as CSSProperties,

  categoryLabel: {
    fontSize: cssVars.fontSizes.bodyMd,
    fontWeight: cssVars.fontWeights.medium,
    color: cssVars.colors.textPrimary,
    marginBottom: 2,
  } as CSSProperties,

  categoryLabelDanger: {
    color: cssVars.colors.error,
  } as CSSProperties,

  categoryLabelWarning: {
    color: cssVars.colors.warning,
  } as CSSProperties,

  categoryDescription: {
    fontSize: cssVars.fontSizes.labelSm,
    color: cssVars.colors.textSecondary,
  } as CSSProperties,

  categoryArrow: {
    fontSize: '1.25rem',
    color: cssVars.colors.textMuted,
  } as CSSProperties,

  badge: {
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    padding: '2px 8px',
    borderRadius: cssVars.borderRadius.full,
  } as CSSProperties,

  neuBadge: {
    border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.primary}`,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    padding: `0 ${cssVars.spacing.xs}`,
    borderRadius: cssVars.borderRadius.full,
  } as CSSProperties,

  separator: {
    height: 1,
    background: cssVars.colors.border,
    margin: `${cssVars.spacing.lg} 0`,
  } as CSSProperties,

  dangerZoneSection: {
    background: cssVars.colors.dangerSubtle,
    margin: `${cssVars.spacing.md} -${cssVars.spacing.md}`,
    padding: cssVars.spacing.md,
    marginTop: cssVars.spacing.lg,
  } as CSSProperties,

  dangerZoneLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.error,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: cssVars.spacing.sm,
  } as CSSProperties,

  searchContainer: {
    padding: `0 ${cssVars.spacing.md} ${cssVars.spacing.md}`,
    background: cssVars.colors.surface,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  } as CSSProperties,

  searchInput: {
    width: '100%',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    fontSize: cssVars.fontSizes.bodyMd,
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    outline: 'none',
  } as CSSProperties,

  noResults: {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.bodyMd,
  } as CSSProperties,
} as const;
