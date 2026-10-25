/**
 * Gemeinsame Gestaltung der Abschluss-Oberfläche (Mockup Runde 2, 25.10.): nur Design-Tokens. Karten und Listen sind neutral
 * (Rand, Fläche), Farbe trägt nur der Hinweis oben (VISUAL-DESIGN § 7); das Symbol steht immer dabei.
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';

export const stack: CSSProperties = { display: 'grid', gap: cssVars.spacing.md };
export const tightStack: CSSProperties = { display: 'grid', gap: cssVars.spacing.sm };

export const text: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textPrimary, overflowWrap: 'anywhere' };
export const small: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.sm, lineHeight: cssVars.lineHeights.bodyMd, color: cssVars.colors.textSecondary, overflowWrap: 'anywhere' };
export const strong: CSSProperties = { fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary, overflowWrap: 'anywhere' };
export const heading: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.lg, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };
export const subHeading: CSSProperties = { margin: 0, fontSize: cssVars.fontSizes.md, lineHeight: cssVars.lineHeights.title, fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textPrimary };

export const card: CSSProperties = {
  display: 'grid', gap: cssVars.spacing.sm, padding: cssVars.spacing.md, background: cssVars.colors.surface,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, borderRadius: cssVars.borderRadius.lg, minWidth: 0,
};
export const cardSuggestion: CSSProperties = { ...card, border: `${cssVars.borderWidth.medium} solid ${cssVars.colors.primary}` };

export const listReset: CSSProperties = { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: cssVars.spacing.sm };

export const rowButton: CSSProperties = {
  width: '100%', display: 'grid', gridTemplateColumns: `${cssVars.iconSizes.sm} minmax(0, 1fr) ${cssVars.iconSizes.md}`, gap: cssVars.spacing.sm,
  alignItems: 'center', minHeight: cssVars.touchTargets.primary, padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, borderRadius: cssVars.borderRadius.md,
  background: cssVars.colors.surface, color: cssVars.colors.textPrimary, font: 'inherit', textAlign: 'left', cursor: 'pointer',
};

export const placeList: CSSProperties = {
  listStyle: 'none', margin: 0, padding: 0, border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
  borderRadius: cssVars.borderRadius.md, overflow: 'hidden', background: cssVars.colors.surface,
};
export const placeRow: CSSProperties = {
  display: 'grid', gridTemplateColumns: `${cssVars.spacing.xl} minmax(0, 1fr) auto`, gap: cssVars.spacing.sm, alignItems: 'center',
  minHeight: cssVars.touchTargets.minimum, padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
  borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`, fontSize: cssVars.fontSizes.md, fontVariantNumeric: 'tabular-nums',
};
export const placeNumber: CSSProperties = { fontWeight: cssVars.fontWeights.bold, color: cssVars.colors.textSecondary };

export const secondaryButton: CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: cssVars.spacing.sm, width: '100%',
  minHeight: cssVars.touchTargets.minimum, padding: `0 ${cssVars.spacing.md}`, borderRadius: cssVars.borderRadius.md,
  border: `${cssVars.borderWidth.thin} solid ${cssVars.colors.borderControl}`, background: 'transparent', color: cssVars.colors.textPrimary,
  font: 'inherit', fontWeight: cssVars.fontWeights.semibold, textAlign: 'left', cursor: 'pointer',
};
