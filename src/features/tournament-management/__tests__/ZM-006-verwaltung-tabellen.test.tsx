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
import { render, screen } from '@testing-library/react';
import { TabellenTab } from '../TabellenTab';
import {
  buildTestTournament,
  buildScheduleAndStandings,
  createRealI18nWrapper,
} from './placementLogicTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

describe('@ZM-006 Verwaltung: Tabelle trotz ausgeschalteter Gruppentabellen', () => {
  it('@ZM-006 Olli sieht die Tabelle von Gruppe A mit allen Teams der Gruppe, obwohl Gruppentabellen aus sind', async () => {
    const tournament = { ...buildTestTournament([]), hideRankingsForPublic: true };
    const { schedule, standings } = buildScheduleAndStandings(tournament);
    const gruppeA = tournament.teams.filter((team) => team.group === 'A');
    expect(gruppeA.length).toBeGreaterThan(0);

    const Wrapper = await createRealI18nWrapper();
    render(
      <Wrapper>
        <TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} />
      </Wrapper>
    );

    for (const team of gruppeA) {
      expect(screen.getAllByText(team.name).length).toBeGreaterThan(0);
    }
  });
});
