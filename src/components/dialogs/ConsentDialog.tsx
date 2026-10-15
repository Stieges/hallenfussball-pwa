/**
 * ConsentDialog - DSGVO-konformer Consent-Dialog
 *
 * Zeigt beim ersten Besuch zwei Optionen:
 * - "Nur notwendige" → Error-Tracking ohne Session Replay
 * - "Alle akzeptieren" → Error-Tracking + Session Replay
 *
 * Der Dialog kann NICHT geschlossen werden ohne eine Entscheidung zu treffen.
 * Beide Antworten sind gleich gewichtet (@OB-056).
 */

import { useState, CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, mediaQueries } from '../../design-tokens';
import { setConsentStatus, type ConsentStatus } from '../../lib/consent';
import { DialogSurface } from '../ui/molecules/DialogSurface';

interface ConsentDialogProps {
  isOpen: boolean;
  onConsent: (status: ConsentStatus) => void;
}

export const ConsentDialog = ({ isOpen, onConsent }: ConsentDialogProps) => {
  const { t } = useTranslation('settings');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = (consentData: { errorTracking: boolean; sessionReplay: boolean }) => {
    setIsSubmitting(true);
    setConsentStatus(consentData);
    const fullStatus: ConsentStatus = {
      ...consentData,
      timestamp: Date.now(),
      version: 1,
    };
    onConsent(fullStatus);
  };

  const handleAcceptAll = () => submit({ errorTracking: true, sessionReplay: true });
  const handleAcceptNecessary = () => submit({ errorTracking: true, sessionReplay: false });

  const headerStyle: CSSProperties = {
    padding: cssVars.spacing.xl,
    borderBottom: `1px solid ${cssVars.colors.border}`,
  };

  const titleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    margin: 0,
  };

  const contentStyle: CSSProperties = {
    padding: cssVars.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.lg,
  };

  const textStyle: CSSProperties = {
    margin: 0,
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textSecondary,
    lineHeight: 1.6,
  };

  const infoBoxStyle: CSSProperties = {
    padding: cssVars.spacing.md,
    background: cssVars.colors.surfaceElevated,
    borderRadius: cssVars.borderRadius.md,
    border: `1px solid ${cssVars.colors.border}`,
  };

  const infoTextStyle: CSSProperties = {
    margin: 0,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    lineHeight: 1.6,
  };

  const buttonContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  };

  // Beide Antworten teilen EINE Variante und Größe (@OB-056).
  const choiceButtonStyle: CSSProperties = {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: 'transparent',
    color: cssVars.colors.textPrimary,
    border: `1px solid ${cssVars.colors.textSecondary}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: isSubmitting ? 'wait' : 'pointer',
    minHeight: '48px',
    transition: 'background-color 0.2s',
    opacity: isSubmitting ? 0.7 : 1,
  };

  const linkStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    textDecoration: 'underline',
  };

  // Unique ID for aria-labelledby
  const titleId = 'consent-dialog-title';

  const hoverOn = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isSubmitting) {
      e.currentTarget.style.backgroundColor = cssVars.colors.surfaceHover;
    }
  };
  const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.currentTarget.style.backgroundColor = 'transparent';
  };

  return (
    // Kein Schließen per Esc, Zurück oder Abdunkelung (@OB-056: Verhalten unverändert).
    <DialogSurface
      isOpen={isOpen}
      dismissible={false}
      labelledBy={titleId}
      maxWidth="480px"
      zIndex={cssVars.zIndex.navigation}
      panelClassName="consent-dialog-modal"
    >
      <div style={headerStyle} className="consent-dialog-header">
        <h2 id={titleId} style={titleStyle}>
          {t('consent.title')}
        </h2>
      </div>

      <div style={contentStyle} className="consent-dialog-content">
        {/* Explanation text */}
        <p style={textStyle}>
          {t('consent.description')}
        </p>

        {/* Info box */}
        <div style={infoBoxStyle}>
          <p style={infoTextStyle}>
            <strong>{t('consent.necessary')}</strong> {t('consent.necessaryDescription')}
            <br />
            <strong>{t('consent.optional')}</strong> {t('consent.optionalDescription')}
          </p>
        </div>

        {/* Buttons: gleich gewichtet */}
        <div style={buttonContainerStyle}>
          <button
            onClick={handleAcceptAll}
            disabled={isSubmitting}
            style={choiceButtonStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            {t('consent.acceptAll')}
          </button>
          <button
            onClick={handleAcceptNecessary}
            disabled={isSubmitting}
            style={choiceButtonStyle}
            onMouseEnter={hoverOn}
            onMouseLeave={hoverOff}
          >
            {t('consent.acceptNecessary')}
          </button>
        </div>

        {/* Privacy link */}
        <a
          href="/#/datenschutz"
          target="_blank"
          rel="noopener noreferrer"
          style={linkStyle}
        >
          {t('consent.privacyLink')}
        </a>
      </div>

      <style>{`
        ${mediaQueries.tabletDown} {
          .consent-dialog-modal .consent-dialog-header,
          .consent-dialog-modal .consent-dialog-content {
            padding: ${cssVars.spacing.md} !important;
          }
        }
      `}</style>
    </DialogSurface>
  );
};

export default ConsentDialog;
