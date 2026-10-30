/**
 * Aufgabe 3.2 (Spielanzeige S3): Folienzeilen des Monitors mit kleinen Ergebniskästen und Logo bzw. Initialen vor dem Namen.
 * @ZM-160 (Folie „Spielplan eines Felds“: Spiel 7 mit Kästen Rot/Weiß) · @ZM-157 (Logo/Initialen vor dem Namen) ·
 * @ZM-087 / RF4 (50 Zeichen, offene Seite ohne Initialen) · @ZM-138 (Nächste Spiele zeigt nie einen Kasten).
 * Spiel 7 läuft auf Feld 1: FC Nord (Heim, trägt Rot) gegen SV Süd (Gast, trägt Weiß), Stand 1:0.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { ScheduleFieldSlide } from '../slides/ScheduleFieldSlide';
import { NextMatchesSlide } from '../slides/NextMatchesSlide';
import type { Team } from '../../../types/tournament';
import { palette } from '../../../design-tokens/colors/palette';
import { buildTournament, FIXTURE_TEAMS, slide, withMatch, withPlayoffs } from './monitorFixture';
import { withView } from './monitorViewHelper';

const ROT = palette.kit.red;
const WEISS = palette.neutral[0];
const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';

function spielplanFeld1(teams: Team[] = FIXTURE_TEAMS) {
  const tournament = buildTournament({ teams, matches: withMatch('match-7', { kit: { a: ROT, b: WEISS } }) });
  return render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-1' })} {...withView(tournament)} theme="dark" style={{}} />);
}
const zeile7 = () => screen.getAllByTestId('monitor-match-row').find((r) => r.dataset.matchId === 'match-7')!;

describe('@ZM-160 Folie „Spielplan eines Felds (Feld 1)“', () => {
  it('@ZM-160 Spiel 7: die Torzahl von FC Nord steht in einem roten, die von SV Süd in einem weißen Kasten', () => {
    spielplanFeld1();
    const heim = within(zeile7()).getByTestId('monitor-match-box-home');
    const gast = within(zeile7()).getByTestId('monitor-match-box-away');
    expect(heim).toHaveTextContent('1');
    expect(gast).toHaveTextContent('0');
    expect(heim.dataset.color).toBe(ROT);
    expect(gast.dataset.color).toBe(WEISS);
    expect(within(zeile7()).getByTestId('monitor-match-separator').textContent).toBe('1:0');
  });

  it('@ZM-160 die Ziffern haben zur Kastenfarbe mindestens 4,5 : 1 (weißer Kasten schwarz, roter weiß)', () => {
    spielplanFeld1();
    expect(within(zeile7()).getByTestId('monitor-match-box-home').dataset.digitColor).toBe('#FFFFFF');
    expect(within(zeile7()).getByTestId('monitor-match-box-away').dataset.digitColor).toBe('#000000');
  });

  it('@ZM-160 Gegenbeispiel: ein Spiel ohne Stand (-:-) hat keinen Kasten', () => {
    spielplanFeld1();
    const offen = screen.getAllByTestId('monitor-match-row').find((r) => r.dataset.matchId === 'match-9')!;
    expect(within(offen).queryByTestId('monitor-match-box-home')).toBeNull();
    expect(within(offen).getByTestId('monitor-match-separator').textContent).toBe('-:-');
  });

  it('@ZM-138 Gegenbeispiel: die Folie „Nächste Spiele“ zeigt nie einen Kasten', () => {
    render(<NextMatchesSlide slide={slide('next-matches')} {...withView(buildTournament())} theme="dark" style={{}} />);
    expect(screen.queryAllByTestId('monitor-match-box-home')).toHaveLength(0);
    expect(screen.queryAllByTestId('monitor-match-box-away')).toHaveLength(0);
  });
});

describe('@ZM-157 Logo bzw. Initialen vor dem Namen in der Zeile', () => {
  it('@ZM-157 FC Nord ohne Logo: „FN“ vor dem Namen; SV Süd mit Logo: das Logo', () => {
    const teams = FIXTURE_TEAMS.map((t) => (t.id === 'team-sued' ? { ...t, logo: { type: 'base64' as const, value: 'data:image/png;base64,AAAA' } } : t));
    spielplanFeld1(teams);
    const heim = within(zeile7()).getByTestId('monitor-match-team-home-avatar');
    const gast = within(zeile7()).getByTestId('monitor-match-team-away-avatar');
    expect(heim).toHaveTextContent('FN');
    expect(gast.querySelector('img')).not.toBeNull();
    expect(heim.compareDocumentPosition(within(zeile7()).getByText('FC Nord')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('@ZM-087 50-Zeichen-Name steht vollständig in der Zeile, ohne „…“', () => {
    const teams = FIXTURE_TEAMS.map((t) => (t.id === 'team-nord' ? { ...t, name: LANG } : t));
    const { container } = spielplanFeld1(teams);
    expect(zeile7().textContent).toContain('SG FF Nordheim-Süd 1921');
    expect(container.textContent).not.toContain('…');
  });

  it('RF4 offene Seite („Sieger Halbfinale 1“): neutraler Platzhalter statt Initialen, kein Kasten vor dem Anpfiff', () => {
    const tournament = buildTournament({ matches: withPlayoffs() });
    render(<ScheduleFieldSlide slide={slide('schedule-field', { fieldId: 'field-2' })} {...withView(tournament)} theme="dark" style={{}} />);
    const finale = screen.getAllByTestId('monitor-match-row').find((r) => r.dataset.matchId === 'po-final')!;
    const seite = within(finale).getByTestId('monitor-match-team-home');
    expect(seite).toHaveTextContent('Sieger Halbfinale 1');
    const avatar = within(finale).getByTestId('monitor-match-team-home-avatar');
    expect(avatar.textContent).toBe('');
    expect(within(finale).queryByTestId('monitor-match-box-home')).toBeNull();
    expect(finale.textContent).not.toContain('…');
  });

  it('RF4 Gegenbeispiel: eine besetzte Seite trägt Initialen', () => {
    spielplanFeld1();
    expect(within(zeile7()).getByTestId('monitor-match-team-away-avatar').textContent).toBe('SS');
  });
});
