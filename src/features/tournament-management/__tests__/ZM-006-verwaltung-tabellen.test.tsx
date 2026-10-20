/**
 * @ZM-006 Ausgeschaltete Tabellen sieht die Turnierleitung in der App weiter (Nachtest NT1, B-13).
 *
 * Gegeben Olli hat „Gruppentabellen“ ausgeschaltet
 * Wenn Olli in seiner App die Tabelle von Gruppe A öffnet
 * Dann sieht er die Tabelle von Gruppe A mit allen Ergebnissen
 *
 * Gegenprobe gegen die Zuschauer-Seite: dort fehlt die Tabelle bei ausgeschalteten Tabellen (@ZM-004/@ZM-005).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { TabellenTab } from '../TabellenTab';
import {
  buildTestTournament,
  buildScheduleAndStandings,
  createRealI18nWrapper,
} from './placementLogicTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

/**
 * Erwartete Zeilen der Gruppe A aus den Ergebnissen der Fixture (MOCK_TOURNAMENT), von Hand gezählt, nicht aus
 * calculateStandings: Spiel 1 TSV Grünwald 3:2 FC Bayern München II, Spiel 2 SpVgg Unterhaching 1:1 SV Heimstetten
 * (beide beendet; Spiel 3 und 4 laufen und zählen nicht). Sieg 3, Unentschieden 1, Niederlage 0 Punkte.
 * Spalten: Spiele, Siege, Unentschieden, Niederlagen, Tore, Differenz, Punkte.
 */
const GRUPPE_A_ZEILEN: [string, string[]][] = [
  ['TSV Grünwald', ['1', '1', '0', '0', '3:2', '+1', '3']],
  ['FC Bayern München II', ['1', '0', '0', '1', '2:3', '-1', '0']],
  ['SpVgg Unterhaching', ['1', '0', '1', '0', '1:1', '0', '1']],
  ['SV Heimstetten', ['1', '0', '1', '0', '1:1', '0', '1']],
];

describe('@ZM-006 Verwaltung: Tabelle trotz ausgeschalteter Gruppentabellen', () => {
  it('@ZM-006 Olli sieht die Tabelle von Gruppe A mit allen Ergebnissen, obwohl Gruppentabellen aus sind', async () => {
    const tournament = { ...buildTestTournament([]), hideRankingsForPublic: true };
    const { schedule, standings } = buildScheduleAndStandings(tournament);
    // Die Fixture hat die vier Teams der Gruppe A (nicht aus dem Code abgelesen: Namen stehen oben)
    expect(tournament.teams.filter((team) => team.group === 'A').map((team) => team.name).sort()).toEqual(
      GRUPPE_A_ZEILEN.map(([name]) => name).sort()
    );

    const Wrapper = await createRealI18nWrapper();
    render(
      <Wrapper>
        <TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} />
      </Wrapper>
    );

    expect(screen.getByRole('heading', { name: 'Gruppe A' })).toBeInTheDocument();
    for (const [name, erwartet] of GRUPPE_A_ZEILEN) {
      // Volle Tabellenzeile (Platz, Team, 7 Werte); die Handy-Tabelle hat nur Platz, Team, Punkte, Differenz
      const zeile = screen
        .getAllByRole('row')
        .find((row) => row.textContent?.includes(name) && within(row).getAllByRole('cell').length === 9);
      expect(zeile, `Tabellenzeile von ${name}`).toBeDefined();
      const zellen = within(zeile!).getAllByRole('cell').map((cell) => cell.textContent?.trim());
      expect(zellen.slice(2)).toEqual(erwartet);
    }
  });
});
