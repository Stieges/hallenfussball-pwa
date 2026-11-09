/**
 * @ZM-198 Vor dem ersten beendeten Spiel steht in der Tabelle der Monitor-Folie „Alle Tabellen / Finalrunde“ kein Platz: bei allen Teams
 * „–“ statt „1“, Reihenfolge der Teilnehmerliste, alle Zahlen 0; ab dem ersten beendeten Spiel stehen die Plätze nach der Wertung da.
 * Turnier „Nikolaus-Turnier“: Jeder gegen jeden, 6 Teams (Testkit der Listen-Folien).
 */
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { AllStandingsSlide } from '../slides/AllStandingsSlide';
import { StandingsSlide } from '../slides/StandingsSlide';
import { buildMonitorView } from '../monitorView';
import { monitorTeamName } from '../../../core/models/teamNameAbbrev';
import { listenTurnier } from './listFolienKit';
import { slide } from './monitorFixture';
import type { Tournament } from '../../../types/tournament';
import { initRealDeI18n } from '../../../test/realDeI18n';

await initRealDeI18n();

const zeigen = (t: Tournament) => render(<AllStandingsSlide tournament={t} view={buildMonitorView(t)} theme="dark" style={{}} page={0} />);
const plaetze = () => screen.getAllByTestId('standings-row').map((r) => r.firstElementChild?.textContent);

describe('@ZM-198 Tabelle ohne Platz vor dem ersten beendeten Spiel', () => {
  it('kein Spiel beendet: bei allen 6 Teams „–“, Teilnehmerliste als Reihenfolge, alle Zahlen 0', () => {
    const t = listenTurnier({ beendet: 0 });
    zeigen(t);
    expect(plaetze()).toEqual(['–', '–', '–', '–', '–', '–']);
    const namen = screen.getAllByTestId('standings-row').map((r) => r.querySelector('[data-teamname]')?.textContent);
    expect(namen).toEqual(t.teams.map((team) => monitorTeamName(team.name)));
    for (const row of screen.getAllByTestId('standings-row')) {
      expect(within(row).getByTestId('standings-won')).toHaveTextContent('0');
      expect(within(row).getByTestId('standings-goalDiff')).toHaveTextContent(/^0$/);
    }
    expect(screen.queryByText('1')).toBeNull();
  });

  it('das erste Spiel ist beendet: die Plätze stehen da (nach der Wertung, kein „–“)', () => {
    zeigen(listenTurnier({ beendet: 1 }));
    expect(plaetze().every((p) => p !== '–' && /^\d$/.test(p ?? ''))).toBe(true);
    expect(plaetze()[0]).toBe('1');
  });

  it('dasselbe gilt für die Einzelfolie „Tabelle“ (gleicher Baustein)', () => {
    const t = listenTurnier({ beendet: 0 });
    render(<StandingsSlide slide={slide('standings', {})} tournament={t} theme="dark" style={{}} />);
    expect(plaetze()).toEqual(['–', '–', '–', '–', '–', '–']);
  });
});
