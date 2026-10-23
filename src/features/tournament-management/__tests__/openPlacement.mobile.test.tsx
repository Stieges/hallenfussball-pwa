/**
 * A-36b Fixrunde 2 (Nachreview N-K5, @ET-042): Mobil-Zweig der Tabellen-Seite (B-06: RankingTab gelöscht) zeigt das Kennzeichen
 * „Finale – offen“ / „Final – open“ (i18n) und den Platz „1–2“. jsdom rendert sonst den Desktop-Zweig.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import { MOCK_TOURNAMENT } from '../../../test-data/mockTournament';
import { cssVars } from '../../../design-tokens';
import {
  openLabel, rankingTitle, rankOfTeam, realI18nWrapper, scheduleAndStandings, tournamentGroupOnly, tournamentWithFinal,
} from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

describe('@ET-042 Mobil: offenes Finale mit Kennzeichen', () => {
  it.each(['de', 'en'] as const)('@ET-042 TabellenTab mobil (%s)', async (lng) => {
    const tournament = tournamentWithFinal('running');
    const { schedule, standings } = scheduleAndStandings(tournament);
    const Wrapper = await realI18nWrapper(lng);
    render(<Wrapper><TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} /></Wrapper>);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle(lng) }));
    expect(screen.getAllByText('1–2')).toHaveLength(2);
    expect(screen.getAllByText(openLabel(lng, 'final'))).toHaveLength(2);
  });

  it('@ET-042 Gegenbeispiel mobil: entschiedenes Finale ohne „offen“, Bezeichnung übersetzt', async () => {
    const tournament = tournamentWithFinal('decided');
    const { schedule, standings } = scheduleAndStandings(tournament);
    const Wrapper = await realI18nWrapper('en');
    render(<Wrapper><TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} /></Wrapper>);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('en') }));
    expect(screen.queryByText(/– open/)).toBeNull();
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });

  it('@ET-042 Nachzug F1 mobil TabellenTab: entschiedenes Finale → Sieger auf Platz 1', async () => {
    const tournament = tournamentWithFinal('decided');
    const { schedule, standings } = scheduleAndStandings(tournament);
    const Wrapper = await realI18nWrapper('de');
    const props = { tournament, schedule, currentStandings: standings };
    render(<Wrapper><TabellenTab {...props} /></Wrapper>);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(rankOfTeam(MOCK_TOURNAMENT.teams[0].name)).toBe('1');
    expect(rankOfTeam(MOCK_TOURNAMENT.teams[4].name)).toBe('2');
  });

  it('@ET-042 F1-W3a mobil TabellenTab: Kennzeichen „– offen“ in fontSizes.xs (≥ 11 px)', async () => {
    const tournament = tournamentWithFinal('running');
    const { schedule, standings } = scheduleAndStandings(tournament);
    const Wrapper = await realI18nWrapper('de');
    const props = { tournament, schedule, currentStandings: standings };
    render(<Wrapper><TabellenTab {...props} /></Wrapper>);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    for (const badge of screen.getAllByText(openLabel('de', 'final'))) {
      expect(badge.style.fontSize).toBe(cssVars.fontSizes.xs);
    }
  });

  it('@ET-042 Gegenbeispiel mobil: ohne Finalrunde nichts „offen“, keine „1–2“', async () => {
    const tournament = tournamentGroupOnly();
    const { schedule, standings } = scheduleAndStandings(tournament);
    const Wrapper = await realI18nWrapper('de');
    render(<Wrapper><TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} /></Wrapper>);
    await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
    expect(screen.queryByText(/– offen/)).toBeNull();
    expect(screen.queryByText('1–2')).toBeNull();
  });
});
