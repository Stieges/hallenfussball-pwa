/* eslint-disable local-rules/no-hardcoded-sport-terms, local-rules/no-hardcoded-sport-terms-preferred --
   Rechtstext wörtlich aus der freigegebenen Endfassung: „Nr.“ ist die Gesetzesangabe (§ 25 Abs. 2 Nr. 2 TDDDG), „Helfer-Zugang“ der Name des Eintrags im Gerätespeicher. */
/**
 * Datenschutzerklärung, Abschnitte 10 bis 15: Fehlerberichte, Speicherdauer, Kinder, Rechte, Speichern auf dem Gerät, Änderungen.
 * Text aus der freigegebenen Endfassung (@RE-004).
 */
import { Section, Paragraph, Strong, BulletList, DataTable, ExternalLink } from '../DatenschutzSections';
import { Link } from 'react-router-dom';
import { sectionStyles } from '../legalStyles';
import { Betreiberemail } from '../BetreiberAngaben';
import { LEGAL_CONFIG } from '../../../config/legal';

const SPEICHERDAUER: string[][] = [
  ['Turnier mit Spielen, Ereignissen, Rückennummern, Helfern und Monitor-Daten', 'spätestens 6 Monate nach dem Turnier gelöscht oder anonymisiert (automatisch oder durch mich). Endergebnisse und Tabellen ohne Rückennummern können länger bleiben, wenn der Veranstalter das Turnier behalten will.'],
  ['Konto', 'bis zur Löschung auf Anfrage'],
  ['Hosting-Protokolle (Vercel)', 'kurz, nach den Vorgaben von Vercel'],
  ['Datenbank-Protokolle (Supabase)', 'kurz, nach den Vorgaben von Supabase'],
  ['Fehlerberichte (Sentry)', 'höchstens 90 Tage'],
  ['Daten auf deinem Gerät', 'bis du sie im Browser löschst. Der Zuschauer-Stand nur bis zum Ende des Turniertags.'],
];

const GERAETESPEICHER: string[][] = [
  ['Anmeldung (Sitzungs-Token) und zwischengespeichertes Profil', 'lokaler Speicher', 'damit du angemeldet bleibst'],
  ['Geräte-Kennung', 'lokaler Speicher', 'damit immer nur ein Gerät ein Spielfeld steuert und Einträge zugeordnet werden'],
  ['Helfer-Zugang', 'lokaler Speicher', 'damit Helfer nicht jedes Mal neu anfragen müssen'],
  ['„Mein Team“ (Zuschauer)', 'lokaler Speicher', 'deine eigene Auswahl'],
  ['Letzter Turnierstand (Zuschauer)', 'lokaler Speicher', 'Anzeige ohne Netz, verworfen am Ende des Turniertags'],
  ['Turnierdaten für den Offline-Betrieb', 'Datenbank im Browser (IndexedDB)', 'damit Turnierleitung und Helfer ohne Netz weiterarbeiten'],
  ['App-Dateien und kurzzeitig zwischengespeicherte Abrufe (bis zu 1 Stunde)', 'Zwischenspeicher des Service Workers', 'schnelles Laden und Offline-Betrieb'],
  ['Darstellung: Thema, Schriftgröße, Kontrast, Sprache, Entwürfe von Formularen, Einstellung zu Fehlerberichten', 'lokaler Speicher', 'deine eigenen Einstellungen'],
];

export function AbschnitteFehlerRechte() {
  const behoerde = LEGAL_CONFIG.supervisoryAuthority;
  return (
    <>
      <Section number={10} title="Fehlerberichte (Sentry)">
        <Paragraph>
          Stürzt die App ab oder tritt ein Fehler auf, kann sie einen Fehlerbericht senden an: Functional Software, Inc. (Sentry), 45
          Fremont Street, 8th Floor, San Francisco, CA 94105, USA. Die Daten werden in der <Strong>EU-Region von Sentry (Frankfurt,
          Deutschland)</Strong> gespeichert. Vertreter in der EU: Sentry Software Netherlands B.V., Schiphol Boulevard 359, 1118 BJ
          Amsterdam Schiphol, Niederlande.
        </Paragraph>
        <BulletList
          items={[
            'Inhalt: Fehlermeldung und technischer Ablauf, aufgerufene Seite (ohne Zugangscodes), Browser, Betriebssystem, App-Version, einzelne Leistungsmessungen (nur ein kleiner Teil der Aufrufe) und bei Angemeldeten eine zufällige Nutzerkennung (keine E-Mail, kein Name). Bei jedem Start gehen einmal technische Angaben zum Zwischenspeicher der App mit.',
            <>Die <Strong>IP-Adresse wird nicht gespeichert.</Strong> Technisch erreicht sie Sentry beim Empfang trotzdem kurz, wird aber nicht abgelegt. Es gibt <Strong>keine Aufzeichnung deiner Bildschirm-Sitzung.</Strong></>,
            'Zweck: Fehler finden und beheben, damit die App am Turniertag zuverlässig läuft',
            'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer funktionierenden App). Die Fehlerberichte sind eingeschaltet, ohne dass du zustimmen musst.',
            <><Strong>Widerspruch:</Strong> Du kannst Fehlerberichte jederzeit in den <Link to="/settings" style={sectionStyles.link} data-testid="datenschutz-einstellungen-link">Einstellungen der App</Link> abschalten (Art. 21 DSGVO). Das gilt ab dann für dieses Gerät.</>,
            'Das Fehlertool legt dafür keine eigenen Einträge auf deinem Gerät an.',
            'Mit Sentry besteht ein Vertrag zur Auftragsverarbeitung. Für mögliche Zugriffe aus den USA gelten das EU-US Data Privacy Framework, bei dem Sentry zertifiziert ist, und Standardvertragsklauseln.',
            'Speicherdauer: höchstens 90 Tage.',
          ]}
        />
      </Section>

      <Section number={11} title="Wie lange Daten gespeichert werden">
        <DataTable headers={['Daten', 'Dauer']} rows={SPEICHERDAUER} />
      </Section>

      <Section number={12} title="Kinder und Jugendliche">
        <Paragraph>Die App wird auch bei Jugendturnieren eingesetzt. Deshalb:</Paragraph>
        <BulletList
          items={[
            'Die App speichert keine Namen von Spielerinnen und Spielern, nur Rückennummern.',
            'Torschützen werden öffentlich nur als Mannschaft und Rückennummer gezeigt, und nur wenn die Turnierleitung das einschaltet. Der Kindermodus blendet sie aus.',
            'Es gibt keine Fotos, keine Werbung und kein Tracking.',
            'Helfer unter 16 Jahren sollten mit Wissen ihrer Eltern helfen und als Namen nur einen Vornamen oder ein Kürzel eingeben.',
          ]}
        />
        <Paragraph>Der Veranstalter ist dafür zuständig, die Eltern über das Turnier und diese Erklärung zu informieren.</Paragraph>
      </Section>

      <Section number={13} title="Deine Rechte">
        <Paragraph>Du hast das Recht auf</Paragraph>
        <BulletList
          items={[
            <><Strong>Auskunft</Strong> über deine Daten (Art. 15 DSGVO),</>,
            <><Strong>Berichtigung</Strong> (Art. 16), <Strong>Löschung</Strong> (Art. 17) und <Strong>Einschränkung</Strong> der Verarbeitung (Art. 18),</>,
            <><Strong>Datenübertragbarkeit</Strong> (Art. 20),</>,
            <><Strong>Widerspruch</Strong> gegen Verarbeitungen, die auf berechtigten Interessen beruhen (Art. 21). Das gilt zum Beispiel für Fehlerberichte, aber auch, wenn du nicht willst, dass deine Rückennummer als Torschütze erscheint. Fehlerberichte schaltest du selbst in den Einstellungen ab.</>,
          ]}
        />
        <Paragraph>
          Schreib dazu an <Betreiberemail />. Bei Turnierdaten kannst du dich auch direkt an den Veranstalter wenden.
        </Paragraph>
        <Paragraph>
          <Strong>Beschwerde:</Strong> Du kannst dich bei einer Datenschutz-Aufsichtsbehörde beschweren (Art. 77 DSGVO). Für mich zuständig ist:
          <br />
          {behoerde.name}, {behoerde.address}, <ExternalLink href={behoerde.url}>{behoerde.url}</ExternalLink>
        </Paragraph>
      </Section>

      <Section number={14} title="Speichern auf deinem Gerät (§ 25 TDDDG)">
        <Paragraph>
          Die App ist eine „Progressive Web App“. Damit sie auch in der Halle ohne Netz läuft, legt sie Daten auf deinem Gerät ab. Alles
          Folgende ist <Strong>unbedingt erforderlich</Strong>, damit die App den Dienst bereitstellt, den du aufgerufen hast, oder wird
          nur auf deinen eigenen Wunsch gesetzt. Deshalb brauche ich keine Einwilligung (§ 25 Abs. 2 Nr. 2 TDDDG). Es gibt keine Cookies
          zu Werbe- oder Analysezwecken.
        </Paragraph>
        <DataTable headers={['Eintrag', 'Wo', 'Wofür']} rows={GERAETESPEICHER} />
        <Paragraph>
          Du kannst alles jederzeit in den Browser-Einstellungen löschen („Websitedaten löschen“). Angemeldete Geräte müssen sich danach
          neu anmelden, und nicht synchronisierte Eingaben können verloren gehen.
        </Paragraph>
      </Section>

      <Section number={15} title="Änderungen">
        <Paragraph>
          Wenn sich die App ändert, passe ich diese Erklärung an. Für alles, was eine Einwilligung braucht, würde die App vorher fragen.
          Das würde nie den Zugang zur Zuschauer-Seite sperren.
        </Paragraph>
      </Section>
    </>
  );
}
