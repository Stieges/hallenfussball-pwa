/**
 * ConsentDialog - DSGVO-konformer Consent-Dialog
 *
 * Zeigt beim ersten Besuch zwei Optionen:
 * - "Nur notwendige" → Error-Tracking ohne Session Replay
 * - "Alle akzeptieren" → Error-Tracking + Session Replay
 *
 * Der Dialog kann NICHT geschlossen werden ohne eine Entscheidung zu treffen.
 */

import { useState, useEffect, CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { cssVars, mediaQueries } from '../../design-tokens';
import { setConsentStatus, type ConsentStatus } from '../../lib/consent';

interface ConsentDialogProps {
  isOpen: boolean;
  onConsent: (status: ConsentStatus) => void;
}

export const ConsentDialog = ({ isOpen, onConsent }: ConsentDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Prevent body scroll when dialog is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const handleAcceptAll = () => {
    setIsSubmitting(true);
    const consentData = { errorTracking: true, sessionReplay: true };
    setConsentStatus(consentData);
    const fullStatus: ConsentStatus = {
      ...consentData,
      timestamp: Date.now(),
      version: 1,
    };
    onConsent(fullStatus);
  };

  const handleAcceptNecessary = () => {
    setIsSubmitting(true);
    const consentData = { errorTracking: true, sessionReplay: false };
    setConsentStatus(consentData);
    const fullStatus: ConsentStatus = {
      ...consentData,
      timestamp: Date.now(),
      version: 1,
    };
    onConsent(fullStatus);
  };

  const overlayStyle: CSSProperties = {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: cssVars.colors.overlayStrong,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: cssVars.spacing.lg,
    overflowY: 'auto',
  };

  const modalStyle: CSSProperties = {
    background: cssVars.gradients.card,
    backdropFilter: 'blur(20px)',
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    boxShadow: cssVars.shadows.lg,
    width: '100%',
    maxWidth: '480px',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    animation: 'dialogSlideIn 0.2s ease-out',
  };

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

  const primaryButtonStyle: CSSProperties = {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.semibold,
    cursor: isSubmitting ? 'wait' : 'pointer',
    minHeight: '48px',
    transition: 'background-color 0.2s',
    opacity: isSubmitting ? 0.7 : 1,
  };

  const secondaryButtonStyle: CSSProperties = {
    padding: `${cssVars.spacing.md} ${cssVars.spacing.lg}`,
    background: 'transparent',
    color: cssVars.colors.textPrimary,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    fontSize: cssVars.fontSizes.md,
    fontWeight: cssVars.fontWeights.medium,
    cursor: isSubmitting ? 'wait' : 'pointer',
    minHeight: '48px',
    transition: 'background-color 0.2s, border-color 0.2s',
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

  const dialog = (
    <div
      style={overlayStyle}
      className="consent-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div style={modalStyle} className="consent-dialog-modal">
        <div style={headerStyle}>
          <h2 id={titleId} style={titleStyle}>
            Datenschutz-Einstellungen
          </h2>
        </div>

        <div style={contentStyle}>
          {/* Explanation text */}
          <p style={textStyle}>
            Wir nutzen anonymisiertes Error-Tracking, um die App zu verbessern.
            Optional können Sie Session-Replays aktivieren, um uns bei der
            Fehlerbehebung zu helfen.
          </p>

          {/* Info box */}
          <div style={infoBoxStyle}>
            <p style={infoTextStyle}>
              <strong>Notwendig:</strong> Anonymisierte Fehlerberichte (keine
              persönlichen Daten)
              <br />
              <strong>Optional:</strong> Session-Replays zur Fehlerbehebung
              (Texte werden maskiert)
            </p>
          </div>

          {/* Buttons */}
          <div style={buttonContainerStyle}>
            <button
              onClick={handleAcceptAll}
              disabled={isSubmitting}
              style={primaryButtonStyle}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor =
                    cssVars.colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = cssVars.colors.primary;
              }}
            >
              Alle akzeptieren
            </button>
            <button
              onClick={handleAcceptNecessary}
              disabled={isSubmitting}
              style={secondaryButtonStyle}
              onMouseEnter={(e) => {
                if (!isSubmitting) {
                  e.currentTarget.style.backgroundColor =
                    cssVars.colors.surfaceHover;
                  e.currentTarget.style.borderColor =
                    cssVars.colors.borderActive;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.borderColor = cssVars.colors.border;
              }}
            >
              Nur notwendige
            </button>
          </div>

          {/* Privacy link */}
          <a
            href="/#/datenschutz"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            Datenschutzerklärung
          </a>
        </div>
      </div>

      <style>{`
        @keyframes dialogSlideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        ${mediaQueries.tabletDown} {
          .consent-dialog-overlay {
            padding: 12px !important;
            align-items: flex-start !important;
            padding-top: 32px !important;
          }

          .consent-dialog-modal {
            max-width: 100% !important;
            border-radius: 12px !important;
          }

          .consent-dialog-modal > div:first-child {
            padding: 16px !important;
          }

          .consent-dialog-modal > div:last-child {
            padding: 16px !important;
          }
        }

        @media (max-width: 480px) {
          .consent-dialog-overlay {
            padding: 8px !important;
            padding-top: 24px !important;
          }
        }
      `}</style>
    </div>
  );

  return createPortal(dialog, document.body);
};

export default ConsentDialog;
