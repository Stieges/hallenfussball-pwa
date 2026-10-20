/**
 * Paket TB, Task TB-4: Hallen-Monitor, Tabellenfolie je Gruppe nach BFV privat, Platzziffer aus der Rechnung, keine
 * Markierung (Szenarien @W2A-049 Monitor, @W2A-059, @W2A-047, @ET-055). Daten: Plan v2 Abschnitt 6.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StandingsSlide } from '../slides/StandingsSlide';
import { slide } from './monitorFixture';
import { DATA, GD_FIRST_ORDER, NAME } from '../../../core/standings/__tests__/fixtures';
import { zweiGruppenWaging } from '../../../core/standings/__tests__/tb4Kit';
import type { Tournament } from '../../../types/tournament';

function monitorZeilen(tournament: Tournament): Array<[string, string]> {
  render(<StandingsSlide slide={slide('standings', { groupId: 'A' })} tournament={tournament} theme="dark" style={{}} />);
  return screen.getAllByTestId('standings-row').map((row) => [
    row.children[0].textContent?.trim() ?? '',
    row.querySelector('[data-teamname]')?.textContent?.trim() ?? '',
  ] as [string, string]);
}
const ziffer = (zeilen: Array<[string, string]>, name: string): string[] => zeilen.filter(([, n]) => n === name).map(([z]) => z);

describe('TB-4 Monitor-Tabelle', () => {
  it('@W2A-049 Monitor: Gruppe A zeigt DJK Kammer vor TSV Waging rot', () => {
    expect(monitorZeilen(zweiGruppenWaging(DATA.ET_056)).slice(0, 2).map(([, n]) => n)).toEqual([NAME.K, NAME.R]);
  });

  it('@W2A-049 Gegenbeispiel Monitor: bei „Punkte, Tordifferenz, Tore, direkter Vergleich“ steht Waging rot vor Kammer', () => {
    expect(monitorZeilen(zweiGruppenWaging(DATA.ET_056, { placementLogic: GD_FIRST_ORDER })).slice(0, 2).map(([, n]) => n)).toEqual([NAME.R, NAME.K]);
  });

  it('@W2A-059 @ET-055 Monitor: offener Gleichstand zeigt dieselbe Platzziffer 3, 3, 5 und keine Markierung', () => {
    const zeilen = monitorZeilen(zweiGruppenWaging(DATA.ET_055));
    expect([ziffer(zeilen, NAME.R), ziffer(zeilen, NAME.K), ziffer(zeilen, NAME.N)]).toEqual([['3'], ['3'], ['5']]);
    expect(document.body.textContent ?? '').not.toMatch(/gleichauf|Entscheidung nötig|Strafstoß/i);
    expect(document.querySelector('[data-testid="tie-marker"]')).toBeNull();
  });

  it('@W2A-047 Gegenbeispiel Monitor: mitten in der Gruppe 2, 2, 4', () => {
    const zeilen = monitorZeilen(zweiGruppenWaging(DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }));
    expect([ziffer(zeilen, NAME.R), ziffer(zeilen, NAME.K), ziffer(zeilen, NAME.U)]).toEqual([['2'], ['2'], ['4']]);
  });
});
