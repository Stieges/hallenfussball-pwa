/**
 * A-36b Nachzug F1 (Daniel 16.10., @ET-042): Die Finalrunden-Platzierung hängt am echten Turniermodell
 * (`hasFinalRound`), nicht am nie gesetzten `finals.enabled`. Desktop-Ansicht beider Tabs.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { RankingTab } from '../RankingTab';
import { TabellenTab } from '../TabellenTab';
import deTournament from '../../../i18n/locales/de/tournament.json';
import { MOCK_TOURNAMENT } from '../../../test-data/mockTournament';
import type { Tournament } from '../../../types/tournament';
import { cssVars } from '../../../design-tokens';
import {
  openLabel, rankingTitle, rankOfTeam, realI18nWrapper, scheduleAndStandings, teamsAtGroupPlace, tournamentGroupOnly,
  tournamentWithFinal,
} from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

type Tab = 'RankingTab' | 'TabellenTab';

async function renderTab(tab: Tab, tournament: Tournament): Promise<void> {
  const { schedule, standings } = scheduleAndStandings(tournament);
  const Wrapper = await realI18nWrapper('de');
  const props = { tournament, schedule, currentStandings: standings };
  const element: ReactNode = tab === 'RankingTab' ? <RankingTab {...props} /> : <TabellenTab {...props} />;
  render(<Wrapper>{element}</Wrapper>);
  if (tab === 'TabellenTab') {
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
  }
}

const [t1, t2, , , t5, t6] = MOCK_TOURNAMENT.teams;

describe.each<Tab>(['RankingTab', 'TabellenTab'])('@ET-042 %s: Finalrunde aus dem Turniermodell', (tab) => {
  it('@ET-042 entschiedenes Finale → Sieger auf Platz 1, Finalist auf 2, Platz-3-Spiel auf 3/4', async () => {
    await renderTab(tab, tournamentWithFinal('decided'));
    expect([rankOfTeam(t1.name), rankOfTeam(t5.name), rankOfTeam(t2.name), rankOfTeam(t6.name)]).toEqual(['1', '2', '3', '4']);
    expect(screen.getByRole('columnheader', { name: deTournament.ranking.headers.decidedBy })).toBeInTheDocument();
  });

  it('@ET-042 F1-W1: in der Gruppe Ausgeschiedene nach Gruppenplatz – alle Dritten vor allen Vierten (Plätze 5+)', async () => {
    const tournament = tournamentWithFinal('decided');
    await renderTab(tab, tournament);
    const placed = new Set([t1.name, t2.name, t5.name, t6.name]);
    const ranksOf = (names: string[]) => names.filter((n) => !placed.has(n)).map((n) => Number(rankOfTeam(n)));
    const thirds = ranksOf(teamsAtGroupPlace(tournament, 3));
    const fourths = ranksOf(teamsAtGroupPlace(tournament, 4));
    expect(thirds.length).toBeGreaterThan(0);
    expect(Math.max(...thirds)).toBeLessThan(Math.min(...fourths));
    expect(Math.min(...thirds, ...fourths)).toBeGreaterThanOrEqual(5);
  });

  it('@ET-042 laufendes Finale → „1–2“ mit „Finale – offen“', async () => {
    await renderTab(tab, tournamentWithFinal('running'));
    expect([rankOfTeam(t1.name), rankOfTeam(t5.name)]).toEqual(['1–2', '1–2']);
    expect(screen.getAllByText(openLabel('de', 'final'))).toHaveLength(2);
  });

  it('@ET-042 F1-W3b: Banner „Playoffs laufen“ mit Text in textPrimary (Kontrast ≥ 4,5:1)', async () => {
    await renderTab(tab, tournamentWithFinal('running'));
    const text = deTournament.ranking.playoffInProgress.replace('{{completed}}', '1').replace('{{total}}', '2');
    expect(screen.getByText(text).style.color).toBe(cssVars.colors.textPrimary);
  });

  it('@ET-042 Gegenbeispiel: ohne Finalrunde reine Gruppentabelle, keine Playoff-Spalte, nichts „offen“', async () => {
    await renderTab(tab, tournamentGroupOnly());
    expect(screen.queryByRole('columnheader', { name: deTournament.ranking.headers.decidedBy })).toBeNull();
    expect(screen.queryByText(/– offen/)).toBeNull();
    expect(screen.queryByText('1–2')).toBeNull();
  });
});
