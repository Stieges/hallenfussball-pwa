/**
 * LegalLinks – die zwei Links „Impressum“ und „Datenschutz“ (@RE-001). Ohne Anmeldung erreichbar (Routen /impressum, /datenschutz).
 * In der Fußzeile jeder Seite und am Ende der Anmelde-/Registrier-Dialoge, die die Fußzeile verdecken.
 */
import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens';
import { useIsMobile } from '../../hooks/useIsMobile';

export type LegalPath = '/impressum' | '/datenschutz';

interface LegalLinksProps {
  /** Vorsatz der data-testid: `<vorsatz>-impressum-link`, `<vorsatz>-datenschutz-link` */
  testIdPrefix: string;
  /** Öffnet die Seite (der Aufrufer navigiert, URL-ROUTING: nie selbst setScreen) */
  onOpen: (path: LegalPath) => void;
}

export function LegalLinks({ testIdPrefix, onOpen }: LegalLinksProps) {
  const isMobile = useIsMobile();
  const { t } = useTranslation('common');

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: isMobile ? cssVars.spacing.sm : cssVars.spacing.md,
  };

  const linkStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textDecoration: 'underline',
    textUnderlineOffset: cssVars.spacing.xs,
    cursor: 'pointer',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    font: 'inherit',
    minHeight: cssVars.touchTargets.minimum,
    display: 'inline-flex',
    alignItems: 'center',
  };

  const separatorStyle: CSSProperties = {
    color: cssVars.colors.textMuted,
    userSelect: 'none',
  };

  return (
    <nav style={containerStyle} aria-label={t('footer.legalLinksLabel')}>
      <a
        href="#/impressum"
        style={linkStyle}
        onClick={(e) => { e.preventDefault(); onOpen('/impressum'); }}
        aria-label={t('footer.impressumAriaLabel')}
        data-testid={`${testIdPrefix}-impressum-link`}
      >
        {t('footer.impressum')}
      </a>
      {!isMobile && <span style={separatorStyle}>•</span>}
      <a
        href="#/datenschutz"
        style={linkStyle}
        onClick={(e) => { e.preventDefault(); onOpen('/datenschutz'); }}
        aria-label={t('footer.datenschutzAriaLabel')}
        data-testid={`${testIdPrefix}-datenschutz-link`}
      >
        {t('footer.datenschutz')}
      </a>
    </nav>
  );
}
