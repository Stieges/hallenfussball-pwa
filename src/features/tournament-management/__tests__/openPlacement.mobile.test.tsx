/**
 * A-36b Fixrunde 2 (Nachreview N-K5, @ET-042): Mobil-Zweig von RankingTab und TabellenTab zeigt das Kennzeichen
 * „Finale – offen“ / „Final – open“ (i18n) und den Platz „1–2“. jsdom rendert sonst den Desktop-Zweig.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RankingTab } from '../RankingTab';
import { TabellenTab } from '../TabellenTab';
import { openLabel, rankingTitle, realI18nWrapper, scheduleAndStandings, tournamentWithFinal } from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');
vi.mock('../../../hooks/useIsMobile', () => ({ useIsMobile: () => true }));

describe('@ET-042 Mobil: offenes Finale mit Kennzeichen', () => {
  it.each(['de', 'en'] as const)('@ET-042 RankingTab mobil (%s)', async (lng) => {
    const tournament = tournamentWithFinal('running');
    const { schedule, standings } = scheduleAndStandings(tournament);
    const Wrapper = await realI18nWrapper(lng);
    render(<Wrapper><RankingTab tournament={tournament} schedule={schedule} currentStandings={standings} /></Wrapper>);
    expect(screen.getAllByText('1–2')).toHaveLength(2);
    expect(screen.getAllByText(openLabel(lng, 'final'))).toHaveLength(2);
  });

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
    render(<Wrapper><RankingTab tournament={tournament} schedule={schedule} currentStandings={standings} /></Wrapper>);
    expect(screen.queryByText(/– open/)).toBeNull();
    expect(screen.getAllByText('Final').length).toBeGreaterThan(0);
  });
});
