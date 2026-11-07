/**
 * Verwaltung, Reiter Einstellungen: das Stammdaten-Formular und der Stand eines anderen Geräts (Befund
 * C-GERAET-FOLGT-WACKELT, Review #454). Szenarien: @FU-105 (Marias Tablet bleibt über fünf Änderungen von Olli auf dem
 * Stand des Servers), @FU-089 (Rückweg), @FU-108 (ein Konflikt wird nicht still überschrieben, sondern abgelehnt und
 * geklärt) – docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md.
 *
 * Konflikt je Angabe: Olli hat sie angefasst, das andere Gerät hat sie auch geändert, und beide Werte unterscheiden
 * sich. Dann bleibt Ollis Eingabe stehen, sein Speichern beruht aber weiter auf dem alten Stand – der Server lehnt es ab
 * („Turnier wurde inzwischen auf einem anderen Gerät geändert“, @FU-108), nichts wird still überschrieben.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';
import { rebaseMetaForm } from '../utils/metaFormRebase';
import { checkedVersion } from '../../../core/repositories/confirmedVersion';

vi.unmock('i18next');
vi.unmock('react-i18next');
await initRealDeI18n();

vi.mock('../../auth/hooks/useAuth', () => ({ useAuth: () => ({ isAuthenticated: false }) }));
vi.mock('../../auth/hooks/useTournamentMembers', () => ({ useTournamentMembers: () => ({ myMembership: null, isLoading: false }) }));
vi.mock('../../../hooks/useTournaments', () => ({ useTournaments: () => ({ saveTournament: vi.fn(() => Promise.resolve()), tournaments: [] }) }));

import { SettingsTab } from '../SettingsTab';

function turnier(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1', title: 'Live-Cup', status: 'published', publishedAt: '2026-10-01T08:00:00Z', version: 3,
    teams: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], matches: [],
    startDate: '2099-03-01', startTime: '10:00', date: '2099-03-01', timeSlot: '10:00',
    ageClass: 'U11', location: { name: 'Halle Süd', city: 'Musterstadt' }, placementLogic: [],
    ...overrides,
  } as unknown as Tournament;
}

const onTournamentUpdate = vi.fn();
const zeige = (t: Tournament) => {
  const view = render(<SettingsTab tournament={t} onTournamentUpdate={onTournamentUpdate} />);
  fireEvent.click(screen.getByText('Metadaten bearbeiten')); // Abschnitt ist zunächst eingeklappt
  return (next: Tournament) => view.rerender(<SettingsTab tournament={next} onTournamentUpdate={onTournamentUpdate} />);
};
const ort = () => screen.getByLabelText<HTMLInputElement>(/^Veranstaltungsort/);
const titel = () => screen.getByLabelText<HTMLInputElement>(/Turniername/);
const veranstalter = () => screen.getByLabelText<HTMLInputElement>(/^Veranstalter/);
const speichernKnopf = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });
const gespeichert = (): Tournament => onTournamentUpdate.mock.calls[0][0] as Tournament;

beforeEach(() => vi.clearAllMocks());

describe('Stammdaten-Formular und der Stand eines anderen Geräts (C-GERAET-FOLGT-WACKELT)', () => {
  it('@FU-105 fünf fremde Stände nacheinander: der unangefasste Titel folgt jedem, Ollis Ort bleibt', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle Z4-4' } });
    for (let i = 1; i <= 5; i++) {
      neuerStand(turnier({ version: 3 + i, title: `Live-Cup ${i}` }));
      expect(titel().value).toBe(`Live-Cup ${i}`);
    }
    expect(ort().value).toBe('Halle Z4-4');
    fireEvent.click(speichernKnopf());
    expect(checkedVersion(gespeichert())).toBe(8); // keine Überschneidung: Basis ist der neueste Stand
  });

  it('@FU-108 dieselbe Angabe auf beiden Geräten: Ollis Eingabe bleibt, sein Speichern beruht auf dem alten Stand (der Server lehnt ab)', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });

    neuerStand(turnier({ version: 4, location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    expect(ort().value).toBe('Ollis Halle');
    fireEvent.click(speichernKnopf());
    expect(gespeichert().location.name).toBe('Ollis Halle');
    expect(checkedVersion(gespeichert()), 'kein stilles Überschreiben von Marias Ort').toBe(3);
  });

  it('@FU-108 auch ein späterer fremder Stand lässt die Basis beim alten Stand, solange die Überschneidung bleibt', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });
    neuerStand(turnier({ version: 4, location: { name: 'Marias Halle', city: 'Musterstadt' } }));
    neuerStand(turnier({ version: 5, title: 'Live-Cup Ost', location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    fireEvent.click(speichernKnopf());
    expect(checkedVersion(gespeichert())).toBe(3);
  });

  it('@FU-089 Gegenbeispiel: verschiedene Angaben – beide Änderungen kommen an, Basis ist der neue Stand', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });

    neuerStand(turnier({ version: 4, title: 'Live-Cup Ost' }));

    fireEvent.click(speichernKnopf());
    expect(gespeichert().title).toBe('Live-Cup Ost');
    expect(gespeichert().location.name).toBe('Ollis Halle');
    expect(checkedVersion(gespeichert())).toBe(4);
  });

  it('Gegenbeispiel: Olli tippt denselben Wert wie Maria – keine Überschneidung, Basis ist der neue Stand', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Marias Halle' } });

    neuerStand(turnier({ version: 4, location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    expect(speichernKnopf().disabled).toBe(true); // nichts mehr zu speichern
  });

  it('Turnierwechsel: das Formular zeigt den Stand des neuen Turniers, die angefangene Eingabe gehört zum alten', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle aus Turnier 1' } });

    neuerStand(turnier({ id: 't2', title: 'Anderes Turnier', version: 9, location: { name: 'Halle B' } }));

    expect(ort().value).toBe('Halle B');
    expect(titel().value).toBe('Anderes Turnier');
    expect(speichernKnopf().disabled).toBe(true);
  });

  it('Turnierwechsel: Fehlermeldungen des alten Turniers verschwinden', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(titel(), { target: { value: '' } });
    fireEvent.click(speichernKnopf());
    expect(screen.getByRole('alert')).toBeTruthy();

    neuerStand(turnier({ id: 't2', title: 'Anderes Turnier', version: 9 }));

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('Veranstalter angefasst und wieder geleert, fremder Veranstalter kommt an: das Formular folgt, Speichern bleibt grau', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(veranstalter(), { target: { value: 'x' } });
    fireEvent.change(veranstalter(), { target: { value: '' } });
    expect(speichernKnopf().disabled).toBe(true);

    neuerStand(turnier({ version: 4, organizer: 'Verein Y' }));

    expect(veranstalter().value).toBe('Verein Y');
    expect(speichernKnopf().disabled).toBe(true);
  });

  it('Kontakt ohne bisherigen Stand: Ollis Name bleibt, die fremde Telefonnummer geht nicht verloren', () => {
    const r = rebaseMetaForm({ contactInfo: { name: 'Olli' } }, { contactInfo: undefined }, { contactInfo: { phone: '0170' } });
    expect(r.contactInfo).toEqual({ name: 'Olli', phone: '0170' });
  });

  it('Ortsname angefasst, fremde Stadt kommt an: die Stadt folgt (je Angabe)', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle Z4-4' } });

    neuerStand(turnier({ version: 4, location: { name: 'Halle Süd', city: 'Neustadt' } }));

    fireEvent.click(speichernKnopf());
    expect(gespeichert().location).toEqual({ name: 'Halle Z4-4', city: 'Neustadt' });
    expect(checkedVersion(gespeichert())).toBe(4);
  });

  it('Zurücksetzen nach einem fremden Stand zeigt den neuesten Stand', async () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle Z4-4' } });
    neuerStand(turnier({ version: 4, title: 'Live-Cup Ost', location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verwerfen' }));

    await waitFor(() => expect(ort().value).toBe('Marias Halle'));
    expect(titel().value).toBe('Live-Cup Ost');
    expect(speichernKnopf().disabled).toBe(true);
  });

  it('@FU-108 nach Zurücksetzen beruht ein neues Speichern wieder auf dem neuesten Stand', async () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Ollis Halle' } });
    neuerStand(turnier({ version: 4, location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    fireEvent.click(screen.getByRole('button', { name: 'Zurücksetzen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Verwerfen' }));
    await waitFor(() => expect(ort().value).toBe('Marias Halle'));
    fireEvent.change(titel(), { target: { value: 'Live-Cup Nord' } });
    fireEvent.click(speichernKnopf());

    expect(checkedVersion(gespeichert())).toBe(4);
  });
});
