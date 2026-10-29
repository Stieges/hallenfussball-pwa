/**
 * R5 PR 3, @W2A-059 (Monitor): offener Gleichstand = gleiche Platzziffer + kurze Markierung hinter dem Namen,
 * „Strafstoß folgt“ bei Pflicht, sonst „wird entschieden“; nach der Entscheidung weg; kein Erklärtext, keine Taste.
 * Dazu der Befund „alle Teams Platz 1“ vom 24.10.: Punkte 3/1/1/0/0/0 → Plätze 1/2/2/4/4/6 (Rechnung stimmt, der Befund war nicht reproduzierbar).
 * Mutation: in `publicTieMarkOf` `mayShare` vertauschen → die beiden Texttests rot.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { StandingsSlide } from '../slides/StandingsSlide';
import { slide } from './monitorFixture';
import { DATA, NAME, league } from '../../../core/standings/__tests__/fixtures';
import { mitAnnahme, zweiGruppenWaging } from '../../../core/standings/__tests__/tb4Kit';
import de from '../../../i18n/locales/de/monitor.json';
import type { Tournament } from '../../../types/tournament';

function zeigen(tournament: Tournament, groupId = 'A') {
  return render(<StandingsSlide slide={slide('standings', { groupId })} tournament={tournament} theme="dark" style={{}} />);
}
const zeileVon = (name: string): HTMLElement => {
  const zeile = screen.getAllByTestId('standings-row').find((row) => row.querySelector('[data-teamname]')?.firstChild?.textContent?.trim() === name);
  if (zeile === undefined) { throw new Error(`Zeile ${name} fehlt`); }
  return zeile;
};
/** Die Testumgebung gibt Schlüssel statt Text zurück; der Wortlaut steht in `de/monitor.json` (eigener Test unten). */
const marke = (name: string): string | null => within(zeileVon(name)).queryByTestId('monitor-tie-mark')?.getAttribute('data-mark') ?? null;

describe('@W2A-059 Monitor-Tabelle markiert offene Gleichstände', () => {
  it('Wortlaut: „Strafstoß folgt“ und „wird entschieden“, sonst nichts', () => {
    expect(de.standings.tie).toEqual({ follows: 'Strafstoß folgt', deciding: 'wird entschieden' });
  });

  it('ohne Pflicht: beide „wird entschieden“ (deciding), gleiche Platzziffer 3, ohne Taste in der Zeile', () => {
    zeigen(zweiGruppenWaging(DATA.ET_055));
    expect([marke(NAME.R), marke(NAME.K), marke(NAME.N)]).toEqual(['deciding', 'deciding', null]);
    expect([zeileVon(NAME.R).children[0].textContent, zeileVon(NAME.K).children[0].textContent]).toEqual(['3', '3']);
    expect(zeileVon(NAME.R).querySelector('button, a, input')).toBeNull();
  });

  it('mit Pflicht für Platz 3: beide „Strafstoß folgt“ (follows)', () => {
    zeigen({ ...zweiGruppenWaging(DATA.ET_055), placementsToPlayOut: [3] });
    expect([marke(NAME.R), marke(NAME.K)]).toEqual(['follows', 'follows']);
  });

  it('nach der Entscheidung (Ergebnis akzeptiert) ist die Markierung weg', async () => {
    zeigen(await mitAnnahme(zweiGruppenWaging(DATA.ET_055), ['R', 'K'], 'A'));
    expect(screen.queryByTestId('monitor-tie-mark')).toBeNull();
  });

  it('Gegenprobe mitten in der Gruppe (Spiele offen): keine Markierung, Ziffern 2, 2, 4', () => {
    zeigen(zweiGruppenWaging(DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }));
    expect(screen.queryByTestId('monitor-tie-mark')).toBeNull();
  });

  it('Platz-1-Befund vom 24.10.: 2 beendete Spiele, Punkte 3/1/1/0/0/0 geben Plätze 1/2/2/4/4/6, nie überall 1', () => {
    const { tournament } = league('WOUMNB', 'W–O 1:0; U–M 0:0', {});
    const spiele = tournament.matches.map((m) => ({ ...m, matchStatus: 'finished' as const }));
    zeigen({ ...tournament, matches: spiele }, '');
    const rows = screen.getAllByTestId('standings-row');
    expect(rows.map((r) => r.children[6].textContent)).toEqual(['3', '1', '1', '0', '0', '0']);
    expect(rows.map((r) => r.children[0].textContent)).toEqual(['1', '2', '2', '4', '4', '6']); // SC Ost (Tordifferenz −1) steht hinter den beiden Teams ohne Spiel
  });
});
