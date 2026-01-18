/**
 * Footer - Global footer with legal links
 *
 * Displays on all screens:
 * - Copyright notice
 * - Links: Impressum, Datenschutz, Cookie-Einstellungen
 *
 * Design: Konzept §2 (Footer-Komponente)
 */

import { type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { cssVars } from '../../design-tokens';
import { useIsMobile } from '../../hooks/useIsMobile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FooterProps {
  /** Open cookie settings modal/banner */
  onOpenCookieSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Footer({ onOpenCookieSettings }: FooterProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  const handleImpressumClick = () => {
    void navigate('/impressum');
  };

  const handleDatenschutzClick = () => {
    void navigate('/datenschutz');
  };

  const handleCookieSettingsClick = () => {
    onOpenCookieSettings?.();
  };

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const footerStyle: CSSProperties = {
    marginTop: 'auto',
    padding: isMobile ? cssVars.spacing.md : cssVars.spacing.lg,
    borderTop: `1px solid ${cssVars.colors.border}`,
    backgroundColor: cssVars.colors.background,
    textAlign: 'center',
  };

  const copyrightStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.sm,
  };

  const linksContainerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
  };

  const linkStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textDecoration: 'underline',
    textUnderlineOffset: '2px',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    font: 'inherit',
    minHeight: '44px',
    display: 'inline-flex',
    alignItems: 'center',
  };

  const separatorStyle: CSSProperties = {
    color: cssVars.colors.textMuted,
    userSelect: 'none',
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <footer style={footerStyle}>
      <div style={copyrightStyle}>
        © {currentYear} Spielplan
      </div>
      <nav style={linksContainerStyle} aria-label="Rechtliche Links">
        <button
          type="button"
          style={linkStyle}
          onClick={handleImpressumClick}
          aria-label="Impressum öffnen"
          data-testid="footer-impressum-link"
        >
          Impressum
        </button>
        {!isMobile && <span style={separatorStyle}>•</span>}
        <button
          type="button"
          style={linkStyle}
          onClick={handleDatenschutzClick}
          aria-label="Datenschutzerklärung öffnen"
          data-testid="footer-datenschutz-link"
        >
          Datenschutz
        </button>
        {!isMobile && <span style={separatorStyle}>•</span>}
        <button
          type="button"
          style={linkStyle}
          onClick={handleCookieSettingsClick}
          aria-label="Cookie-Einstellungen öffnen"
          data-testid="footer-cookie-settings-link"
        >
          Cookie-Einstellungen
        </button>
      </nav>
    </footer>
  );
}

export default Footer;
