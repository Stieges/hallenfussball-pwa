/**
 * LegalPageLayout - Shared layout for legal pages
 *
 * Features:
 * - Back button at top
 * - Title (h1)
 * - Last updated date at bottom
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

  const backButtonStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    marginBottom: cssVars.spacing.lg,
    background: 'transparent',
    border: `1px solid ${cssVars.colors.border}`,
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

  const footerStyle: CSSProperties = {
    marginTop: cssVars.spacing.xl,
    paddingTop: cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.border}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    fontStyle: 'italic',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      <main style={contentStyle}>
        <button
          type="button"
          style={backButtonStyle}
          onClick={onBack}
          aria-label="Zurück zur vorherigen Seite"
          data-testid="legal-back-button"
        >
          ← Zurück
        </button>

        <h1 style={titleStyle}>{title}</h1>

        <article>{children}</article>

        <footer style={footerStyle}>
          Stand: {lastUpdated}
        </footer>
      </main>
    </div>
  );
}

export default LegalPageLayout;
