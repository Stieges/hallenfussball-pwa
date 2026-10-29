/**
 * R5 PR 3, @W2A-059 (Zuschauer, F7): offener Gleichstand = gleiche Platzziffer + kurze Markierung unter dem Namen
 * (Desktop und Handy-Tabelle), „Strafstoß folgt“ bei Pflicht, sonst „wird entschieden“; nach der Entscheidung weg;
 * kein Erklärtext, keine Bedienelemente der Turnierleitung. Ganze Kette wie `tb4.zuschauerTabelle.test.tsx`.
 * Mutation: in `publicTieMarkOf` `mayShare` vertauschen → die Tests mit data-kind rot.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import type { Tournament } from '../../../types/tournament';
import { usePublicTournament } from '../usePublicTournament';
import { createLegacyPublicSource } from '../legacyPublicSource';
import { PublicStandingsTab } from '../components/PublicStandingsTab';
import { SHARE_CODE } from '../../../screens/__tests__/liveViewFixture';
import { DATA } from '../../../core/standings/__tests__/fixtures';
import { mitAnnahme, zweiGruppenWaging } from '../../../core/standings/__tests__/tb4Kit';
import de from '../../../i18n/locales/de/tournament.json';

async function zuschauerTabelle(tournament: Tournament) {
  const oeffentlich: Tournament = { ...tournament, shareCode: SHARE_CODE, isPublic: true, hideRankingsForPublic: false };
  const source = createLegacyPublicSource({ getByShareCode: vi.fn().mockResolvedValue(oeffentlich) });
  const { result } = renderHook(() => usePublicTournament(SHARE_CODE, source));
  await waitFor(() => expect(result.current.loadingState).toBe('success'));
  return render(<PublicStandingsTab tournament={result.current.tournament!} standings={result.current.standings} />);
}
const marken = (container: Element): string[] => [...container.querySelectorAll('[data-testid="public-tie-mark"]')].map((m) => m.getAttribute('data-kind') ?? '');

describe('@W2A-059 Zuschauer-Tabelle markiert offene Gleichstände', () => {
  it('Wortlaut: „Strafstoß folgt“ und „wird entschieden“', () => {
    expect(de.standingsTie.publicMark).toEqual({ follows: 'Strafstoß folgt', deciding: 'wird entschieden' });
  });

  it('ohne Pflicht: je Team eine Markierung „deciding“ (Desktop und Handy), kein Erklärtext, keine Taste in der Marke', async () => {
    const { container } = await zuschauerTabelle(zweiGruppenWaging(DATA.ET_055));
    expect(marken(container)).toEqual(['deciding', 'deciding', 'deciding', 'deciding']);
    expect(container.querySelector('[data-testid="public-tie-mark"] button')).toBeNull();
    expect(container.textContent ?? '').not.toMatch(/Entscheidung nötig|gleichauf/i);
  });

  it('mit Pflicht für Platz 3: „follows“', async () => {
    const { container } = await zuschauerTabelle({ ...zweiGruppenWaging(DATA.ET_055), placementsToPlayOut: [3] });
    expect(new Set(marken(container))).toEqual(new Set(['follows']));
  });

  it('auf dem Handy steht die Markierung in einer eigenen Zeile der schmalen Tabelle', async () => {
    const { container } = await zuschauerTabelle(zweiGruppenWaging(DATA.ET_055));
    const handy = container.querySelector<HTMLElement>('.mobile-view');
    if (handy === null) { throw new Error('schmale Tabelle fehlt'); }
    expect(within(handy).getAllByTestId('tie-marker-row')).toHaveLength(2);
  });

  it('nach der Entscheidung ist die Markierung weg', async () => {
    const { container } = await zuschauerTabelle(await mitAnnahme(zweiGruppenWaging(DATA.ET_055), ['R', 'K'], 'A'));
    expect(marken(container)).toEqual([]);
    expect(screen.queryByTestId('public-tie-mark')).toBeNull();
  });
});
