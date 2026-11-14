/**
 * LegalPageLayout - Shared layout for legal pages
 *
 * Features:
 * - Kopf mit Zurück-Taste bleibt beim Scrollen oben stehen (sticky): auch am Ende der langen Seite ohne Hochscrollen erreichbar (@RE-005)
 * - Title (h1)
 * - Stand unter dem Titel
 * - Consistent styling
 * - Scroll to top on mount
 *
 * Design: Konzept §5.2 (LegalPageLayout)
 */

import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { cssVars } from '../../design-tokens';
import { useIsMobile } from '../../hooks/useIsMobile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LegalPageLayoutProps {
  /** Page title (h1) */
  title: string;
  /** Last updated date (e.g., "Januar 2025") */
  lastUpdated: string;
  /** Page content */
  children: ReactNode;
  /** Back button handler */
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LegalPageLayout({
  title,
  lastUpdated,
  children,
  onBack,
}: LegalPageLayoutProps) {
  const isMobile = useIsMobile();

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    minHeight: 'var(--min-h-screen)',
    background: cssVars.colors.background,
    color: cssVars.colors.textPrimary,
    fontFamily: cssVars.fontFamilies.body,
  };

  const contentStyle: CSSProperties = {
    maxWidth: '800px',
    margin: '0 auto',
    padding: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
  };

  // Kopf bleibt oben (Fläche aus dem Token, damit der Text beim Scrollen nicht durchscheint); Notch/Statusleiste über der Taste
  const headerStyle: CSSProperties = {
    position: 'sticky',
    top: 0,
    zIndex: cssVars.zIndex.sticky,
    background: cssVars.colors.background,
    borderBottom: `${cssVars.borderWidth.thin} solid ${cssVars.colors.border}`,
    paddingTop: `calc(${cssVars.spacing.sm} + env(safe-area-inset-top, 0px))`,
    paddingBottom: cssVars.spacing.sm,
    paddingLeft: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
    paddingRight: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
  };

  const headerInnerStyle: CSSProperties = { maxWidth: '800px', margin: '0 auto' };

  const backButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.borderControl}`,
    borderRadius: cssVars.borderRadius.md,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
    minHeight: '44px',
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? cssVars.fontSizes.xl : cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    marginBottom: cssVars.spacing.lg,
    color: cssVars.colors.textPrimary,
  };

  const standStyle: CSSProperties = {
    marginTop: `calc(-1 * ${cssVars.spacing.md})`,
    marginBottom: cssVars.spacing.lg,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      <header style={headerStyle} data-testid="legal-header">
        <div style={headerInnerStyle}>
          <button
            type="button"
            style={backButtonStyle}
            onClick={onBack}
            aria-label="Zurück zur vorherigen Seite"
            data-testid="legal-back-button"
          >
            ← Zurück
          </button>
        </div>
      </header>
      <main style={contentStyle}>
        <h1 style={titleStyle}>{title}</h1>
        <p style={standStyle} data-testid="legal-stand">Stand: {lastUpdated}</p>

        <article>{children}</article>
      </main>
    </div>
  );
}

export default LegalPageLayout;
