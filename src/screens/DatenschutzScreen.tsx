/**
 * DatenschutzScreen - Privacy Policy page
 *
 * Contains all legally required information according to DSGVO Art. 13/14:
 * - Responsible party
 * - Data processing overview
 * - Legal basis
 * - Hosting information
 * - Cookies and storage
 * - Third-party services
 * - User rights
 *
 * Design: Konzept §4 (Datenschutzerklärung)
 */

import { type CSSProperties } from 'react';
import { LegalPageLayout } from './legal/LegalPageLayout';
import { LEGAL_CONFIG, isPlaceholder } from '../config/legal';
import { cssVars } from '../design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatenschutzScreenProps {
  onBack: () => void;
  /** Open cookie settings modal */
  onOpenCookieSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatenschutzScreen({ onBack, onOpenCookieSettings }: DatenschutzScreenProps) {
  const { company, contact, supervisoryAuthority } = LEGAL_CONFIG;

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const sectionStyle: CSSProperties = {
    marginBottom: cssVars.spacing.xl,
  };

  const h2Style: CSSProperties = {
    fontSize: cssVars.fontSizes.xl,
    fontWeight: cssVars.fontWeights.semibold,
    marginBottom: cssVars.spacing.md,
    marginTop: cssVars.spacing.xl,
    color: cssVars.colors.textPrimary,
  };

  const h3Style: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.medium,
    marginBottom: cssVars.spacing.sm,
    marginTop: cssVars.spacing.lg,
    color: cssVars.colors.textPrimary,
  };

  const paragraphStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    lineHeight: 1.6,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.md,
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
    fontFamily: 'monospace',
    fontSize: cssVars.fontSizes.sm,
  };

  const linkStyle: CSSProperties = {
    color: cssVars.colors.primary,
    textDecoration: 'underline',
  };

  const buttonLinkStyle: CSSProperties = {
    ...linkStyle,
    background: 'none',
    border: 'none',
    padding: 0,
    font: 'inherit',
    cursor: 'pointer',
  };

  const tableStyle: CSSProperties = {
    width: '100%',
    borderCollapse: 'collapse',
    marginBottom: cssVars.spacing.md,
  };

  const thStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    textAlign: 'left',
    fontWeight: cssVars.fontWeights.semibold,
    color: cssVars.colors.textPrimary,
    fontSize: cssVars.fontSizes.sm,
  };

  const tdStyle: CSSProperties = {
    padding: cssVars.spacing.sm,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
  };

  const listStyle: CSSProperties = {
    paddingLeft: cssVars.spacing.lg,
    marginBottom: cssVars.spacing.md,
  };

  const listItemStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    lineHeight: 1.6,
    color: cssVars.colors.textSecondary,
    marginBottom: cssVars.spacing.xs,
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
      title="Datenschutzerklärung"
      lastUpdated={LEGAL_CONFIG.lastUpdated}
      onBack={onBack}
    >
      {/* 1. Verantwortlicher */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>1. Verantwortlicher</h2>
        <p style={paragraphStyle}>
          <span style={strongStyle}>{renderText(company.name)}</span><br />
          {renderText(company.street)}, {renderText(company.city)}<br />
          E-Mail: {renderText(contact.email)}
        </p>
      </section>

      {/* 2. Übersicht der Verarbeitungen */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>2. Übersicht der Verarbeitungen</h2>
        <p style={paragraphStyle}>
          Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer
          funktionsfähigen App sowie unserer Inhalte und Leistungen erforderlich ist.
        </p>

        <h3 style={h3Style}>Arten der verarbeiteten Daten</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Bestandsdaten (z.B. Namen, E-Mail-Adressen)</li>
          <li style={listItemStyle}>Nutzungsdaten (z.B. besuchte Seiten, Zugriffszeiten)</li>
          <li style={listItemStyle}>Meta-/Kommunikationsdaten (z.B. Geräte-Informationen, IP-Adressen)</li>
        </ul>

        <h3 style={h3Style}>Kategorien betroffener Personen</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Nutzer der App (Turnierveranstalter, Trainer, Zuschauer)</li>
        </ul>

        <h3 style={h3Style}>Zwecke der Verarbeitung</h3>
        <ul style={listStyle}>
          <li style={listItemStyle}>Bereitstellung der App und ihrer Funktionen</li>
          <li style={listItemStyle}>Sicherheitsmaßnahmen</li>
          <li style={listItemStyle}>Reichweitenmessung und Analyse (nur mit Einwilligung)</li>
        </ul>
      </section>

      {/* 3. Rechtsgrundlagen */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>3. Rechtsgrundlagen</h2>
        <p style={paragraphStyle}>
          Wir verarbeiten Ihre Daten auf Basis folgender Rechtsgrundlagen:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Rechtsgrundlage</th>
              <th style={thStyle}>Anwendungsfall</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>Art. 6 Abs. 1 lit. a DSGVO</strong></td>
              <td style={tdStyle}>Einwilligung (z.B. für Analytics)</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Art. 6 Abs. 1 lit. b DSGVO</strong></td>
              <td style={tdStyle}>Vertragserfüllung (z.B. Account-Verwaltung)</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Art. 6 Abs. 1 lit. f DSGVO</strong></td>
              <td style={tdStyle}>Berechtigte Interessen (z.B. Sicherheit)</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* 4. Hosting */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>4. Hosting</h2>
        <p style={paragraphStyle}>
          Unsere App wird gehostet bei:
        </p>
        <p style={paragraphStyle}>
          <span style={strongStyle}>Vercel Inc.</span><br />
          340 S Lemon Ave #4133<br />
          Walnut, CA 91789, USA
        </p>
        <p style={paragraphStyle}>
          Vercel verarbeitet Zugriffsdaten (IP-Adresse, Zeitpunkt des Zugriffs) zur Bereitstellung
          der App. Die Verarbeitung erfolgt auf Basis unserer berechtigten Interessen
          (Art. 6 Abs. 1 lit. f DSGVO).
        </p>
        <p style={paragraphStyle}>
          Weitere Informationen:{' '}
          <a
            href="https://vercel.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            https://vercel.com/legal/privacy-policy
          </a>
        </p>
      </section>

      {/* 5. Cookies und Speichertechnologien */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>5. Cookies und Speichertechnologien</h2>

        <h3 style={h3Style}>5.1 Notwendige Cookies und lokale Speicherung</h3>
        <p style={paragraphStyle}>
          Wir verwenden technisch notwendige Cookies und localStorage für:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Speicher</th>
              <th style={thStyle}>Zweck</th>
              <th style={thStyle}>Speicherdauer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><code>sb-*-auth-token</code></td>
              <td style={tdStyle}>Login-Session (Supabase)</td>
              <td style={tdStyle}>Sitzung</td>
            </tr>
            <tr>
              <td style={tdStyle}><code>spielplan_cookie_consent</code></td>
              <td style={tdStyle}>Ihre Cookie-Einstellungen</td>
              <td style={tdStyle}>1 Jahr</td>
            </tr>
            <tr>
              <td style={tdStyle}><code>localStorage</code></td>
              <td style={tdStyle}>Turnierdaten (offline verfügbar)</td>
              <td style={tdStyle}>Bis zur Löschung</td>
            </tr>
          </tbody>
        </table>
        <p style={paragraphStyle}>
          <strong>Rechtsgrundlage:</strong> Diese Speicherung ist technisch erforderlich
          (§ 25 Abs. 2 Nr. 2 TDDDG) und bedarf keiner Einwilligung.
        </p>

        <h3 style={h3Style}>5.2 Analyse-Cookies (Google Analytics 4)</h3>
        <p style={paragraphStyle}>
          Mit Ihrer Einwilligung nutzen wir Google Analytics 4, einen Webanalysedienst der
          Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.
        </p>
        <p style={paragraphStyle}>
          <strong>Zweck:</strong> Analyse der Nutzung unserer App zur Verbesserung des Angebots.
        </p>
        <p style={paragraphStyle}>
          <strong>Verarbeitete Daten:</strong>
        </p>
        <ul style={listStyle}>
          <li style={listItemStyle}>Gekürzte IP-Adresse (IP-Anonymisierung aktiv)</li>
          <li style={listItemStyle}>Besuchte Seiten und Verweildauer</li>
          <li style={listItemStyle}>Geräte- und Browserinformationen</li>
          <li style={listItemStyle}>Ungefährer Standort (Land/Region)</li>
        </ul>
        <p style={paragraphStyle}>
          <strong>Cookies:</strong>
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Cookie</th>
              <th style={thStyle}>Zweck</th>
              <th style={thStyle}>Speicherdauer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><code>_ga</code></td>
              <td style={tdStyle}>Unterscheidung von Nutzern</td>
              <td style={tdStyle}>2 Jahre</td>
            </tr>
            <tr>
              <td style={tdStyle}><code>_ga_*</code></td>
              <td style={tdStyle}>Session-Status</td>
              <td style={tdStyle}>2 Jahre</td>
            </tr>
            <tr>
              <td style={tdStyle}><code>_gid</code></td>
              <td style={tdStyle}>Unterscheidung von Nutzern</td>
              <td style={tdStyle}>24 Stunden</td>
            </tr>
          </tbody>
        </table>
        <p style={paragraphStyle}>
          <strong>Rechtsgrundlage:</strong> Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO,
          § 25 Abs. 1 TDDDG).
        </p>
        <p style={paragraphStyle}>
          <strong>Einwilligung widerrufen:</strong> Sie können Ihre Einwilligung jederzeit über{' '}
          {onOpenCookieSettings ? (
            <button
              type="button"
              style={buttonLinkStyle}
              onClick={onOpenCookieSettings}
            >
              Cookie-Einstellungen
            </button>
          ) : (
            <span>"Cookie-Einstellungen" im Footer</span>
          )}{' '}
          widerrufen. Nach dem Widerruf werden die Analyse-Cookies gelöscht und keine weiteren
          Daten mehr erfasst.
        </p>
        <p style={paragraphStyle}>
          <strong>Datenübermittlung in die USA:</strong> Google kann Daten in die USA übermitteln.
          Google ist unter dem EU-US Data Privacy Framework zertifiziert.
        </p>
        <p style={paragraphStyle}>
          Weitere Informationen:{' '}
          <a
            href="https://policies.google.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            https://policies.google.com/privacy
          </a>
        </p>
      </section>

      {/* 6. Kontaktaufnahme */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>6. Kontaktaufnahme</h2>
        <p style={paragraphStyle}>
          Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre Angaben zur Bearbeitung
          Ihrer Anfrage.
        </p>
        <p style={paragraphStyle}>
          <strong>Rechtsgrundlage:</strong> Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO)
          bzw. Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
        </p>
        <p style={paragraphStyle}>
          <strong>Speicherdauer:</strong> Ihre Daten werden gelöscht, sobald die Anfrage
          abschließend bearbeitet ist, es sei denn, gesetzliche Aufbewahrungspflichten bestehen.
        </p>
      </section>

      {/* 7. Registrierung und Anmeldung */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>7. Registrierung und Anmeldung</h2>

        <h3 style={h3Style}>7.1 Account-Erstellung</h3>
        <p style={paragraphStyle}>
          Bei der Registrierung verarbeiten wir:
        </p>
        <ul style={listStyle}>
          <li style={listItemStyle}>E-Mail-Adresse</li>
          <li style={listItemStyle}>Passwort (verschlüsselt gespeichert)</li>
          <li style={listItemStyle}>Zeitpunkt der Registrierung</li>
        </ul>
        <p style={paragraphStyle}>
          <strong>Zweck:</strong> Bereitstellung eines Nutzerkontos und der App-Funktionen.
        </p>
        <p style={paragraphStyle}>
          <strong>Rechtsgrundlage:</strong> Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
        </p>

        <h3 style={h3Style}>7.2 Authentifizierung über Supabase</h3>
        <p style={paragraphStyle}>
          Wir nutzen Supabase für die Authentifizierung:
        </p>
        <p style={paragraphStyle}>
          <span style={strongStyle}>Supabase Inc.</span><br />
          970 Toa Payoh North #07-04<br />
          Singapore 318992
        </p>
        <p style={paragraphStyle}>
          Supabase speichert Ihre Anmeldedaten sicher und stellt Session-Tokens bereit.
        </p>
        <p style={paragraphStyle}>
          Weitere Informationen:{' '}
          <a
            href="https://supabase.com/privacy"
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            https://supabase.com/privacy
          </a>
        </p>
      </section>

      {/* 8. Datenverarbeitung in der App */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>8. Datenverarbeitung in der App</h2>

        <h3 style={h3Style}>8.1 Turnierdaten</h3>
        <p style={paragraphStyle}>
          Die von Ihnen erstellten Turniere, Teams und Spielergebnisse werden gespeichert:
        </p>
        <ul style={listStyle}>
          <li style={listItemStyle}><strong>Lokal:</strong> Im localStorage Ihres Browsers (für Offline-Nutzung)</li>
          <li style={listItemStyle}><strong>Online:</strong> In der Supabase-Datenbank (für Synchronisation)</li>
        </ul>
        <p style={paragraphStyle}>
          <strong>Zweck:</strong> Bereitstellung der Turnierverwaltungsfunktionen.
        </p>
        <p style={paragraphStyle}>
          <strong>Rechtsgrundlage:</strong> Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
        </p>

        <h3 style={h3Style}>8.2 Keine Weitergabe an Dritte</h3>
        <p style={paragraphStyle}>
          Ihre Turnierdaten werden nicht an Dritte weitergegeben, außer:
        </p>
        <ul style={listStyle}>
          <li style={listItemStyle}>Sie teilen ein Turnier aktiv (öffentlicher Link)</li>
          <li style={listItemStyle}>Es besteht eine gesetzliche Verpflichtung</li>
        </ul>
      </section>

      {/* 9. Ihre Rechte */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>9. Ihre Rechte</h2>
        <p style={paragraphStyle}>
          Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:
        </p>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={thStyle}>Recht</th>
              <th style={thStyle}>Beschreibung</th>
              <th style={thStyle}>Artikel</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={tdStyle}><strong>Auskunft</strong></td>
              <td style={tdStyle}>Welche Daten wir über Sie speichern</td>
              <td style={tdStyle}>Art. 15 DSGVO</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Berichtigung</strong></td>
              <td style={tdStyle}>Korrektur unrichtiger Daten</td>
              <td style={tdStyle}>Art. 16 DSGVO</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Löschung</strong></td>
              <td style={tdStyle}>Löschung Ihrer Daten</td>
              <td style={tdStyle}>Art. 17 DSGVO</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Einschränkung</strong></td>
              <td style={tdStyle}>Einschränkung der Verarbeitung</td>
              <td style={tdStyle}>Art. 18 DSGVO</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Datenübertragbarkeit</strong></td>
              <td style={tdStyle}>Export Ihrer Daten</td>
              <td style={tdStyle}>Art. 20 DSGVO</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Widerspruch</strong></td>
              <td style={tdStyle}>Widerspruch gegen Verarbeitung</td>
              <td style={tdStyle}>Art. 21 DSGVO</td>
            </tr>
            <tr>
              <td style={tdStyle}><strong>Widerruf</strong></td>
              <td style={tdStyle}>Widerruf erteilter Einwilligungen</td>
              <td style={tdStyle}>Art. 7 Abs. 3 DSGVO</td>
            </tr>
          </tbody>
        </table>

        <h3 style={h3Style}>Ausübung Ihrer Rechte</h3>
        <p style={paragraphStyle}>
          Kontaktieren Sie uns per E-Mail: {renderText(contact.email)}
        </p>

        <h3 style={h3Style}>Beschwerderecht</h3>
        <p style={paragraphStyle}>
          Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:
        </p>
        <p style={paragraphStyle}>
          <span style={strongStyle}>{renderText(supervisoryAuthority.name)}</span><br />
          {renderText(supervisoryAuthority.address)}<br />
          <a
            href={isPlaceholder(supervisoryAuthority.url) ? '#' : supervisoryAuthority.url}
            target="_blank"
            rel="noopener noreferrer"
            style={linkStyle}
          >
            {renderText(supervisoryAuthority.url)}
          </a>
        </p>
      </section>

      {/* 10. Änderungen */}
      <section style={sectionStyle}>
        <h2 style={h2Style}>10. Änderungen dieser Datenschutzerklärung</h2>
        <p style={paragraphStyle}>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte
          Rechtslagen oder Änderungen unserer App anzupassen. Die aktuelle Version finden Sie
          stets auf dieser Seite.
        </p>
      </section>
    </LegalPageLayout>
  );
}

export default DatenschutzScreen;
