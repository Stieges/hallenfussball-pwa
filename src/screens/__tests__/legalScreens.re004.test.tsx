/**
 * @RE-004 Impressum und Datenschutzerklärung tragen die Angaben des Betreibers aus der einen Stelle (src/config/legal.ts).
 * @RE-001 (Teil): beide Seiten verlinken ohne Anmeldung aufeinander bzw. sind vollständig lesbar.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const { konfig } = vi.hoisted(() => ({
  konfig: {
    name: 'Erika Mustermann', careOf: 'c/o Sportverein Musterstadt', street: 'Hauptstraße 1', city: '12345 Musterstadt',
    email: 'erika@example.org', supervisoryAuthority: { name: 'Bayerisches Landesamt für Datenschutzaufsicht (BayLDA)', address: 'Promenade 18, 91522 Ansbach', url: 'https://www.lda.bayern.de' },
    lastUpdated: 'November 2026',
  },
}));
vi.mock('../../config/legal', async (original) => ({ ...(await original<typeof import('../../config/legal')>()), LEGAL_CONFIG: konfig }));

import { ImpressumScreen } from '../ImpressumScreen';
import { DatenschutzScreen } from '../DatenschutzScreen';

const mitRouter = (seite: React.ReactElement) => render(<MemoryRouter>{seite}</MemoryRouter>);

describe('@RE-004 Betreiberangaben im Impressum', () => {
  it('zeigt Name, c/o, Straße, Ort, Land und E-Mail aus der Konfiguration', () => {
    const { container } = mitRouter(<ImpressumScreen onBack={vi.fn()} />);
    const text = container.textContent ?? '';
    for (const wert of ['Erika Mustermann', 'c/o Sportverein Musterstadt', 'Hauptstraße 1', '12345 Musterstadt', 'Deutschland', 'erika@example.org']) {
      expect(text).toContain(wert);
    }
    expect(container.querySelectorAll('[data-testid="betreiber-adresse"] br')).toHaveLength(4);
  });

  it('Überschriften und Text der Endfassung', () => {
    mitRouter(<ImpressumScreen onBack={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Impressum' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Angaben gemäß § 5 DDG und § 18 Abs. 1 MStV' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kontakt' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Zu dieser App' })).toBeInTheDocument();
    expect(screen.getByText(/Es wird ohne Entgelt und ohne Werbung angeboten\./)).toBeInTheDocument();
    expect(screen.getByTestId('legal-stand')).toHaveTextContent('Stand: November 2026');
  });

  it('verlinkt auf die Datenschutzerklärung', () => {
    mitRouter(<ImpressumScreen onBack={vi.fn()} />);
    expect(screen.getByTestId('impressum-datenschutz-link')).toHaveAttribute('href', '/datenschutz');
  });

  it('Gegenbeispiel: ohne c/o-Angabe entfällt die Zeile', () => {
    const vorher = konfig.careOf;
    konfig.careOf = '';
    try {
      const { container } = mitRouter(<ImpressumScreen onBack={vi.fn()} />);
      expect(container.textContent).not.toContain('c/o');
      // Name, Straße, Ort, Land = vier Zeilen, drei Umbrüche; mit c/o wären es vier (leere Zeile bliebe sichtbar)
      expect(container.querySelectorAll('[data-testid="betreiber-adresse"] br')).toHaveLength(3);
    } finally {
      konfig.careOf = vorher;
    }
  });

  it('keine alten Angaben mehr: keine Telefonnummer, keine USt-IdNr., kein Register, keine Streitschlichtungsplattform', () => {
    const { container } = mitRouter(<ImpressumScreen onBack={vi.fn()} />);
    expect(container.textContent).not.toMatch(/Telefon|Umsatzsteuer|Handelsregister|Streitschlichtung|PLATZHALTER/);
  });
});

describe('@RE-004 Betreiberangaben in der Datenschutzerklärung', () => {
  it('zeigt dieselben Angaben im Abschnitt „Wer ist verantwortlich?“ und als Kontakt bei den Rechten', () => {
    mitRouter(<DatenschutzScreen onBack={vi.fn()} />);
    const abschnitt1 = screen.getByTestId('datenschutz-section-1').textContent ?? '';
    for (const wert of ['Erika Mustermann', 'c/o Sportverein Musterstadt', 'Hauptstraße 1', '12345 Musterstadt', 'erika@example.org']) {
      expect(abschnitt1).toContain(wert);
    }
    expect(screen.getByTestId('datenschutz-section-13').textContent).toContain('Schreib dazu an erika@example.org');
  });

  it('alle 15 Abschnitte der Endfassung sind da, in dieser Reihenfolge', () => {
    mitRouter(<DatenschutzScreen onBack={vi.fn()} />);
    const titel = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titel).toEqual([
      '1. Wer ist verantwortlich?', '2. Das Wichtigste in Kürze', '3. Aufruf der App (Hosting)', '4. Zuschauer-Seite (per QR-Code oder Link)',
      '5. Konto für Turnierleitung und Co-Admins', '6. Helfer am Turniertag', '7. Turnierdaten (Mannschaften, Spiele, Ergebnisse)', '8. Hallenmonitore und Hallen-Lautsprecher',
      '9. Datenbank und Anmeldung (Supabase)', '10. Fehlerberichte (Sentry)', '11. Wie lange Daten gespeichert werden', '12. Kinder und Jugendliche',
      '13. Deine Rechte', '14. Speichern auf deinem Gerät (§ 25 TDDDG)', '15. Änderungen',
    ]);
  });

  it('die Erklärung sagt, was gilt: keine Sitzungsaufzeichnung, keine Schriften von Google, Fehlerberichte abschaltbar', () => {
    const { container } = mitRouter(<DatenschutzScreen onBack={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).toContain('keine Aufzeichnung deiner Sitzung');
    expect(text).toContain('keine Schriften und keine Skripte von Google');
    expect(text).toContain('Du kannst Fehlerberichte jederzeit in den Einstellungen der App abschalten');
    expect(text).not.toMatch(/PLATZHALTER|Einwilligung des Nutzers/);
  });

  it('Aufsichtsbehörde kommt aus der Konfiguration und ist verlinkt', () => {
    mitRouter(<DatenschutzScreen onBack={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'https://www.lda.bayern.de' })).toHaveAttribute('href', 'https://www.lda.bayern.de');
  });
});

describe('@RE-004 Datenschutzerklärung sagt, was die App wirklich tut (Prüfung vom 14.11., Befunde 7, 8, 9, 10, 11, 16, 17, 18, 20)', () => {
  const abschnitt = (nr: number) => {
    mitRouter(<DatenschutzScreen onBack={vi.fn()} />);
    return screen.getByTestId(`datenschutz-section-${nr}`).textContent ?? '';
  };

  it('Zuschauer-Zählung (Abschnitt 4): nur Summen, ohne Wiedererkennung, Familien statt Kennung, Rechtsgrundlage, Löschung mit dem Turnier', () => {
    const text = abschnitt(4);
    expect(text).toContain('Gespeichert wird nur eine Summe je Turnier und 5-Minuten-Fenster');
    expect(text).toContain('Betriebssystem- und Browser-Familie');
    expect(text).toContain('nie eine Versionsnummer');
    expect(text).toContain('Gespeichert wird dabei keine IP-Adresse, kein Cookie und keine Gerätekennung; die Browserkennung (User-Agent) liest der Server nur');
    expect(text).not.toContain('Es gibt dabei keine IP-Adresse, kein Cookie und keine Kennung');
    expect(text).toContain('keine IP-Adresse und keine Kennung deines Geräts in dieser Zählung; ich kann dich daran nicht wiedererkennen');
    expect(text).toContain('die Bildschirmgröße, die Bedienart (Finger oder Maus) und ob sie als App geöffnet wurde');
    expect(text).toContain('Auf deinem Gerät wird dafür nichts gespeichert: kein Cookie, kein lokaler Speicher, keine Kennung');
    expect(text).not.toContain('nichts aus dem Speicher des Geräts gelesen');
    expect(text).toContain('liest: nur die Bildschirmgröße, die Bedienart (Finger oder Maus) und ob sie als App geöffnet wurde');
    expect(text).toContain('nur im Arbeitsspeicher');
    expect(text).toContain('Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO');
    expect(text).toContain('Die Summen werden gelöscht, wenn ich das Turnier endgültig lösche (spätestens nach 6 Monaten, Abschnitt 11)');
  });

  it('Gegenbeispiel: „keine Reichweitenmessung“ steht nicht mehr da, und „keine Kennung“ wird nicht mehr pauschal versprochen', () => {
    const { container } = mitRouter(<DatenschutzScreen onBack={vi.fn()} />);
    const text = container.textContent ?? '';
    expect(text).not.toContain('keine Reichweitenmessung');
    expect(text).not.toContain('keinen Namen und keine Kennung');
    expect(screen.getByTestId('datenschutz-section-2').textContent).toContain('keinen Namen und kein Konto. Technisch fallen nur die Angaben aus Abschnitt 3 an.');
  });

  it('Hallenton (Abschnitt 8): was gespeichert wird, öffentliche Tondatei, Mikrofon-Satz', () => {
    const text = abschnitt(8);
    expect(text).toContain('Hallen-Lautsprecher (Hallenton)');
    expect(text).toContain('der Name, den die Turnierleitung dem Gerät gibt');
    expect(text).toContain('für jeden abrufbar, der die lange, nicht erratbare Adresse der Datei kennt');
    expect(text).toContain('fragt dein Browser einmal nach dem Mikrofon. Die App nimmt nichts auf. Sie gibt das Mikrofon sofort wieder frei und liest nur die Namen der Audio-Ausgänge');
    expect(text).toContain('Die Namen bleiben auf deinem Gerät und werden nicht an einen Server gesendet');
  });

  it('Schiedsrichter und Helfer-Sicht (Abschnitte 6 und 7)', () => {
    expect(abschnitt(7)).toContain('Auf den Hallenmonitoren erscheinen sie nur, wenn die Turnierleitung das einstellt; auf der Zuschauer-Seite nie.');
    expect(screen.getByTestId('datenschutz-section-7').textContent).toContain('Schreib dort nichts hinein, was Helfer nicht lesen sollen');
    expect(screen.getByTestId('datenschutz-section-6').textContent).toContain('interne Notizen und die Namen der Schiedsrichter');
  });

  it('Supabase in Singapur (Abschnitt 9)', () => {
    const text9 = abschnitt(9);
    expect(text9).toContain('Mein Vertragspartner ist Supabase Pte. Ltd. mit Sitz in Singapur; die Daten selbst liegen in Frankfurt');
    expect(text9).toContain('Für Singapur gibt es keinen Angemessenheitsbeschluss der EU-Kommission');
    expect(text9).not.toContain('Er wird mit den Nutzungsbedingungen von Supabase angenommen');
  });

  it('Art. 13 Abs. 2 e und f und Widerspruchsrecht (Abschnitt 13)', () => {
    const text = abschnitt(13);
    expect(text).toContain('Dein Widerspruchsrecht:');
    expect(text).toContain('Musst du Daten angeben?');
    expect(text).toContain('Die App trifft keine automatisierten Entscheidungen über dich und bildet keine Profile.');
  });

  it('Speicherdauer und Gerätespeicher stimmen mit der App überein (Abschnitte 11, 14, 6, 10)', () => {
    expect(abschnitt(11)).toContain('beim nächsten Öffnen der Zuschauer-Seite gelöscht');
    expect(screen.getByTestId('datenschutz-section-11').textContent).toContain('Zahlen der Zuschauer-Zählung (nur Summen) und Daten des Hallen-Lautsprechers');
    expect(screen.getByTestId('datenschutz-section-11').textContent).not.toContain('nur bis zum Ende des Turniertags');
    expect(screen.getByTestId('datenschutz-section-14').textContent).toContain('Hallen-Lautsprecher (nur am Lautsprecher-Gerät): zugeordnete Spielfelder, Gerätename');
    const s14 = screen.getByTestId('datenschutz-section-14').textContent ?? '';
    expect(s14).toContain('Nur gelesen, nicht gespeichert:');
    expect(s14).toContain('Start-Bericht an Sentry (Abschnitt 10)');
    expect(s14).toContain('die Bildschirmgröße, die Bedienart (Finger oder Maus) und ob die Seite als App geöffnet wurde');
    expect(s14).toContain('in der folgenden Tabelle ist unbedingt erforderlich');
    expect(s14).toContain('liest die App erst, wenn du dort selbst die Auswahl der Ausgänge öffnest');
    expect(s14).toContain('prüft die App ihn danach beim Start und immer dann, wenn ein Gerät an- oder abgesteckt wird');
    expect(s14).not.toContain('nachdem du dort selbst einen Ausgang gewählt hast');
    expect(s14).toContain('Gelesen wird bei jedem Start, gesendet wird nur, solange Fehlerberichte eingeschaltet sind.');
    expect(s14).not.toContain('das hört auf, wenn du Fehlerberichte abschaltest');
    expect(s14).toContain('Zustand des Service Workers samt der Adresse seines Skripts');
    for (const eintrag of ['Zeitstempel „Ausgang prüfen“', 'Cockpit: Ton an oder aus und Lautstärke', 'gewählter Audio-Ausgang (Kennung und Name)', 'Lautstärke je Ton', 'Kennungen schon gespielter Testtöne']) {
      expect(s14).toContain(eintrag);
    }
    const s15 = screen.getByTestId('datenschutz-section-15').textContent ?? '';
    expect(s15).toContain('Derzeit holt die App keine Einwilligung ein; was sie auf deinem Gerät speichert und liest, steht in Abschnitt 14.');
    expect(s15).not.toContain('Für alles, was eine Einwilligung braucht');
    const s10 = screen.getByTestId('datenschutz-section-10').textContent ?? '';
    expect(s10.split('einen kurzen Start-Bericht')).toHaveLength(2); // genau einmal genannt
    expect(s10).toContain('Zustand des Service Workers samt der Adresse seines Skripts und die Namen');
    expect(s10).toContain('Außerdem sendet die App bei jedem Start einmal einen kurzen Start-Bericht: App-Version, ob das Gerät online ist, Zustand des Service Workers samt der Adresse seines Skripts und die Namen der Zwischenspeicher und Datenbanken der App (keine Inhalte). Damit erkenne ich Ladeprobleme bei schlechtem Netz in der Halle.');
    expect(screen.getByTestId('datenschutz-section-6').textContent).toContain('der Gerätetyp (Handy, Tablet oder Computer');
    expect(screen.getByTestId('datenschutz-section-6').textContent).not.toContain('iPhone');
    expect(screen.getByTestId('datenschutz-section-10').textContent).toContain('die Kennung des Kontos (eine zufällige Zeichenfolge, keine E-Mail, kein Name)');
  });

  it('Vercel im kostenlosen Tarif: kein Vertrag zur Auftragsverarbeitung zugesagt (Abschnitt 3), Torschützen-Zwischenstand genau beschrieben (Abschnitt 4)', () => {
    const text3 = abschnitt(3);
    expect(text3).toContain('Ich nutze Vercel im kostenlosen Tarif. Einen gesonderten Vertrag zur Auftragsverarbeitung mit Vercel sage ich dafür nicht zu');
    expect(screen.getByTestId('datenschutz-section-4').textContent).toContain('laufende Spiele nur, wenn der Live-Spielstand öffentlich ist');
    expect(screen.getByTestId('datenschutz-section-8').textContent).toContain('werden gelöscht, wenn ich das Turnier endgültig lösche (spätestens nach 6 Monaten, Abschnitt 11)');
    const s9 = screen.getByTestId('datenschutz-section-9').textContent ?? '';
    expect(s9).toContain('Die Daten aus den Abschnitten 4 bis 8 liegen bei Supabase');
    expect(s9).toContain('die Tondateien des Hallen-Lautsprechers im Dateispeicher desselben Dienstes');
    expect(s9).toContain('Nur auf deinem Gerät bleiben die Namen der Audio-Ausgänge und die Einträge aus Abschnitt 14');
    expect(s9).not.toContain('Alle Daten aus den Abschnitten 4 bis 8');
  });
});
