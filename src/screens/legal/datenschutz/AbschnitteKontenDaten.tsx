/**
 * Datenschutzerklärung, Abschnitte 5 bis 9: Konto, Helfer, Turnierdaten, Hallenmonitore, Datenbank (Supabase).
 * Text aus der freigegebenen Endfassung (@RE-004).
 */
import { Section, Paragraph, Strong, BulletList, ExternalLink } from '../DatenschutzSections';

export function AbschnitteKontenDaten() {
  return (
    <>
      <Section number={5} title="Konto für Turnierleitung und Co-Admins">
        <BulletList
          items={[
            'Daten: E-Mail-Adresse, Passwort (nur als Prüfwert, nicht lesbar), Anzeigename, Rolle, Einstellungen, Zeitpunkte von Anmeldung und Änderungen. Bei Co-Admins zusätzlich: wer sie eingeladen hat, die Einladungs-E-Mail und wann sie die Einladung angenommen haben.',
            'Anmeldung per Passwort, per E-Mail-Link oder per Google.',
            <><Strong>Anmeldung mit Google (freiwillig):</Strong> Wenn du „Mit Google anmelden“ wählst, öffnet sich die Anmeldeseite von Google. Google gibt der App deine E-Mail-Adresse, deinen Namen und ggf. die Adresse deines Profilbilds. Das Profilbild lädt dein Browser dann direkt von Google. Für die Anmeldung bei Google ist Google selbst verantwortlich: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland. Es gilt die Datenschutzerklärung von Google (<ExternalLink href="https://policies.google.com/privacy">policies.google.com/privacy</ExternalLink>). Dort steht auch, wie Google Daten in Drittländer übermittelt. Wenn du Google nicht nutzen willst, melde dich mit E-Mail und Passwort oder E-Mail-Link an.</>,
            'E-Mails zur Bestätigung, für den Anmeldelink und zum Zurücksetzen des Passworts werden über den Anmeldedienst von Supabase (Abschnitt 9) verschickt. Dabei erhält der Versanddienst deine E-Mail-Adresse und den Inhalt der Nachricht.',
            'Zweck: dir die Verwaltung deiner Turniere ermöglichen',
            'Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (Nutzung des Dienstes, den du angefordert hast)',
            'Speicherdauer: bis du die Löschung verlangst (E-Mail an mich). Dann lösche ich das Konto.',
          ]}
        />
      </Section>

      <Section number={6} title="Helfer am Turniertag">
        <Paragraph>Helfer tragen Ergebnisse und Ereignisse an einem Spielfeld ein. Sie brauchen kein Konto.</Paragraph>
        <BulletList
          items={[
            <>Daten: der <Strong>Name, den du selbst eingibst</Strong> (am besten Vorname oder Kürzel), eine zufällige Gerätekennung, der Gerätetyp (z. B. „iPhone“, aus deinem Browser abgeleitet), wann du zuletzt aktiv warst, ob die Turnierleitung dich zugelassen hat, und welche Einträge (Tore, Karten …) von deinem Gerät kamen.</>,
            'Die Turnierleitung sieht deinen Namen und den Gerätetyp. Zuschauer sehen nie, wer etwas eingetragen hat.',
            'Zweck: geordnete Turnierdurchführung, Nachvollziehbarkeit von Einträgen',
            'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Veranstalters an einem korrekten Turnierablauf)',
            'Speicherdauer: siehe Abschnitt 11',
          ]}
        />
      </Section>

      <Section number={7} title="Turnierdaten (Mannschaften, Spiele, Ergebnisse)">
        <BulletList
          items={[
            <>Daten: Mannschaftsnamen, Logos und Farben, Spielplan, Ergebnisse, Tabellen, Ereignisse im Spiel (Tore, Karten, Zeitstrafen, Strafstöße) mit <Strong>Rückennummer</Strong>, Name und Anschrift der Halle, optional eine Kontaktperson des Veranstalters (Name, E-Mail, Telefon). <Strong>Namen von Spielerinnen und Spielern speichert die App nicht.</Strong></>,
            <>Teamlogos: Bitte nur Vereinswappen hochladen, <Strong>keine Fotos von Personen</Strong>. Die App nimmt selbst keine Fotos auf.</>,
            'Öffentlich sichtbar ist nur, was der Veranstalter freigibt (Abschnitt 4).',
            'Zweck: Turnier planen, durchführen und Ergebnisse bekanntgeben',
            'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse des Veranstalters an der Durchführung und Bekanntgabe des Turniers). Bei Vereinsmitgliedern ggf. Art. 6 Abs. 1 lit. b DSGVO (Mitgliedschaft).',
            'Verantwortlich ist hierfür der Veranstalter (Abschnitt 1).',
          ]}
        />
      </Section>

      <Section number={8} title="Hallenmonitore">
        <Paragraph>
          Ein Hallenmonitor zeigt Spielplan und Ergebnisse auf einem großen Bildschirm. Gespeichert werden die Kennung des Monitors, die
          Browserkennung des Geräts (User-Agent), wann er zuletzt Kontakt hatte, welche Folie lief und ob der Bildschirm wach gehalten
          wird. Das dient dazu, dass die Turnierleitung sieht, ob die Monitore laufen. Hinter einem Hallengerät steht in der Regel keine
          erkennbare Person. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. Speicherdauer: siehe Abschnitt 11.
        </Paragraph>
      </Section>

      <Section number={9} title="Datenbank und Anmeldung (Supabase)">
        <Paragraph>
          Alle Daten aus den Abschnitten 5 bis 8 liegen bei Supabase Pte. Ltd., 65 Chulia Street #38-02/03, OCBC Centre, Singapur 049513.
          Die Datenbank läuft in der <Strong>Region „Central EU (Frankfurt)“</Strong> (AWS eu-central-1).
        </Paragraph>
        <BulletList
          items={[
            'Mit Supabase gilt ein Vertrag zur Auftragsverarbeitung (Art. 28 DSGVO). Er wird mit den Nutzungsbedingungen von Supabase angenommen.',
            'Supabase kann für Betrieb und Support Unterauftragnehmer außerhalb der EU einsetzen (u. a. USA, Singapur). Dafür gelten die Standardvertragsklauseln der EU-Kommission.',
            'Supabase führt technische Protokolle (u. a. IP-Adresse bei Anmeldungen und Abrufen). Sie werden nur kurz nach den Vorgaben von Supabase aufbewahrt.',
            'Für die Anmeldung von Helfern erhält dein Gerät eine anonyme Gerätesitzung, ohne dass du ein Konto anlegst.',
          ]}
        />
      </Section>
    </>
  );
}
