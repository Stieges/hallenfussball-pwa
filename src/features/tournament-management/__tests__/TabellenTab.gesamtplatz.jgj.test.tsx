/**
 * Review TB-A Auflage 3: Gesamtplatzierung „Jeder gegen jeden“ ohne Finalrunde zeigt die Platzziffer der Rechnung
 * (`place`): ein offener Block teilt die Ziffer mit Sprung (@W2A-047: 3, 3, 5), nach „Ergebnis so akzeptieren“ teilen die
 * Teams den Platz (@W2A-063, Nikolaus: 3, 3, 5). Daten: Plan v2 Abschnitt 6 (@ET-055) und Nikolaus-Lage (Report TB-3').
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
import { jgj, MemoryRepo, nikolaus, shared } from '../../../core/standings/__tests__/decisionTestKit';
import { rankingTitle, realI18nWrapper } from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

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

  it('@W2A-063 Nikolaus, nur Platz 1 und 2: nach „Ergebnis so akzeptieren“ stehen Petting und Otting beide auf Platz 3, Fridolfing 5, Waging blau 6', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service().decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    await zeigeGesamtplatzierung(repo.tournament);
    expect([platzVon(NAME.R), platzVon(NAME.P), platzVon(NAME.D), platzVon(NAME.F), platzVon(NAME.X)]).toEqual(['2', '3', '3', '5', '6']);
  });
});
