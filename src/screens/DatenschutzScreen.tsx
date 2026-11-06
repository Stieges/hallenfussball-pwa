/**
 * DatenschutzScreen – Datenschutzerklärung (@RE-001, @RE-004)
 *
 * Text 1:1 aus der freigegebenen Endfassung, in drei Abschnitts-Dateien unter `legal/datenschutz/`.
 * Name, Anschrift und E-Mail des Betreibers kommen aus `src/config/legal.ts`.
 */

import { LegalPageLayout } from './legal/LegalPageLayout';
import { Paragraph } from './legal/DatenschutzSections';
import { AbschnitteVerantwortungHosting } from './legal/datenschutz/AbschnitteVerantwortungHosting';
import { AbschnitteKontenDaten } from './legal/datenschutz/AbschnitteKontenDaten';
import { AbschnitteFehlerRechte } from './legal/datenschutz/AbschnitteFehlerRechte';
import { LEGAL_CONFIG } from '../config/legal';

interface DatenschutzScreenProps {
  onBack: () => void;
}

export function DatenschutzScreen({ onBack }: DatenschutzScreenProps) {
  return (
    <LegalPageLayout title="Datenschutzerklärung" lastUpdated={LEGAL_CONFIG.lastUpdated} onBack={onBack}>
      <Paragraph>
        Diese Erklärung sagt in einfachen Worten, welche Daten die App „Hallenfußball Turnier-Manager“ verarbeitet, wozu, wie lange und
        welche Rechte du hast.
      </Paragraph>
      <AbschnitteVerantwortungHosting />
      <AbschnitteKontenDaten />
      <AbschnitteFehlerRechte />
    </LegalPageLayout>
  );
}

export default DatenschutzScreen;
