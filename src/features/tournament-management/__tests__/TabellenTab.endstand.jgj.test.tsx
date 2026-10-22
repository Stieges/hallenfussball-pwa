/**
 * A-19a: Gesamtplatzierung „Jeder gegen jeden“ zeigt den Endstand aus `computeFinalStandings` statt des Altpfads
 * (C-ENDSTAND-GRUPPEN-OHNE-FINALRUNDE, Teil Jeder gegen jeden). Record `2026-10-01_endstand-und-torschuetzen`: @ET-022
 * (Reihenfolge der abgeschlossenen Tabelle), @ET-058 (entferntes Team ohne Platz, die übrigen rücken auf).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../utils/calculations';
import type { Tournament } from '../../../types/tournament';
import { DATA, GD_FIRST_ORDER } from '../../../core/standings/__tests__/fixtures';
import { teamNameIn } from '../../../core/standings/__tests__/tb4Kit';
import { jgj } from '../../../core/standings/__tests__/decisionTestKit';
import { completion, NK, tournamentFromFixture } from '../../../core/standings/__tests__/groupCompletionKit';
import { completeGroup } from '../../../core/standings/finalStandings/__tests__/finalStandingsKit';
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

describe('A-19a TabellenTab Gesamtplatzierung Jeder gegen jeden = Endstand', () => {
  it('@ET-058 TSV Petting entfernt: die übrigen 5 Teams auf den Plätzen 1 bis 5, Petting steht nicht in der Gesamtplatzierung', async () => {
    const t = tournamentFromFixture('nikolaus');
    const ohnePetting: Tournament = {
      ...t,
      teams: t.teams.map((team) => (team.id === NK.petting ? { ...team, isRemoved: true } : team)),
      groupCompletions: [completion('', [NK.kammer, NK.wagingRot, NK.otting, NK.fridolfing, NK.wagingBlau])],
    };
    await zeigeGesamtplatzierung(ohnePetting);
    expect(['DJK Kammer', 'TSV Waging rot', 'DJK Otting', 'TSV 1921 Fridolfing', 'TSV Waging blau'].map(platzVon)).toEqual(['1', '2', '3', '4', '5']);
    expect(platzVon('TSV Petting')).toBeNull();
  });

  it('@ET-022 die Gesamtplatzierung folgt der abgeschlossenen Tabelle, auch wenn eine spätere Rechnung anders ordnen würde', async () => {
    const t: Tournament = { ...completeGroup(jgj('RKMUNO', DATA.ET_056)), placementLogic: GD_FIRST_ORDER };
    await zeigeGesamtplatzierung(t);
    expect([platzVon('DJK Kammer'), platzVon('TSV Waging rot')]).toEqual(['1', '2']);
  });
});
