/**
 * Admin Center, Meta-Daten: Stammdaten werden vor dem Speichern geprüft (C-META-NOVALID).
 * @W5-002: leerer Turniername -> Fehler am Feld, nichts wird gespeichert.
 * @W5-003: liegt der Turniertag in der Vergangenheit, wird die Korrektur von Ort oder Schreibweise trotzdem
 * gespeichert. Szenarien aus docs/anforderungen/2026-09-27_wizard-nach-dem-anlegen.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { initRealDeI18n } from '../../../../../test/realDeI18n';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { MetadataCategory } from '../index';

function turnier(startDate: string): Tournament {
  return {
    id: 't1', title: 'Hallencup Nord', status: 'published', teams: [], matches: [],
    startDate, startTime: '10:00', date: startDate, timeSlot: '10:00', ageClass: 'U11',
    location: { name: 'Halle Süd' },
  } as unknown as Tournament;
}

function zeige(t: Tournament) {
  const onTournamentUpdate = vi.fn();
  render(<MetadataCategory tournamentId="t1" tournament={t} onTournamentUpdate={onTournamentUpdate} />);
  fireEvent.click(screen.getByText('Datum & Zeit')); // Abschnitt ist zunächst eingeklappt
  return onTournamentUpdate;
}

const feld = (name: RegExp) => screen.getByLabelText(name);
const speichern = () => fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));

beforeEach(() => vi.clearAllMocks());

describe('Meta-Daten speichern prüft die Stammdaten (C-META-NOVALID)', () => {
  it('@W5-002 leerer Turniername: Fehler am Feld, es wird nicht gespeichert', () => {
    const speicher = zeige(turnier('2099-03-01'));
    fireEvent.change(feld(/Turniername/), { target: { value: '' } });
    speichern();
    expect(speicher).not.toHaveBeenCalled();
    const meldung = screen.getByRole('alert');
    expect(meldung.textContent).toMatch(/Turniername/);
    expect(feld(/Turniername/).getAttribute('aria-describedby')).toBe(meldung.id);
  });

  it('@W5-002 nur Leerzeichen als Turniername zählt als leer', () => {
    const speicher = zeige(turnier('2099-03-01'));
    fireEvent.change(feld(/Turniername/), { target: { value: '   ' } });
    speichern();
    expect(speicher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('C-META-NOVALID leeres Startdatum: Fehler am Feld, es wird nicht gespeichert', () => {
    const speicher = zeige(turnier('2099-03-01'));
    fireEvent.change(feld(/Startdatum/), { target: { value: '' } });
    speichern();
    expect(speicher).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/datum/i);
  });

  it('@W5-002 Gegenbeispiel: gültiger neuer Name wird gespeichert, ohne Fehlermeldung', () => {
    const speicher = zeige(turnier('2099-03-01'));
    fireEvent.change(feld(/Turniername/), { target: { value: 'Hallencup Nord 2' } });
    speichern();
    expect(speicher).toHaveBeenCalledTimes(1);
    expect((speicher.mock.calls[0][0] as Tournament).title).toBe('Hallencup Nord 2');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('@W5-002 nach dem Fehler löscht Tippen im Feld die Meldung, und Speichern gelingt', () => {
    const speicher = zeige(turnier('2099-03-01'));
    fireEvent.change(feld(/Turniername/), { target: { value: '' } });
    speichern();
    fireEvent.change(feld(/Turniername/), { target: { value: 'Neu' } });
    expect(screen.queryByRole('alert')).toBeNull();
    speichern();
    expect(speicher).toHaveBeenCalledTimes(1);
  });

  it('@W5-003 Turniertag liegt in der Vergangenheit: die Korrektur der Schreibweise wird gespeichert', () => {
    const speicher = zeige(turnier('2020-01-11'));
    fireEvent.change(feld(/Turniername/), { target: { value: 'Hallencup Nord (korrigiert)' } });
    speichern();
    expect(speicher).toHaveBeenCalledTimes(1);
    const gespeichert = speicher.mock.calls[0][0] as Tournament;
    expect(gespeichert.title).toBe('Hallencup Nord (korrigiert)');
    expect(gespeichert.startDate).toBe('2020-01-11');
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
