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

import { LegalPageLayout } from './legal/LegalPageLayout';
import { LEGAL_CONFIG, isPlaceholder } from '../config/legal';
import {
  Section,
  Subsection,
  Paragraph,
  Strong,
  BulletList,
  DataTable,
  ExternalLink,
} from './legal/DatenschutzSections';
import { sectionStyles } from './legal/legalStyles';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DatenschutzScreenProps {
  onBack: () => void;
  /** Open cookie settings modal */
  onOpenCookieSettings?: () => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function PlaceholderText({ text }: { text: string }) {
  if (isPlaceholder(text)) {
    return <span style={sectionStyles.placeholder}>{text}</span>;
  }
  return <>{text}</>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DatenschutzScreen({ onBack, onOpenCookieSettings }: DatenschutzScreenProps) {
  const { company, contact, supervisoryAuthority } = LEGAL_CONFIG;

  return (
    <LegalPageLayout
      title="Datenschutzerklärung"
      lastUpdated={LEGAL_CONFIG.lastUpdated}
      onBack={onBack}
    >
      {/* 1. Verantwortlicher */}
      <Section number={1} title="Verantwortlicher">
        <Paragraph>
          <Strong><PlaceholderText text={company.name} /></Strong><br />
          <PlaceholderText text={company.street} />, <PlaceholderText text={company.city} /><br />
          E-Mail: <PlaceholderText text={contact.email} />
        </Paragraph>
      </Section>

      {/* 2. Übersicht der Verarbeitungen */}
      <Section number={2} title="Übersicht der Verarbeitungen">
        <Paragraph>
          Wir verarbeiten personenbezogene Daten nur, soweit dies zur Bereitstellung einer
          funktionsfähigen App sowie unserer Inhalte und Leistungen erforderlich ist.
        </Paragraph>

        <Subsection title="Arten der verarbeiteten Daten">
          <BulletList items={[
            'Bestandsdaten (z.B. Namen, E-Mail-Adressen)',
            'Nutzungsdaten (z.B. besuchte Seiten, Zugriffszeiten)',
            'Meta-/Kommunikationsdaten (z.B. Geräte-Informationen, IP-Adressen)',
          ]} />
        </Subsection>

        <Subsection title="Kategorien betroffener Personen">
          <BulletList items={[
            'Nutzer der App (Turnierveranstalter, Trainer, Zuschauer)',
          ]} />
        </Subsection>

        <Subsection title="Zwecke der Verarbeitung">
          <BulletList items={[
            'Bereitstellung der App und ihrer Funktionen',
            'Sicherheitsmaßnahmen',
            'Reichweitenmessung und Analyse (nur mit Einwilligung)',
          ]} />
        </Subsection>
      </Section>

      {/* 3. Rechtsgrundlagen */}
      <Section number={3} title="Rechtsgrundlagen">
        <Paragraph>
          Wir verarbeiten Ihre Daten auf Basis folgender Rechtsgrundlagen:
        </Paragraph>
        <DataTable
          headers={['Rechtsgrundlage', 'Anwendungsfall']}
          rows={[
            [<strong key="a">Art. 6 Abs. 1 lit. a DSGVO</strong>, 'Einwilligung (z.B. für Analytics)'],
            [<strong key="b">Art. 6 Abs. 1 lit. b DSGVO</strong>, 'Vertragserfüllung (z.B. Account-Verwaltung)'],
            [<strong key="f">Art. 6 Abs. 1 lit. f DSGVO</strong>, 'Berechtigte Interessen (z.B. Sicherheit)'],
          ]}
        />
      </Section>

      {/* 4. Hosting */}
      <Section number={4} title="Hosting">
        <Paragraph>
          Unsere App wird gehostet bei:
        </Paragraph>
        <Paragraph>
          <Strong>Vercel Inc.</Strong><br />
          340 S Lemon Ave #4133<br />
          Walnut, CA 91789, USA
        </Paragraph>
        <Paragraph>
          Vercel verarbeitet Zugriffsdaten (IP-Adresse, Zeitpunkt des Zugriffs) zur Bereitstellung
          der App. Die Verarbeitung erfolgt auf Basis unserer berechtigten Interessen
          (Art. 6 Abs. 1 lit. f DSGVO).
        </Paragraph>
        <Paragraph>
          Weitere Informationen:{' '}
          <ExternalLink href="https://vercel.com/legal/privacy-policy">
            https://vercel.com/legal/privacy-policy
          </ExternalLink>
        </Paragraph>
      </Section>

      {/* 5. Cookies und Speichertechnologien */}
      <Section number={5} title="Cookies und Speichertechnologien">
        <Subsection title="5.1 Notwendige Cookies und lokale Speicherung">
          <Paragraph>
            Wir verwenden technisch notwendige Cookies und localStorage für:
          </Paragraph>
          <DataTable
            headers={['Speicher', 'Zweck', 'Speicherdauer']}
            rows={[
              [<code key="auth">sb-*-auth-token</code>, 'Login-Session (Supabase)', 'Sitzung'],
              [<code key="consent">spielplan_cookie_consent</code>, 'Ihre Cookie-Einstellungen', '1 Jahr'],
              [<code key="storage">localStorage</code>, 'Turnierdaten (offline verfügbar)', 'Bis zur Löschung'],
            ]}
          />
          <Paragraph>
            <strong>Rechtsgrundlage:</strong> Diese Speicherung ist technisch erforderlich
            (§ 25 Abs. 2 Nr. 2 TDDDG) und bedarf keiner Einwilligung.
          </Paragraph>
        </Subsection>

        <Subsection title="5.2 Analyse-Cookies (Google Analytics 4)">
          <Paragraph>
            Mit Ihrer Einwilligung nutzen wir Google Analytics 4, einen Webanalysedienst der
            Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.
          </Paragraph>
          <Paragraph>
            <strong>Zweck:</strong> Analyse der Nutzung unserer App zur Verbesserung des Angebots.
          </Paragraph>
          <Paragraph>
            <strong>Verarbeitete Daten:</strong>
          </Paragraph>
          <BulletList items={[
            'Gekürzte IP-Adresse (IP-Anonymisierung aktiv)',
            'Besuchte Seiten und Verweildauer',
            'Geräte- und Browserinformationen',
            'Ungefährer Standort (Land/Region)',
          ]} />
          <Paragraph>
            <strong>Cookies:</strong>
          </Paragraph>
          <DataTable
            headers={['Cookie', 'Zweck', 'Speicherdauer']}
            rows={[
              [<code key="ga">_ga</code>, 'Unterscheidung von Nutzern', '2 Jahre'],
              [<code key="ga_">_ga_*</code>, 'Session-Status', '2 Jahre'],
              [<code key="gid">_gid</code>, 'Unterscheidung von Nutzern', '24 Stunden'],
            ]}
          />
          <Paragraph>
            <strong>Rechtsgrundlage:</strong> Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO,
            § 25 Abs. 1 TDDDG).
          </Paragraph>
          <Paragraph>
            <strong>Einwilligung widerrufen:</strong> Sie können Ihre Einwilligung jederzeit über{' '}
            {onOpenCookieSettings ? (
              <button
                type="button"
                style={sectionStyles.buttonLink}
                onClick={onOpenCookieSettings}
                data-testid="cookie-settings-link"
              >
                Cookie-Einstellungen
              </button>
            ) : (
              <span>"Cookie-Einstellungen" im Footer</span>
            )}{' '}
            widerrufen. Nach dem Widerruf werden die Analyse-Cookies gelöscht und keine weiteren
            Daten mehr erfasst.
          </Paragraph>
          <Paragraph>
            <strong>Datenübermittlung in die USA:</strong> Google kann Daten in die USA übermitteln.
            Google ist unter dem EU-US Data Privacy Framework zertifiziert.
          </Paragraph>
          <Paragraph>
            Weitere Informationen:{' '}
            <ExternalLink href="https://policies.google.com/privacy">
              https://policies.google.com/privacy
            </ExternalLink>
          </Paragraph>
        </Subsection>
      </Section>

      {/* 6. Kontaktaufnahme */}
      <Section number={6} title="Kontaktaufnahme">
        <Paragraph>
          Wenn Sie uns per E-Mail kontaktieren, verarbeiten wir Ihre Angaben zur Bearbeitung
          Ihrer Anfrage.
        </Paragraph>
        <Paragraph>
          <strong>Rechtsgrundlage:</strong> Berechtigte Interessen (Art. 6 Abs. 1 lit. f DSGVO)
          bzw. Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
        </Paragraph>
        <Paragraph>
          <strong>Speicherdauer:</strong> Ihre Daten werden gelöscht, sobald die Anfrage
          abschließend bearbeitet ist, es sei denn, gesetzliche Aufbewahrungspflichten bestehen.
        </Paragraph>
      </Section>

      {/* 7. Registrierung und Anmeldung */}
      <Section number={7} title="Registrierung und Anmeldung">
        <Subsection title="7.1 Account-Erstellung">
          <Paragraph>
            Bei der Registrierung verarbeiten wir:
          </Paragraph>
          <BulletList items={[
            'E-Mail-Adresse',
            'Passwort (verschlüsselt gespeichert)',
            'Zeitpunkt der Registrierung',
          ]} />
          <Paragraph>
            <strong>Zweck:</strong> Bereitstellung eines Nutzerkontos und der App-Funktionen.
          </Paragraph>
          <Paragraph>
            <strong>Rechtsgrundlage:</strong> Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
          </Paragraph>
        </Subsection>

        <Subsection title="7.2 Authentifizierung über Supabase">
          <Paragraph>
            Wir nutzen Supabase für die Authentifizierung:
          </Paragraph>
          <Paragraph>
            <Strong>Supabase Inc.</Strong><br />
            970 Toa Payoh North #07-04<br />
            Singapore 318992
          </Paragraph>
          <Paragraph>
            Supabase speichert Ihre Anmeldedaten sicher und stellt Session-Tokens bereit.
          </Paragraph>
          <Paragraph>
            Weitere Informationen:{' '}
            <ExternalLink href="https://supabase.com/privacy">
              https://supabase.com/privacy
            </ExternalLink>
          </Paragraph>
        </Subsection>
      </Section>

      {/* 8. Datenverarbeitung in der App */}
      <Section number={8} title="Datenverarbeitung in der App">
        <Subsection title="8.1 Turnierdaten">
          <Paragraph>
            Die von Ihnen erstellten Turniere, Teams und Spielergebnisse werden gespeichert:
          </Paragraph>
          <BulletList items={[
            <><strong>Lokal:</strong> Im localStorage Ihres Browsers (für Offline-Nutzung)</>,
            <><strong>Online:</strong> In der Supabase-Datenbank (für Synchronisation)</>,
          ]} />
          <Paragraph>
            <strong>Zweck:</strong> Bereitstellung der Turnierverwaltungsfunktionen.
          </Paragraph>
          <Paragraph>
            <strong>Rechtsgrundlage:</strong> Vertragserfüllung (Art. 6 Abs. 1 lit. b DSGVO).
          </Paragraph>
        </Subsection>

        <Subsection title="8.2 Keine Weitergabe an Dritte">
          <Paragraph>
            Ihre Turnierdaten werden nicht an Dritte weitergegeben, außer:
          </Paragraph>
          <BulletList items={[
            'Sie teilen ein Turnier aktiv (öffentlicher Link)',
            'Es besteht eine gesetzliche Verpflichtung',
          ]} />
        </Subsection>
      </Section>

      {/* 9. Ihre Rechte */}
      <Section number={9} title="Ihre Rechte">
        <Paragraph>
          Sie haben folgende Rechte bezüglich Ihrer personenbezogenen Daten:
        </Paragraph>
        <DataTable
          headers={['Recht', 'Beschreibung', 'Artikel']}
          rows={[
            [<strong key="auskunft">Auskunft</strong>, 'Welche Daten wir über Sie speichern', 'Art. 15 DSGVO'],
            [<strong key="berichtigung">Berichtigung</strong>, 'Korrektur unrichtiger Daten', 'Art. 16 DSGVO'],
            [<strong key="loeschung">Löschung</strong>, 'Löschung Ihrer Daten', 'Art. 17 DSGVO'],
            [<strong key="einschraenkung">Einschränkung</strong>, 'Einschränkung der Verarbeitung', 'Art. 18 DSGVO'],
            [<strong key="datenuebertragbarkeit">Datenübertragbarkeit</strong>, 'Export Ihrer Daten', 'Art. 20 DSGVO'],
            [<strong key="widerspruch">Widerspruch</strong>, 'Widerspruch gegen Verarbeitung', 'Art. 21 DSGVO'],
            [<strong key="widerruf">Widerruf</strong>, 'Widerruf erteilter Einwilligungen', 'Art. 7 Abs. 3 DSGVO'],
          ]}
        />

        <Subsection title="Ausübung Ihrer Rechte">
          <Paragraph>
            Kontaktieren Sie uns per E-Mail: <PlaceholderText text={contact.email} />
          </Paragraph>
        </Subsection>

        <Subsection title="Beschwerderecht">
          <Paragraph>
            Sie haben das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren:
          </Paragraph>
          <Paragraph>
            <Strong><PlaceholderText text={supervisoryAuthority.name} /></Strong><br />
            <PlaceholderText text={supervisoryAuthority.address} /><br />
            <ExternalLink href={isPlaceholder(supervisoryAuthority.url) ? '#' : supervisoryAuthority.url}>
              <PlaceholderText text={supervisoryAuthority.url} />
            </ExternalLink>
          </Paragraph>
        </Subsection>
      </Section>

      {/* 10. Änderungen */}
      <Section number={10} title="Änderungen dieser Datenschutzerklärung">
        <Paragraph>
          Wir behalten uns vor, diese Datenschutzerklärung anzupassen, um sie an geänderte
          Rechtslagen oder Änderungen unserer App anzupassen. Die aktuelle Version finden Sie
          stets auf dieser Seite.
        </Paragraph>
      </Section>
    </LegalPageLayout>
  );
}

export default DatenschutzScreen;
