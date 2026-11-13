/**
 * Stile der Admin-Seitenleiste (aus AdminSidebar.tsx herausgelöst, H4-8, Verhalten gleich).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { ADMIN_LAYOUT } from '../constants/admin.constants';

export const styles = {
  sidebar: {
    width: ADMIN_LAYOUT.sidebarWidth,
    minWidth: ADMIN_LAYOUT.sidebarWidth,
    height: '100%',
    background: cssVars.colors.surface,
    borderRight: `1px solid ${cssVars.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as CSSProperties,

  scrollContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: cssVars.spacing.md,
    paddingBottom: 0,
  } as CSSProperties,

  backButton: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    marginBottom: cssVars.spacing.md,
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.bodySm,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    textAlign: 'left',
    minHeight: ADMIN_LAYOUT.itemHeight, // @OB-022: Tasten mindestens 44 hoch
  } as CSSProperties,

  groupLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary, // Muted erreicht 4,5 : 1 nicht (visual:metrics kontrast.text)
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${cssVars.spacing.md} ${cssVars.spacing.sm}`,
    paddingBottom: cssVars.spacing.xs,
  } as CSSProperties,

  categoryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    marginBottom: '2px',
    background: 'transparent',
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.bodyMd,
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    width: '100%',
    textAlign: 'left',
    minHeight: ADMIN_LAYOUT.itemHeight,
  } as CSSProperties,

  categoryItemActive: {
    background: cssVars.colors.primarySubtle,
    color: cssVars.colors.primary,
    borderLeft: `3px solid ${cssVars.colors.primary}`,
    marginLeft: '-3px',
  } as CSSProperties,

  // Schrift in Textfarbe: Error auf der roten Tönung erreicht 4,5 : 1 nicht (visual:metrics kontrast.text);
  // die Gefahr zeigen Tönung und Symbol
  categoryItemDanger: {
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  // wie categoryItemDanger: Warnfarbe als Schrift auf der Tönung erreicht 4,5 : 1 nicht
  categoryItemWarning: {
    color: cssVars.colors.textPrimary,
  } as CSSProperties,

  categoryIcon: {
    fontSize: ADMIN_LAYOUT.iconSize,
    width: ADMIN_LAYOUT.iconSize,
    textAlign: 'center',
  } as CSSProperties,

  categoryLabel: {
    flex: 1,
    minWidth: 0,
    overflowWrap: 'anywhere', // lange Namen umbrechen statt mit Auslassungspunkten zu enden
  } as CSSProperties,

  badge: {
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    padding: '2px 6px',
    borderRadius: cssVars.borderRadius.full,
    minWidth: 20,
    textAlign: 'center',
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
    margin: `${cssVars.spacing.md} 0`,
  } as CSSProperties,

  dangerZone: {
    background: cssVars.colors.dangerSubtle,
    margin: `0 -${cssVars.spacing.md}`,
    padding: cssVars.spacing.md,
    marginTop: cssVars.spacing.sm,
  } as CSSProperties,

  dangerZoneLabel: {
    fontSize: cssVars.fontSizes.labelSm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    paddingBottom: cssVars.spacing.sm,
  } as CSSProperties,

} as const;
