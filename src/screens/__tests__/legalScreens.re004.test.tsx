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
      '5. Konto für Turnierleitung und Co-Admins', '6. Helfer am Turniertag', '7. Turnierdaten (Mannschaften, Spiele, Ergebnisse)', '8. Hallenmonitore',
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
