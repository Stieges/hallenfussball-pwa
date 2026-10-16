/**
 * A-36b Fixrunde 1c (@ET-042, Regel T2-UI): Tabellen-Seite, Ansicht Gesamtplatzierung – laufendes Finale vorläufig
 * als gemeinsamer Platz „1–2“ mit Kennzeichen „Finale – offen“ (i18n `tournament:ranking.open`).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { MOCK_TOURNAMENT } from '../../../test-data/mockTournament';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import {
  openLabel, rankingTitle, realI18nWrapper, scheduleAndStandings, tournamentWithFinal, type FinalState,
} from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

async function renderTab(state: FinalState, lng: 'de' | 'en') {
  const tournament = tournamentWithFinal(state);
  const { schedule, standings } = scheduleAndStandings(tournament);
  const Wrapper = await realI18nWrapper(lng);
  render(<Wrapper><TabellenTab tournament={tournament} schedule={schedule} currentStandings={standings} /></Wrapper>);
  await userEvent.click(screen.getByRole('button', { name: rankingTitle(lng) }));
}

/** Platz-Zelle (erste Spalte) der Zeile eines Teams. */
function rankOf(teamName: string): string | null {
  const row = screen.getByText(teamName, { selector: 'td' }).closest('tr');
  return row === null ? null : within(row).getAllByRole('cell')[0].textContent;
}

describe('@ET-042 TabellenTab: offenes Finale vorläufig auf 1–2', () => {
  it.each(['de', 'en'] as const)('@ET-042 laufendes Finale → „1–2“ und Kennzeichen offen (%s)', async (lng) => {
    await renderTab('running', lng);
    expect(screen.getAllByText('1–2')).toHaveLength(2);
    expect(rankOf(MOCK_TOURNAMENT.teams[0].name)).toBe('1–2');
    expect(rankOf(MOCK_TOURNAMENT.teams[4].name)).toBe('1–2');
    expect(screen.getAllByText(openLabel(lng, 'Finale'))).toHaveLength(2);
  });

  it('@ET-042 Gegenbeispiel: entschiedenes Finale → feste Plätze 1 und 2, kein „offen“', async () => {
    await renderTab('decided', 'de');
    expect(screen.queryByText('1–2')).toBeNull();
    expect(rankOf(MOCK_TOURNAMENT.teams[0].name)).toBe('1');
    expect(rankOf(MOCK_TOURNAMENT.teams[4].name)).toBe('2');
    expect(screen.queryByText(/– offen/)).toBeNull();
  });
});
