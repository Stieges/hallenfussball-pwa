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
import { theme } from '../../styles/theme';
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
  // Zeige nichts wenn keine Daten vorhanden
  if (!organizer && !contactInfo) {
    return null;
  }

  const hasContact = contactInfo && (
    contactInfo.name ||
    contactInfo.email ||
    contactInfo.phone ||
    contactInfo.website
  );

  const containerStyle: CSSProperties = {
    marginTop: '40px',
    paddingTop: '24px',
    borderTop: `2px solid ${theme.colors.primary}`,
  };

  const contentStyle: CSSProperties = {
    display: compact ? 'block' : 'flex',
    justifyContent: 'space-between',
    alignItems: compact ? 'flex-start' : 'flex-start',
    gap: '24px',
    flexWrap: 'wrap',
  };

  const sectionStyle: CSSProperties = {
    flex: compact ? 'none' : '1 1 auto',
    minWidth: compact ? '100%' : '200px',
    marginBottom: compact ? '16px' : 0,
  };

  const labelStyle: CSSProperties = {
    fontSize: '12px',
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '8px',
  };

  const valueStyle: CSSProperties = {
    fontSize: '14px',
    color: theme.colors.text.primary,
    lineHeight: 1.6,
  };

  const linkStyle: CSSProperties = {
    color: theme.colors.primary,
    textDecoration: 'none',
  };

  return (
    <div style={containerStyle} className="tournament-footer">
      <div style={contentStyle}>
        {/* Veranstalter Sektion */}
        {organizer && (
          <div style={sectionStyle}>
            <div style={labelStyle}>Veranstalter</div>
            <div style={valueStyle}>{organizer}</div>
          </div>
        )}

        {/* Kontakt Sektion */}
        {hasContact && (
          <div style={sectionStyle}>
            <div style={labelStyle}>Kontakt</div>
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
