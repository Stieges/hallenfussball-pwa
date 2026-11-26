/**
 * @ZP-116 Bei einem Feld nennen die Spielkarten im Spielplan kein Feld: weder im Kopf der Karte noch als Spalte (Handy und Laptop).
 * Aber im Turnier mit zwei Feldern steht das Feld in jeder Karte wie bisher. Dieselben Karten zeigt die Zuschauer-Seite (@ZM-216).
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { generateFullSchedule } from '../../../core/generators';
import type { Team } from '../../../types/tournament';
import { createMockTournament } from '../../../test/factories';
import { testUuid } from '../../../test/testIds';
import { ScheduleDisplay } from '../../ScheduleDisplay';
import { MatchCardDesktop } from '../MatchCard';

vi.mock('../../../hooks/useLiveMatches', () => ({ useLiveMatches: () => ({ liveMatches: new Map() }) }));

const teams: Team[] = ['A', 'B'].flatMap((group, g) => [1, 2, 3, 4].map((n) => ({ id: testUuid(g * 10 + n), name: `Team ${group}${n}`, group })));
const plan = (felder: number) => generateFullSchedule(createMockTournament({ teams, numberOfTeams: 8, numberOfGroups: 2, numberOfFields: felder, groupSystem: 'roundRobin' }));

describe('@ZP-116 Spielkarten im Spielplan: Feld nur bei mehreren Feldern', () => {
  it('ein Feld: in keiner Karte steht „Feld 1“', () => {
    const { container } = render(<ScheduleDisplay schedule={plan(1)} showTournamentHeader={false} />);
    expect(container.textContent ?? '').toContain('Team A1'); // die Karten stehen da
    expect(container.textContent ?? '').not.toMatch(/Feld \d/);
  });

  it('Gegenbeispiel zwei Felder: das Feld steht in den Karten wie bisher', () => {
    const { container } = render(<ScheduleDisplay schedule={plan(2)} showTournamentHeader={false} />);
    expect(container.textContent ?? '').toMatch(/Feld 1/);
    expect(container.textContent ?? '').toMatch(/Feld 2/);
  });
});

describe('@ZP-116 Zeile am Laptop (MatchCardDesktop): keine Spalte ohne Feldangabe', () => {
  const zeile = (field: number | undefined) => render(
    <MatchCardDesktop matchId="m1" homeTeam={{ id: 'nord', name: 'FC Nord' }} awayTeam={{ id: 'berg', name: 'DJK Berg' }} scheduledTime="10:00" field={field} status="scheduled" />,
  );

  it('ohne Feld: die Zeile nennt kein Feld, der Raster der Zeile bleibt in beiden Fällen gleich (Hälfte, Stand, Hälfte; @ZM-218)', () => {
    const mit = zeile(1);
    expect(mit.container.textContent).toContain('Feld');
    const ohneZeile = zeile(undefined);
    expect(ohneZeile.container.textContent).not.toContain('Feld');
    const zeileMit = mit.container.querySelector('[role="article"]')!;
    const zeileOhne = ohneZeile.container.querySelector('[role="article"]')!;
    // dasselbe Raster mit und ohne Feld, nie eine Spalte mehr oder weniger (die Feldangabe liegt in der linken Hälfte)
    expect(zeileOhne.children.length).toBe(zeileMit.children.length);
    expect(zeileOhne.children.length).toBe(3);
    expect(getComputedStyle(zeileOhne).gridTemplateColumns).toBe(getComputedStyle(zeileMit).gridTemplateColumns);
  });
});
