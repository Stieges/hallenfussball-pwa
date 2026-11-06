/**
 * ImpressumScreen – Impressum (@RE-001, @RE-004)
 *
 * Text 1:1 aus der freigegebenen Endfassung; Name, Anschrift und E-Mail kommen aus `src/config/legal.ts`.
 */

import { Link } from 'react-router-dom';
import { LegalPageLayout } from './legal/LegalPageLayout';
import { BetreiberAdresse, Betreiberemail } from './legal/BetreiberAngaben';
import { LEGAL_CONFIG } from '../config/legal';
import { sectionStyles } from './legal/legalStyles';

interface ImpressumScreenProps {
  onBack: () => void;
}

export function ImpressumScreen({ onBack }: ImpressumScreenProps) {
  return (
    <LegalPageLayout title="Impressum" lastUpdated={LEGAL_CONFIG.lastUpdated} onBack={onBack}>
      <section style={sectionStyles.section} data-testid="impressum-angaben">
        <h2 style={sectionStyles.h2}>Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV</h2>
        <BetreiberAdresse mitLand />
      </section>

      <section style={sectionStyles.section}>
        <h2 style={sectionStyles.h2}>Kontakt</h2>
        <p style={sectionStyles.paragraph}>
          E-Mail: <Betreiberemail />
        </p>
      </section>

      <section style={sectionStyles.section}>
        <h2 style={sectionStyles.h2}>Zu dieser App</h2>
        <p style={sectionStyles.paragraph}>
          „Hallenfußball Turnier-Manager“ ist ein privates, ehrenamtliches Projekt. Es wird ohne Entgelt und ohne Werbung angeboten.
        </p>
        <p style={sectionStyles.paragraph}>
          Spielpläne, Ergebnisse und andere Angaben zu einem Turnier trägt der jeweilige Veranstalter ein und ist dafür selbst verantwortlich.
        </p>
        <p style={sectionStyles.paragraph}>
          Wie die App mit personenbezogenen Daten umgeht, steht in der{' '}
          <Link to="/datenschutz" style={sectionStyles.link} data-testid="impressum-datenschutz-link">Datenschutzerklärung</Link>.
        </p>
      </section>
    </LegalPageLayout>
  );
}

export default ImpressumScreen;
