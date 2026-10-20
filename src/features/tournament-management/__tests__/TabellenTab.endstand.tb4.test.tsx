/**
 * Paket TB, Task TB-4: Gesamtplatzierung der Turnierverwaltung. Mit Finalrunde rechnet der Endstand mit der
 * gruppenübergreifenden Gesamtwertung (`overallStandings`): bei gleichem Gruppenplatz entscheidet sie die Reihenfolge,
 * nicht die Gruppenfolge der Tabellen je Gruppe (Szenario @W2A-049 Endstand, Plan 3.3). Daten: Plan v2 Abschnitt 6 (@ET-056).
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabellenTab } from '../TabellenTab';
import { generateFullSchedule } from '../../../core/generators';
import { calculateStandings, calculateStandingsPerGroup } from '../../../utils/calculations';
import { vs } from '../../../test/matchSlotFixtures';
import type { Match, Tournament } from '../../../types/tournament';
import { DATA, id, NAME } from '../../../core/standings/__tests__/fixtures';
import { teamNameIn, zweiGruppenWaging } from '../../../core/standings/__tests__/tb4Kit';
import { rankingTitle, realI18nWrapper } from './openPlacementTestHelpers';

vi.unmock('i18next');
vi.unmock('react-i18next');

/** Zwei Gruppen mit Finale SC Ost gegen TuS Tal (entschieden): Ost und Tal stehen auf 1 und 2, der Rest nach Gruppenplatz. */
function mitFinale(): Tournament {
  const base = zweiGruppenWaging(DATA.ET_056);
  const finale: Match = {
    id: 'tb4-finale', round: 20, field: 1, ...vs(id('O'), id('T')), isFinal: true, finalType: 'final', label: 'Finale',
    matchStatus: 'finished', scoreA: 1, scoreB: 0, decidedBy: 'regular',
  };
  return { ...base, matches: [...base.matches, finale] };
}

function platzVon(teamName: string): string | null {
  const row = screen.getAllByRole('row').find((r) => teamNameIn(within(r).queryAllByRole('cell')[1]?.textContent?.trim() ?? '') === teamName);
  return row === undefined ? null : within(row).getAllByRole('cell')[0].textContent;
}

describe('TB-4 TabellenTab Gesamtplatzierung mit Finalrunde', () => {
  it('@W2A-049 Endstand: bei gleichem Gruppenplatz entscheidet die Gesamtwertung – Waging blau (+3) vor Kammer (+1), nicht die Gruppenfolge A vor B', async () => {
    const tournament = mitFinale();
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

    expect([platzVon(NAME.O), platzVon(NAME.T)]).toEqual(['1', '2']);
    // Gruppenerste X (B) und K (A): Gesamtwertung X vor K; danach die Gruppenzweiten R (A) und P (B): R vor P.
    expect([platzVon(NAME.X), platzVon(NAME.K), platzVon(NAME.R), platzVon(NAME.P)]).toEqual(['3', '4', '5', '6']);
  });
});
