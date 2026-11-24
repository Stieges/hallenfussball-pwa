/**
 * @FU-134 (Verwaltung › Metadaten): eine angefangene Eingabe übersteht die Änderung eines anderen Geräts.
 * Szenariogrundriss „Eine angefangene Eingabe übersteht die Änderung eines anderen Geräts“, Formular „der Verwaltung › Metadaten“,
 * mit @FU-108 (Konflikt im selben Feld: kein stilles Überschreiben) – docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('../../../../auth/hooks/useCan', () => ({ useCan: () => true }));
vi.mock('../../../../../hooks/useTournaments', () => ({ useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()), tournaments: [] }) }));
vi.mock('../../../../../hooks/useTournamentStartState', () => ({ useTournamentStartState: () => ({ state: 'unknown' }) }));
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../../../types/tournament';
import { initRealDeI18n } from '../../../../../test/realDeI18n';
import { checkedVersion } from '../../../../../core/repositories/confirmedVersion';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

import { MetadataCategory } from '../index';

function turnier(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1', title: 'Live-Cup', status: 'published', version: 3, teams: [], matches: [],
    startDate: '2099-03-01', startTime: '10:00', date: '2099-03-01', timeSlot: '10:00',
    ageClass: 'U11', location: { name: 'Halle Süd', city: 'Musterstadt' }, ...overrides,
  } as unknown as Tournament;
}

const onTournamentUpdate = vi.fn();
function zeige(t: Tournament) {
  const view = render(<MetadataCategory tournamentId="t1" tournament={t} onTournamentUpdate={onTournamentUpdate} />);
  fireEvent.click(screen.getByText('Ort & Kontakt')); // Abschnitt ist zunächst eingeklappt
  fireEvent.click(screen.getByText('Private Notizen'));
  return (next: Tournament) => view.rerender(<MetadataCategory tournamentId="t1" tournament={next} onTournamentUpdate={onTournamentUpdate} />);
}
const ort = () => screen.getByLabelText<HTMLInputElement>(/^Veranstaltungsort/);
const notizen = () => screen.getByPlaceholderText<HTMLTextAreaElement>(/Notizen für dich selbst/);
const speichern = () => fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
const gespeichert = (): Tournament => onTournamentUpdate.mock.calls[0][0] as Tournament;

beforeEach(() => vi.clearAllMocks());

describe('@FU-134 Verwaltung › Metadaten: angefangene Eingabe übersteht die Änderung eines anderen Geräts', () => {
  it('Beispiel „die Telefonnummer“: Ollis Ort bleibt, sein Gerät zeigt Marias Nummer, sein Speichern sendet den Ort ohne die Nummer zu überschreiben', () => {
    const neuerStand = zeige(turnier({ contactInfo: { name: 'Olli', phone: '0170 111' } }));
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });

    neuerStand(turnier({ version: 4, contactInfo: { name: 'Olli', phone: '0170 222' } }));

    expect(ort().value).toBe('Ollis Halle');
    expect(screen.getByDisplayValue('0170 222')).toBeTruthy();
    speichern();
    expect(gespeichert().location.name).toBe('Ollis Halle');
    expect(gespeichert().contactInfo?.phone).toBe('0170 222');
    expect(checkedVersion(gespeichert())).toBe(4);
  });

  it('Beispiel „einen anderen Ort“: Ollis Speichern überschreibt Marias Ort nicht still (Basis bleibt der alte Stand, der Server lehnt ab, @FU-108)', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });

    neuerStand(turnier({ version: 4, location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    expect(ort().value).toBe('Ollis Halle');
    speichern();
    expect(gespeichert().location.name).toBe('Ollis Halle');
    expect(checkedVersion(gespeichert()), 'kein stilles Überschreiben').toBe(3);
  });

  it('Gegenbeispiel: nicht angefasste Angaben ziehen nach (Titel), der angefangene Ort bleibt, Basis ist der neue Stand', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });

    neuerStand(turnier({ version: 4, title: 'Live-Cup Ost' }));

    expect(screen.getByLabelText<HTMLInputElement>(/Turniername/).value).toBe('Live-Cup Ost');
    speichern();
    expect(gespeichert().title).toBe('Live-Cup Ost');
    expect(gespeichert().location.name).toBe('Ollis Halle');
    expect(checkedVersion(gespeichert())).toBe(4);
  });

  it('Private Notizen: angefangene Notiz bleibt bei fremdem Stand; unangefasste Notiz zieht nach', () => {
    const neuerStand = zeige(turnier({ adminNotes: 'alt' }));
    fireEvent.change(notizen(), { target: { value: 'Ollis Notiz' } });
    neuerStand(turnier({ version: 4, title: 'Live-Cup Ost', adminNotes: 'alt' }));
    expect(notizen().value).toBe('Ollis Notiz');

    neuerStand(turnier({ version: 5, title: 'Live-Cup Ost', adminNotes: 'alt' }));
    speichern();
    expect(gespeichert().adminNotes).toBe('Ollis Notiz');
    expect(checkedVersion(gespeichert())).toBe(5);
  });

  it('Private Notizen: unangefasst übernimmt die Notiz des anderen Geräts', () => {
    const neuerStand = zeige(turnier({ adminNotes: 'alt' }));
    neuerStand(turnier({ version: 4, adminNotes: 'neu von Maria' }));
    expect(notizen().value).toBe('neu von Maria');
  });

  it('Private Notizen: Konflikt in derselben Notiz überschreibt nicht still (Basis bleibt der alte Stand)', () => {
    const neuerStand = zeige(turnier({ adminNotes: 'alt' }));
    fireEvent.change(notizen(), { target: { value: 'Ollis Notiz' } });
    neuerStand(turnier({ version: 4, adminNotes: 'Marias Notiz' }));
    expect(notizen().value).toBe('Ollis Notiz');
    speichern();
    expect(checkedVersion(gespeichert())).toBe(3);
  });

  it('Turnierwechsel: das Formular zeigt den Stand des neuen Turniers', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle aus Turnier 1' } });
    neuerStand(turnier({ id: 't2', title: 'Anderes Turnier', version: 9, location: { name: 'Halle B' } }));
    expect(ort().value).toBe('Halle B');
  });
});
