/**
 * Betreiberangaben in Impressum und Datenschutzerklärung (@RE-004): beide lesen dieselben Felder aus `src/config/legal.ts`.
 * Ein Wert in eckigen Klammern (Platzhalter) wird hervorgehoben, damit er in der Vorschau nicht übersehen wird.
 */
import { LEGAL_CONFIG, isPlaceholder } from '../../config/legal';
import { sectionStyles } from './legalStyles';

/** Ein Wert aus der Konfiguration; Platzhalter sind markiert. */
export function Angabe({ text }: { text: string }) {
  if (isPlaceholder(text)) {
    return <span style={sectionStyles.placeholder}>{text}</span>;
  }
  return <>{text}</>;
}

export function Betreiberemail() {
  return <Angabe text={LEGAL_CONFIG.email} />;
}

interface BetreiberAdresseProps {
  /** Impressum: mit Zeile „Deutschland“ */
  mitLand?: boolean;
  /** Datenschutzerklärung: mit Zeile „E-Mail: …“ */
  mitEmail?: boolean;
}

export function BetreiberAdresse({ mitLand = false, mitEmail = false }: BetreiberAdresseProps) {
  const { name, careOf, street, city, email } = LEGAL_CONFIG;
  return (
    <p style={sectionStyles.paragraph} data-testid="betreiber-adresse">
      <Angabe text={name} /><br />
      {careOf.trim() !== '' && (<><Angabe text={careOf} /><br /></>)}
      <Angabe text={street} /><br />
      <Angabe text={city} />
      {mitLand && (<><br />Deutschland</>)}
      {mitEmail && (<><br />E-Mail: <Angabe text={email} /></>)}
    </p>
  );
}
