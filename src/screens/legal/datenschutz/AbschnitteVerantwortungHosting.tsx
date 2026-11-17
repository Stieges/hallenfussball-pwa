/**
 * Datenschutzerklärung, Abschnitte 1 bis 4: Verantwortliche, Überblick, Hosting, Zuschauer-Seite.
 * Text aus der freigegebenen Endfassung (@RE-004).
 */
import { Section, Paragraph, Strong, BulletList } from '../DatenschutzSections';
import { BetreiberAdresse } from '../BetreiberAngaben';

export function AbschnitteVerantwortungHosting() {
  return (
    <>
      <Section number={1} title="Wer ist verantwortlich?">
        <Paragraph>
          <Strong>Für die App selbst</Strong> (Konten, Betrieb, Hosting, Fehlerberichte) bin ich verantwortlich:
        </Paragraph>
        <BetreiberAdresse mitEmail />
        <Paragraph>Ich betreibe die App privat und ehrenamtlich, ohne Entgelt und ohne Werbung.</Paragraph>
        <Paragraph>
          <Strong>Für die Daten eines Turniers</Strong> (Mannschaften, Spielplan, Ergebnisse, Rückennummern, Helfer, Kontaktperson) ist der{' '}
          <Strong>Verein bzw. Veranstalter</Strong> verantwortlich, der das Turnier in der App anlegt. Er entscheidet, was eingetragen und
          veröffentlicht wird. Ich verarbeite diese Daten in seinem Auftrag und nach seinen Weisungen (Auftragsverarbeitung nach Art. 28
          DSGVO). Wer wissen will, welcher Verein ein Turnier veranstaltet, findet das auf der Turnierseite oder erfährt es bei der
          Turnierleitung.
        </Paragraph>
        <Paragraph>
          Du kannst dich mit allen Fragen zum Datenschutz zuerst an mich wenden (E-Mail oben). Fragen zu Turnierdaten gebe ich an den
          Veranstalter weiter oder beantworte sie in seinem Auftrag.
        </Paragraph>
        <Paragraph>Einen Datenschutzbeauftragten habe ich nicht benannt. Das ist für mich nicht vorgeschrieben.</Paragraph>
      </Section>

      <Section number={2} title="Das Wichtigste in Kürze">
        <BulletList
          items={[
            <><Strong>Zuschauer</Strong> brauchen kein Konto. Ich speichere über dich keinen Namen und kein Konto. Technisch fallen nur die Angaben aus Abschnitt 3 an. Dein Gerät merkt sich nur, was du selbst auswählst („Mein Team“), und den letzten Spielstand für den Fall, dass das Netz ausfällt.</>,
            <><Strong>Turnierleitung und Co-Admins</Strong> haben ein Konto mit E-Mail-Adresse.</>,
            <><Strong>Helfer</Strong> melden sich ohne Konto mit einem selbst gewählten Namen an.</>,
            <>Von <Strong>Spielerinnen und Spielern</Strong> speichert die App <Strong>keine Namen</Strong>. Es gibt nur die <Strong>Rückennummer</Strong> bei Toren, Karten, Zeitstrafen und Strafstößen.</>,
            <>Es gibt <Strong>keine Werbung, kein Tracking und keine Aufzeichnung deiner Sitzung</Strong>. Die Zuschauer-Seite wird nur als Summe gezählt, ohne dich wiederzuerkennen (Abschnitt 4).</>,
            <>Die App lädt <Strong>keine Schriften und keine Skripte von Google</Strong>. Alle Schriften liegen bei der App selbst.</>,
            <>Die Datenbank liegt auf Servern in der <Strong>EU (Frankfurt am Main)</Strong>.</>,
          ]}
        />
      </Section>

      <Section number={3} title="Aufruf der App (Hosting)">
        <Paragraph>
          Wenn du die App aufrufst, schickt dein Browser technisch nötige Angaben an den Server: IP-Adresse, Datum und Uhrzeit,
          aufgerufene Adresse, Browser und Betriebssystem. Daraus entstehen kurzlebige Protokolle beim Hosting-Anbieter.
        </Paragraph>
        <BulletList
          items={[
            'Anbieter: Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA',
            'Zweck: App ausliefern, Angriffe und Störungen erkennen',
            'Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einem sicheren und funktionierenden Angebot)',
            'Drittland: Vercel ist ein US-Unternehmen. Es ist nach dem EU-US Data Privacy Framework zertifiziert (Angemessenheitsbeschluss der EU-Kommission vom 10.07.2023). Wo nötig, verwendet Vercel zusätzlich Standardvertragsklauseln der EU-Kommission. Die App-Dateien werden über das weltweite Auslieferungsnetz von Vercel bereitgestellt, also von einem Standort in deiner Nähe.',
            'Vertrag: Ich nutze Vercel im kostenlosen Tarif. Einen gesonderten Vertrag zur Auftragsverarbeitung mit Vercel sage ich dafür nicht zu; es gelten die Nutzungsbedingungen und die Datenschutzerklärung von Vercel.',
            'Speicherdauer: Die Protokolle werden nur kurz nach den Vorgaben von Vercel aufbewahrt.',
          ]}
        />
      </Section>

      <Section number={4} title="Zuschauer-Seite (per QR-Code oder Link)">
        <Paragraph>
          Die Zuschauer-Seite zeigt Spielplan, Ergebnisse und Tabellen eines Turniers. Du brauchst dafür kein Konto und musst nichts
          bestätigen.
        </Paragraph>
        <BulletList
          items={[
            'Ich erfahre über dich nur die technischen Angaben aus Abschnitt 3 und die Abrufe bei der Datenbank (Abschnitt 9).',
            <>Angezeigt werden: Turniername, Datum, Halle, Mannschaften mit Logo und Farben, Spiele und Ergebnisse. Bei jedem Spiel stehen außerdem Tore, Karten, Zeitstrafen und Strafstöße, <Strong>nur mit Mannschaft und Rückennummer</Strong> (nie mit Namen). Hat der Veranstalter eine Kontaktperson freigegeben, steht sie dabei. Bei Kinder- und Jugendturnieren kann die Turnierleitung den „Kindermodus“ einschalten. Dann werden keine Ergebnisse, Tabellen, Tore, Karten, Zeitstrafen und Strafstöße gezeigt. Ist es für ein Turnier freigegeben, steht zusätzlich eine Torschützen-Liste da (zwischendurch aus den bisherigen Toren, laufende Spiele nur, wenn der Live-Spielstand öffentlich ist, und im Endstand), ebenfalls nur mit Mannschaft und Rückennummer; im Kindermodus erscheint sie nie.</>,
            'Wer einen Eintrag eingegeben hat, siehst du als Zuschauer nie.',
            'Auf deinem Gerät wird gespeichert, was in Abschnitt 14 steht. Für die Zuschauer-Seite sind das deine Auswahl „Mein Team“, der zuletzt geladene Turnierstand und der Zwischenspeicher der App.',
          ]}
        />
        <Paragraph>
          <Strong>Zählung:</Strong> Ich zähle, wie oft die Zuschauer-Seite geöffnet wird und wie lange sie offen bleibt, nur als Summe. Es gibt dabei keine
          IP-Adresse, kein Cookie und keine Kennung. Die Einzelheiten:
        </Paragraph>
        <BulletList
          items={[
            'Was gezählt wird: Der Server zählt, wie oft die Zuschauer-Seite eines öffentlichen Turniers geöffnet wird, und solange die Seite sichtbar ist, einmal pro Minute ein Lebenszeichen. Gespeichert wird nur eine Summe je Turnier und 5-Minuten-Fenster, aufgeteilt nach Zugangsweg (QR-Code, Link oder direkt), Geräteklasse (Handy, Tablet oder großer Bildschirm), „als App vom Startbildschirm geöffnet: ja oder nein“ sowie Betriebssystem- und Browser-Familie (zum Beispiel „ios“ und „safari“, nie eine Versionsnummer). Es gibt keine Zeile je Besucher, keine IP-Adresse und keine Kennung deines Geräts in dieser Zählung; ich kann dich daran nicht wiedererkennen.',
            'Was die Seite dafür auf deinem Gerät liest: nur die Bildschirmgröße, die Bedienart (Finger oder Maus) und ob sie als App geöffnet wurde. Daraus leitet sie die Geräteklasse ab; diese Werte selbst verlassen das Gerät nicht. Betriebssystem und Browser leitet der Server aus der Kennung ab, die dein Browser bei jedem Aufruf ohnehin mitschickt. Auf deinem Gerät wird dafür nichts gespeichert: kein Cookie, kein lokaler Speicher, keine Kennung. Dass ein Aufruf nur einmal gezählt wird, merkt sich die geöffnete Seite nur im Arbeitsspeicher, bis du sie schließt. Ein Zusatz wie „?k=q“ im Link (er sagt nur, ob du per QR-Code oder Link kamst) wird gelesen und danach aus der Adresszeile entfernt.',
            'Zweck der Zählung: Ich will wissen, wie viele Menschen die Zuschauer-Seite nutzen und auf welchem Weg sie sie erreichen. Die Zahlen sind in der App nicht sichtbar; nur ich lese sie direkt in der Datenbank. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Auswertung der Nutzung). Gezählt wird nur die öffentliche Zuschauer-Seite, nicht der Hallenmonitor, das Cockpit oder die Verwaltung. Die Summen werden gelöscht, wenn ich das Turnier endgültig lösche (spätestens nach 6 Monaten, Abschnitt 11).',
          ]}
        />
      </Section>
    </>
  );
}
