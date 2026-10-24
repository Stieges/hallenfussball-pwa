/**
 * Reiter Tabellen: Vorgabe-Ansicht, Ansicht in der Adresse, Medaillen bei offenem Gleichstand.
 * Aus dem Gherkin: @W2A-075 (Tabelle sofort, Markierung, nie „keine Gruppen“, Adresse), @W2A-076 (keine Medaille bei offenem
 * Gleichstand); Lage: Nikolaus-Turnier aus @W2A-067, Gegenbeispiel Gruppen aus @W2A-048.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { TabellenTabMitAdresse } from '../TabellenTabMitAdresse';
import { tabellenAnsichtAusAdresse, istEineTabelle } from '../tabellenAnsicht';
import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../utils/calculations';
import type { Tournament } from '../../../types/tournament';
import { lage048, MemoryRepo, nikolaus, shootout } from '../../../core/standings/__tests__/decisionTestKit';
import { NAME } from '../../../core/standings/__tests__/fixtures';
import { fakeTie, i18nWrapper, withTie } from '../standings/__tests__/tieTestKit';

vi.unmock('i18next');
vi.unmock('react-i18next');

const Ort: React.FC = () => <output data-testid="ort">{useLocation().search}</output>;

async function zeige(tournament: Tournament, adresse = '/t/1/tabellen'): Promise<void> {
  const Wrapper = await i18nWrapper('de');
  const tab = (
    <TabellenTabMitAdresse
      tournament={tournament}
      schedule={generateFullSchedule(tournament)}
      currentStandings={calculateStandingsPerGroup(tournament)}
      overallStandings={calculateStandings(tournament.teams, tournament.matches, tournament)}
    />
  );
  render(<Wrapper><MemoryRouter initialEntries={[adresse]}>{withTie(fakeTie(), tab)}<Ort /></MemoryRouter></Wrapper>);
}

const medaille = (teamName: string): string | null => {
  const row = screen.getAllByRole('row').find((r) => r.textContent?.includes(teamName));
  if (row === undefined) { throw new Error(`Zeile „${teamName}“ fehlt`); }
  return within(row).getByTestId('place-medal').getAttribute('data-medal');
};

describe('@W2A-075 Jeder gegen jeden: Reiter Tabellen zeigt sofort die Tabelle', () => {
  it('Nikolaus: ohne Klick die Tabelle aller 6 Teams mit der Markierung, nirgends „keine Gruppen“', async () => {
    await zeige(nikolaus());
    expect(screen.queryByText(/keine Gruppen/)).toBeNull();
    expect(screen.queryByText(/nur für Gruppenturniere/)).toBeNull();
    for (const key of ['K', 'R', 'P', 'D', 'F', 'X'] as const) {
      expect(screen.getAllByText(NAME[key]).length).toBeGreaterThan(0);
    }
    const marken = screen.getAllByTestId('tie-marker');
    expect(marken.length).toBeGreaterThanOrEqual(2); // Tabelle und Handy-Karte tragen je eine
    marken.forEach((m) => expect(m).toHaveTextContent('Gleichstand – Entscheidung nötig'));
    expect(screen.getByRole('button', { name: 'Tabelle' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gruppen' })).toBeNull();
  });

  it('die Vorgabe hängt am Turniermodus, nicht an der Gruppe der Teams', async () => {
    const t = nikolaus();
    const mitGruppe: Tournament = { ...t, teams: t.teams.map((team) => ({ ...team, group: 'A' })) };
    expect(istEineTabelle(t)).toBe(true);
    expect(istEineTabelle(mitGruppe)).toBe(true); // Modus Jeder gegen jeden gilt, auch wenn eine Gruppe eingetragen ist
    expect(istEineTabelle({ ...t, groupSystem: 'groupsAndFinals' })).toBe(false);
    expect(istEineTabelle(lage048())).toBe(false);
  });

  it('Ansicht in der Adresse: Klick auf „Gesamtplatzierung“ schreibt ?ansicht=platzierung, Neuladen mit dieser Adresse zeigt dieselbe', async () => {
    await zeige(nikolaus());
    await userEvent.click(screen.getByRole('button', { name: 'Gesamtplatzierung' }));
    expect(screen.getByTestId('ort')).toHaveTextContent('?ansicht=platzierung');
    expect(screen.getAllByTestId('place-medal').length).toBe(6);
  });

  it('Neuladen: ?ansicht=platzierung öffnet die Platzierung, ?ansicht=tabelle die Tabelle', async () => {
    await zeige(nikolaus(), '/t/1/tabellen?ansicht=platzierung');
    expect(screen.getAllByTestId('place-medal').length).toBe(6);
  });

  it('Neuladen: ?ansicht=tabelle zeigt die Tabelle (keine Platzierungs-Medaillen)', async () => {
    await zeige(nikolaus(), '/t/1/tabellen?ansicht=tabelle');
    expect(screen.queryAllByTestId('place-medal')).toHaveLength(0);
    expect(screen.getAllByTestId('tie-marker').length).toBeGreaterThanOrEqual(2);
  });

  it('ungültiger Wert → Vorgabe (Tabelle)', async () => {
    expect(tabellenAnsichtAusAdresse('quatsch')).toBe('groups');
    expect(tabellenAnsichtAusAdresse(null)).toBe('groups');
    expect(tabellenAnsichtAusAdresse('platzierung')).toBe('ranking');
    await zeige(nikolaus(), '/t/1/tabellen?ansicht=quatsch');
    expect(screen.queryAllByTestId('place-medal')).toHaveLength(0);
    expect(screen.getAllByTestId('tie-marker').length).toBeGreaterThanOrEqual(2);
  });

  it('Gegenbeispiel mehrere Gruppen: unverändert Gruppentabellen, Reiter heißt „Gruppen“', async () => {
    await zeige(lage048());
    expect(screen.getByRole('button', { name: 'Gruppen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tabelle' })).toBeNull();
    expect(screen.queryByText(/keine Gruppen/)).toBeNull();
    expect(screen.getByText('Gruppe A')).toBeInTheDocument();
    expect(screen.getByText('Gruppe B')).toBeInTheDocument();
  });
});

describe('@W2A-076 Offener Gleichstand: keine Medaille für den Platz', () => {
  const platzierung = '/t/1/tabellen?ansicht=platzierung';

  it('Nikolaus offen: Petting und Otting (Platz 3) ohne Medaille, Kammer Gold, Waging rot Silber', async () => {
    await zeige(nikolaus(), platzierung);
    expect(medaille(NAME.P)).toBe('none');
    expect(medaille(NAME.D)).toBe('none');
    expect(medaille(NAME.K)).toBe('gold');
    expect(medaille(NAME.R)).toBe('silver');
  });

  it('nach der Entscheidung (Strafstoßschießen 4:3 für Otting): Otting Bronze, Petting auf Platz 4 ohne', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    await zeige(repo.tournament, platzierung);
    expect(medaille(NAME.D)).toBe('bronze');
    expect(medaille(NAME.P)).toBe('none');
  });

  it('Voreinstellung „Platz 1 bis 3“ (Strafstoßschießen nötig): ebenfalls keine Medaille, solange offen', async () => {
    await zeige(nikolaus([1, 2, 3]), platzierung);
    expect(medaille(NAME.P)).toBe('none');
    expect(medaille(NAME.D)).toBe('none');
  });
});
