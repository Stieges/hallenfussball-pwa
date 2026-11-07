/**
 * Verwaltung, Reiter Einstellungen: eine angefangene Eingabe bleibt stehen, wenn währenddessen der Stand eines anderen
 * Geräts ankommt (Befund C-GERAET-FOLGT-WACKELT, Ursache 2). Bisher setzte jedes neue Turnier-Objekt – auch das aus
 * einem Realtime-Anstoß oder dem 5-s-Abruf – das Formular auf den Stand der Cloud zurück: „Speichern“ wurde grau, und
 * Ollis Änderung kam nie beim Server an. Damit scheitert @FU-105 („Olli speichert nacheinander fünf Änderungen … Marias
 * Tablet zeigt jede“) und @FU-089 (Rückweg: Marias Änderung erscheint auf Ollis Gerät), sobald ein anderes Gerät
 * gerade etwas ändert. Szenarien: @FU-134 (angefangene Eingabe übersteht die Änderung eines anderen Geräts),
 * docs/anforderungen/plattform/2026-09-24_fundament-gemeinsamer-stand.md.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';

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
const speichernKnopf = () => screen.getByRole<HTMLButtonElement>('button', { name: 'Speichern' });

beforeEach(() => vi.clearAllMocks());

describe('Angefangene Eingabe übersteht den Stand eines anderen Geräts (C-GERAET-FOLGT-WACKELT)', () => {
  it('@FU-134 @FU-105 Olli tippt den Ort, Marias Teamänderung kommt an: die Eingabe bleibt, Speichern sendet sie', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle Z4-4' } });

    // ein frisches Lesen nach einem Realtime-Anstoß liefert ein neues Objekt (andere Version, ein Team umbenannt)
    neuerStand(turnier({ version: 4, teams: [{ id: 'a', name: 'A neu' }, { id: 'b', name: 'B' }] }));

    expect(ort().value).toBe('Halle Z4-4');
    expect(speichernKnopf().disabled).toBe(false);
    fireEvent.click(speichernKnopf());
    expect(onTournamentUpdate).toHaveBeenCalledTimes(1);
    const gespeichert = onTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(gespeichert.location.name).toBe('Halle Z4-4');
    expect(gespeichert.version).toBe(4); // Basis ist der neue Stand, Marias Teamname geht nicht verloren
    expect(gespeichert.teams[0].name).toBe('A neu');
  });

  it('@FU-134 ein Feld, das Olli nicht angefasst hat, übernimmt den Stand des anderen Geräts', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle Z4-4' } });

    neuerStand(turnier({ version: 4, title: 'Live-Cup Ost' }));

    expect(titel().value).toBe('Live-Cup Ost');
    expect(ort().value).toBe('Halle Z4-4');
    fireEvent.click(speichernKnopf());
    const gespeichert = onTournamentUpdate.mock.calls[0][0] as Tournament;
    expect(gespeichert.title).toBe('Live-Cup Ost');
    expect(gespeichert.location.name).toBe('Halle Z4-4');
  });

  it('Gegenbeispiel: ohne angefangene Eingabe zeigt das Formular den neuen Stand, Speichern bleibt grau', () => {
    const neuerStand = zeige(turnier());

    neuerStand(turnier({ version: 4, location: { name: 'Marias Halle', city: 'Musterstadt' } }));

    expect(ort().value).toBe('Marias Halle');
    expect(speichernKnopf().disabled).toBe(true);
  });

  it('Gegenbeispiel: nach dem eigenen Speichern ist das Formular wieder „Gespeichert“', () => {
    const neuerStand = zeige(turnier());
    fireEvent.change(ort(), { target: { value: 'Halle Z4-4' } });
    fireEvent.click(speichernKnopf());

    neuerStand(onTournamentUpdate.mock.calls[0][0] as Tournament); // die Anzeige trägt jetzt den gespeicherten Stand

    expect(ort().value).toBe('Halle Z4-4');
    expect(speichernKnopf().disabled).toBe(true);
  });
});
