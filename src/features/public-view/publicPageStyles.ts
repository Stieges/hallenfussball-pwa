/**
 * Gemeinsame Seitenstile der Zuschauer-Seite (B-13d1).
 * Eigene Datei, weil React-Komponenten-Dateien nur Komponenten exportieren sollen.
 */
import { CSSProperties } from 'react';
import { cssVars, layoutHeights } from '../../design-tokens';

/** Außenhülle der Zuschauer-Seite */
export const publicPageContainerStyle: CSSProperties = {
  minHeight: 'var(--min-h-screen)',
  background: `linear-gradient(135deg, ${cssVars.colors.background} 0%, ${cssVars.colors.backgroundDark} 100%)`,
  padding: cssVars.spacing.md,
  paddingBottom: `calc(${layoutHeights.bottomNav} + ${cssVars.spacing.lg} + env(safe-area-inset-bottom, 0px))`,
};

/** Inhaltsbreite der Zuschauer-Seite */
export const publicPageContentStyle: CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
};
