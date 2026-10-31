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
import { useTranslation } from 'react-i18next';
import { cssVars, layoutHeights } from '../../design-tokens';
import { useIsMobile } from '../../hooks/useIsMobile';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FooterProps {
  /** @OB-002 (Platzhalter Nr. 15): „Cookie-Einstellungen“ ist ausgeblendet – der
   *  Einstieg kommt erst mit Zielbild Ü3; die Prop bleibt für Aufrufer bestehen. */
  onOpenCookieSettings?: () => void;
  /** @OB-022: am Handy steht eine feste untere Leiste (Dashboard, Turnierseiten); die Fußzeile reserviert ihre Höhe plus Safe-Area,
   *  damit Impressum und Datenschutz am Seitenende nicht darunter liegen. */
  untereLeiste?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function Footer({ onOpenCookieSettings: _onOpenCookieSettings, untereLeiste = false }: FooterProps) {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { t } = useTranslation('common');
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

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const randAbstand = isMobile ? cssVars.spacing.md : cssVars.spacing.lg;
  const footerStyle: CSSProperties = {
    marginTop: 'auto',
    paddingTop: randAbstand,
    paddingLeft: randAbstand,
    paddingRight: randAbstand,
    paddingBottom: isMobile && untereLeiste
      // die schwebende Leiste „Teilen · Als PDF“ des Spielplans (Höhe aus --schedule-action-bar-h) liegt über der unteren Leiste
      ? `calc(${cssVars.spacing.xl} + ${layoutHeights.bottomNav} + var(--schedule-action-bar-h, 0px) + env(safe-area-inset-bottom, 0px))`
      : randAbstand,
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
        {t('footer.copyright', { year: currentYear })}
      </div>
      <nav style={linksContainerStyle} aria-label={t('footer.legalLinksLabel')}>
        <button
          type="button"
          style={linkStyle}
          onClick={handleImpressumClick}
          aria-label={t('footer.impressumAriaLabel')}
          data-testid="footer-impressum-link"
        >
          {t('footer.impressum')}
        </button>
        {!isMobile && <span style={separatorStyle}>•</span>}
        <button
          type="button"
          style={linkStyle}
          onClick={handleDatenschutzClick}
          aria-label={t('footer.datenschutzAriaLabel')}
          data-testid="footer-datenschutz-link"
        >
          {t('footer.datenschutz')}
        </button>
      </nav>
    </footer>
  );
}

export default Footer;
