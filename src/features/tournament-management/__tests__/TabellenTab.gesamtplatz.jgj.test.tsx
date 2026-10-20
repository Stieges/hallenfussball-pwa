/**
 * Review TB-A Auflage 3: Gesamtplatzierung „Jeder gegen jeden“ ohne Finalrunde zeigt die Platzziffer der Rechnung
 * (`place`): ein offener Block teilt die Ziffer mit Sprung (@W2A-047: 3, 3, 5), nach „gleichen Platz lassen“ teilen die
 * Teams den Platz (@W2A-063: 5, 5). Daten: Plan v2 Abschnitt 6 (@ET-055) und @W2A-063 (gegengerechnet, Report TB-3).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../utils/calculations';
import type { Tournament } from '../../../types/tournament';
import { DATA, NAME } from '../../../core/standings/__tests__/fixtures';
import { teamNameIn } from '../../../core/standings/__tests__/tb4Kit';
import { jgj, MemoryRepo, OLLI, shared } from '../../../core/standings/__tests__/decisionTestKit';
import { rankingTitle, realI18nWrapper } from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

const DATEN_063 = 'M–N 1:1; M–U 1:1; M–W 1:1; M–X 3:0; M–P 3:0; N–U 1:1; N–W 1:1; N–X 1:0; N–P 1:0; U–W 2:1; U–X 2:0; P–U 1:0; W–P 2:0; X–W 1:0; X–P 1:1';

async function zeigeGesamtplatzierung(tournament: Tournament): Promise<void> {
  const Wrapper = await realI18nWrapper('de');
  render(
    <Wrapper>
      <TabellenTab
        tournament={tournament}
        schedule={generateFullSchedule(tournament)}
        currentStandings={calculateStandingsPerGroup(tournament)}
        overallStandings={calculateStandings(tournament.teams, tournament.matches, tournament)}
      />
    </Wrapper>,
  );
  await userEvent.click(screen.getByRole('button', { name: rankingTitle('de') }));
}

function platzVon(teamName: string): string | null {
  const row = screen.getAllByRole('row').find((r) => teamNameIn(within(r).queryAllByRole('cell')[1]?.textContent?.trim() ?? '') === teamName);
  return row === undefined ? null : within(row).getAllByRole('cell')[0].textContent;
}

describe('Auflage 3 TabellenTab Gesamtplatzierung Jeder gegen jeden', () => {
  it('@W2A-047 offener Gleichstand Waging rot/Kammer: Platzziffer 3, 3, danach 5 – nicht 3, 4, 5', async () => {
    await zeigeGesamtplatzierung(jgj('RKMUNO', DATA.ET_055));
    expect([platzVon(NAME.M), platzVon(NAME.U)]).toEqual(['1', '2']);
    expect([platzVon(NAME.R), platzVon(NAME.K), platzVon(NAME.N)]).toEqual(['3', '3', '5']);
  });

  it('@W2A-063 nach „gleichen Platz lassen“ stehen Waging blau und Petting beide auf Platz 5', async () => {
    const repo = new MemoryRepo(jgj('MNUWXP', DATEN_063));
    expect((await repo.service().decide(repo.tournament.id, shared(['X', 'P'], 'Hallenzeit zu Ende'), OLLI)).ok).toBe(true);
    await zeigeGesamtplatzierung(repo.tournament);
    expect([platzVon(NAME.W), platzVon(NAME.X), platzVon(NAME.P)]).toEqual(['4', '5', '5']);
  });
});
