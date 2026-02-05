/**
 * TournamentFooter - Fußzeile mit Veranstalter und Kontaktinformationen
 *
 * Konzept:
 * - Zeigt Veranstalter-Informationen
 * - Zeigt Kontaktdaten (später aus User-Bereich)
 * - Wird im PDF-Export und in der Übersicht angezeigt
 *
 * Zukünftige Integration:
 * - ContactInfo wird aus dem User-Profil geladen
 * - User kann mehrere Kontaktprofile anlegen
 * - Beim Turnier-Erstellen wird ein Profil ausgewählt
 */

import { CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars, letterSpacing } from '../../design-tokens'
import { ContactInfo } from '../../types/tournament';

// Re-export for convenience
export type { ContactInfo };

interface TournamentFooterProps {
  organizer?: string;
  contactInfo?: ContactInfo;
  /** Kompakte Darstellung für kleine Bildschirme */
  compact?: boolean;
}

export const TournamentFooter: React.FC<TournamentFooterProps> = ({
  organizer,
  contactInfo,
  compact = false,
}) => {
  const { t } = useTranslation('tournament');
  // Zeige nichts wenn keine Daten vorhanden
  if (!organizer && !contactInfo) {
    return null;
  }

  /* eslint-disable @typescript-eslint/prefer-nullish-coalescing -- Intentional: checking for truthy values, empty string means "no contact" */
  const hasContact = contactInfo && (
    contactInfo.name ||
    contactInfo.email ||
    contactInfo.phone ||
    contactInfo.website
  );
  /* eslint-enable @typescript-eslint/prefer-nullish-coalescing */

  const containerStyle: CSSProperties = {
    marginTop: '40px',
    paddingTop: cssVars.spacing.lg,
    borderTop: `2px solid ${cssVars.colors.primary}`,
  };

  const contentStyle: CSSProperties = {
    display: compact ? 'block' : 'flex',
    justifyContent: 'space-between',
    alignItems: compact ? 'flex-start' : 'flex-start',
    gap: cssVars.spacing.lg,
    flexWrap: 'wrap',
  };

  const sectionStyle: CSSProperties = {
    flex: compact ? 'none' : '1 1 auto',
    minWidth: compact ? '100%' : '200px',
    marginBottom: compact ? cssVars.spacing.md : 0,
  };

  const labelStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing.wide,
    marginBottom: cssVars.spacing.sm,
  };

  const valueStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    color: cssVars.colors.textPrimary,
    lineHeight: 1.6,
  };

  const linkStyle: CSSProperties = {
    color: cssVars.colors.primary,
    textDecoration: 'none',
  };

  return (
    <div style={containerStyle} className="tournament-footer">
      <div style={contentStyle}>
        {/* Veranstalter Sektion */}
        {organizer && (
          <div style={sectionStyle}>
            <div style={labelStyle}>{t('footer.organizer')}</div>
            <div style={valueStyle}>{organizer}</div>
          </div>
        )}

        {/* Kontakt Sektion */}
        {hasContact && (
          <div style={sectionStyle}>
            <div style={labelStyle}>{t('footer.contact')}</div>
            <div style={valueStyle}>
              {contactInfo.name && (
                <div>{contactInfo.name}</div>
              )}
              {contactInfo.email && (
                <div>
                  <a href={`mailto:${contactInfo.email}`} style={linkStyle}>
                    {contactInfo.email}
                  </a>
                </div>
              )}
              {contactInfo.phone && (
                <div>
                  <a href={`tel:${contactInfo.phone}`} style={linkStyle}>
                    {contactInfo.phone}
                  </a>
                </div>
              )}
              {contactInfo.website && (
                <div>
                  <a
                    href={contactInfo.website.startsWith('http') ? contactInfo.website : `https://${contactInfo.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={linkStyle}
                  >
                    {contactInfo.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .tournament-footer {
            break-inside: avoid;
            margin-top: 30px !important;
          }
        }

        @media (max-width: 768px) {
          .tournament-footer > div {
            flex-direction: column !important;
          }
        }
      `}</style>
    </div>
  );
};
