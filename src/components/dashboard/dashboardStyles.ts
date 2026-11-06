/**
 * Gemeinsame Stile der Startseiten-Reiter (aus `DashboardScreen.tsx` herausgelöst, nur Tokens).
 */
import type { CSSProperties } from 'react';
import { cssVars } from '../../design-tokens';

export function gridStyle(isMobile: boolean): CSSProperties {
  return {
    display: 'grid',
    gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
  };
}

export const emptyStateStyle: CSSProperties = {
  padding: `${cssVars.spacing.xl} ${cssVars.spacing.lg}`,
  textAlign: 'center',
  background: cssVars.colors.surface,
  borderRadius: cssVars.borderRadius.md,
  border: `${cssVars.borderWidth.thin} dashed ${cssVars.colors.border}`,
  color: cssVars.colors.textSecondary,
  fontSize: cssVars.fontSizes.md,
};
