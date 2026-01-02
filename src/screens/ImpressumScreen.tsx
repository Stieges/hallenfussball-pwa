/**
 * ImpressumScreen - Legal Impressum/Imprint page
 *
 * Contains all legally required information according to §5 DDG:
 * - Company name and address
 * - Contact information
 * - VAT ID (if applicable)
 * - Trade register (if applicable)
 * - Responsible person for content
 * - EU dispute resolution info
 *
 * Design: Konzept §3 (Impressum)
 */

import { type CSSProperties } from 'react';
import { LegalPageLayout } from './legal/LegalPageLayout';
import { LEGAL_CONFIG, isPlaceholder } from '../config/legal';
import { cssVars } from '../design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImpressumScreenProps {
  onBack: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImpressumScreen({ onBack }: ImpressumScreenProps) {
  const { company, contact, tax, register, responsible } = LEGAL_CONFIG;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const sectionStyle: CSSProperties = {
    marginBottom: cssVars.spacing.xl,
  };

  const headingStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.semibold,
    marginBottom: cssVars.spacing.md,
    marginTop: cssVars.spacing.xl,
    color: cssVars.colors.textPrimary,
  };

  const paragraphStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    lineHeight: 1.6,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.sm,
  };

  const strongStyle: CSSProperties = {
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
  };

  const placeholderStyle: CSSProperties = {
    backgroundColor: cssVars.colors.warningLight,
    color: cssVars.colors.warning,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
    fontFamily: cssVars.fontFamilies.mono,
    fontSize: cssVars.fontSizes.sm,
  };

  const linkStyle: CSSProperties = {
    color: cssVars.colors.primary,
    textDecoration: 'underline',
  };

  // Helper to render text with placeholder styling
  const renderText = (text: string) => {
    if (isPlaceholder(text)) {
      return <span style={placeholderStyle}>{text}</span>;
    }
    return text;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <LegalPageLayout
      title="Impressum"
      lastUpdated={LEGAL_CONFIG.lastUpdated}
      onBack={onBack}
    >
      {/* Angaben gemäß §5 DDG */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Angaben gemäß § 5 DDG</h2>
        <p style={paragraphStyle}>
          <span style={strongStyle}>{renderText(company.name)}</span>
        </p>
        <p style={paragraphStyle}>
          {renderText(company.street)}<br />
          {renderText(company.city)}<br />
          {renderText(company.country)}
        </p>
      </section>

      {/* Kontakt */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Kontakt</h2>
        <p style={paragraphStyle}>
          E-Mail: {renderText(contact.email)}
        </p>
        {contact.phone && (
          <p style={paragraphStyle}>
            Telefon: {renderText(contact.phone)} <em>(optional)</em>
          </p>
        )}
      </section>

      {/* Umsatzsteuer-ID (optional) */}
      {tax?.vatId && !isPlaceholder(tax.vatId) && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Umsatzsteuer-ID</h2>
          <p style={paragraphStyle}>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />
            {renderText(tax.vatId)}
          </p>
        </section>
      )}
      {/* Show placeholder section if config has placeholder */}
      {tax?.vatId && isPlaceholder(tax.vatId) && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Umsatzsteuer-ID</h2>
          <p style={paragraphStyle}>
            Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz:<br />
            {renderText(tax.vatId)} <em>(falls vorhanden, sonst Abschnitt entfernen)</em>
          </p>
        </section>
      )}

      {/* Handelsregister (optional) */}
      {register?.court && !isPlaceholder(register.court) && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Handelsregister</h2>
          <p style={paragraphStyle}>
            {renderText(register.court)}{register.number && <>, {renderText(register.number)}</>}
          </p>
        </section>
      )}
      {/* Show placeholder section if config has placeholder */}
      {register?.court && isPlaceholder(register.court) && (
        <section style={sectionStyle}>
          <h2 style={headingStyle}>Handelsregister</h2>
          <p style={paragraphStyle}>
            {renderText(register.court)} <em>(falls eingetragen, sonst Abschnitt entfernen)</em>
          </p>
        </section>
      )}

      {/* Verantwortlich für den Inhalt */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
        <p style={paragraphStyle}>
          <span style={strongStyle}>{renderText(responsible.name)}</span><br />
          {renderText(responsible.address)}
        </p>
      </section>

      {/* EU-Streitschlichtung */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>EU-Streitschlichtung</h2>
        <p style={paragraphStyle}>
          Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{' '}
          <a
            href="https://ec.europa.eu/consumers/odr/"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            https://ec.europa.eu/consumers/odr/
          </a>
        </p>
        <p style={paragraphStyle}>
          Unsere E-Mail-Adresse finden Sie oben im Impressum.
        </p>
      </section>

      {/* Verbraucherstreitbeilegung */}
      <section style={sectionStyle}>
        <h2 style={headingStyle}>Verbraucherstreitbeilegung</h2>
        <p style={paragraphStyle}>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </section>
    </LegalPageLayout>
  );
}

export default ImpressumScreen;
