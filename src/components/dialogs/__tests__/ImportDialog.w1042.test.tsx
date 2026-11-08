/**
 * @W1-042 Der Import-Dialog zeigt „Datum fehlt“ bzw. „Startzeit fehlt“ als Fehler im Auswahl-Schritt – nie als Erfolg,
 * ohne Vorschau und ohne Speichern (Befund C-IMPORT-PFLICHTFELDER-STILL; Gegenstück zu @W1-041).
 * Echter Importer; Texte kommen als Schlüssel (Test-i18n), die Wortlaute DE/EN prüft der JSON-Test unten.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import deDashboard from '../../../i18n/locales/de/dashboard.json';
import enDashboard from '../../../i18n/locales/en/dashboard.json';
import { ImportDialog } from '../ImportDialog';

const teams = [{ id: 't1', name: 'TSV Waging rot' }, { id: 't2', name: 'DJK Kammer' }];

async function waehle(user: ReturnType<typeof userEvent.setup>, inhalt: object) {
  const datei = new File([JSON.stringify(inhalt)], 'f2.json', { type: 'application/json' });
  await user.upload(screen.getByTestId('import-file-input'), datei);
}

describe('@W1-042 Import-Dialog meldet fehlendes Datum oder Startzeit als Fehler', () => {
  it.each([
    { feld: 'Datum', datei: { title: 'F2', startTime: '09:30', teams }, schluessel: 'dashboard:import.errors.missingDate' },
    { feld: 'Startzeit', datei: { title: 'F2', date: '2026-11-28', teams }, schluessel: 'dashboard:import.errors.missingStartTime' },
  ])('$feld fehlt: Fehler im Auswahl-Schritt, keine Vorschau, nichts gespeichert', async ({ datei, schluessel }) => {
    const user = userEvent.setup();
    const onImport = vi.fn(() => Promise.resolve());
    render(<ImportDialog isOpen onClose={vi.fn()} onImport={onImport} onContinue={vi.fn()} />);

    await waehle(user, datei);

    expect((await screen.findByTestId('import-error')).textContent).toBe(schluessel);
    expect(screen.queryByTestId('import-confirm')).toBeNull();
    expect(screen.queryByTestId('import-success-go')).toBeNull();
    expect(onImport).not.toHaveBeenCalled();
  });

  it('beide fehlen: beide Meldungen stehen im Fehler', async () => {
    const user = userEvent.setup();
    render(<ImportDialog isOpen onClose={vi.fn()} onImport={vi.fn(() => Promise.resolve())} onContinue={vi.fn()} />);

    await waehle(user, { title: 'F2', teams });

    const text = (await screen.findByTestId('import-error')).textContent ?? '';
    expect(text).toContain('dashboard:import.errors.missingDate');
    expect(text).toContain('dashboard:import.errors.missingStartTime');
  });
});

describe('@W1-042 Wortlaute in beiden Sprachen', () => {
  it('Deutsch: wie im Szenario', () => {
    expect(deDashboard.import.errors.missingDate).toBe('In der Datei fehlt das Turnierdatum');
    expect(deDashboard.import.errors.missingStartTime).toBe('In der Datei fehlt die Startzeit des Turniers');
  });

  it('Englisch: vorhanden und nicht leer', () => {
    expect(enDashboard.import.errors.missingDate.length).toBeGreaterThan(0);
    expect(enDashboard.import.errors.missingStartTime.length).toBeGreaterThan(0);
    expect(enDashboard.import.errors.missingDate).not.toBe(deDashboard.import.errors.missingDate);
  });
});
