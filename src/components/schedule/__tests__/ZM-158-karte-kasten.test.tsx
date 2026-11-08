/**
 * @ZM-158 @ZM-161 @ZM-195 Zuschauer-Karte am Handy: beim laufenden und beim nächsten Spiel steht die Torzahl in einem kleinen Kasten in der Farbe
 * der Mannschaft – als Trainingsleibchen mit Leibchen-Zeichen oben links, wenn das Team Leibchen trägt; bei „Als Nächstes“ „0“ statt Strich.
 * Alle anderen Spiele zeigen die Zahl wie bisher (keine Kästen in der Spielliste).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next');
vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { MatchCard } from '../MatchCard';
import type { MatchView } from '../../../core/view';
import { palette } from '../../../design-tokens/colors/palette';

const NORD = { id: 'team-nord', name: 'FC Nord' };
const SUED = { id: 'team-sued', name: 'SV Süd' };
const ROT = palette.kit.red;
const BLAU = palette.kit.blue;
const GELB = palette.yellow[400];
const RESULT = { goalsA: 1, goalsB: 0, penaltyA: undefined, penaltyB: undefined, decision: null, winner: null } as const;

const rot: MatchView['boxes']['home'] = { fill: { kind: 'solid', color: ROT }, bib: false };
const weste: MatchView['boxes']['away'] = { fill: { kind: 'vest', center: GELB, stripes: ROT }, bib: true };

const laeuft = (kasten?: MatchView['boxes'], result: typeof RESULT | null = RESULT) =>
  render(<MatchCard matchId="m2" homeTeam={NORD} awayTeam={SUED} status="running" result={result} kasten={kasten} />);

describe('@ZM-158 @ZM-161 Läuft gerade: kleiner Kasten in Teamfarbe', () => {
  it('@ZM-161 FC Nord ganz Rot, SV Süd als Weste (Gelb, Teile in Rot) mit Leibchen-Zeichen oben links am kleinen Kasten', () => {
    laeuft({ home: rot, away: weste });
    expect(screen.getByTestId('match-box-m2-home')).toHaveAttribute('data-fill', 'solid');
    expect(screen.getByTestId('match-box-m2-home')).toHaveTextContent('1');
    const gast = screen.getByTestId('match-box-m2-away');
    expect(gast).toHaveAttribute('data-fill', 'vest');
    expect(gast).toHaveAttribute('data-color', GELB);
    expect(gast).toHaveAttribute('data-stripes', ROT);
    expect(gast.querySelectorAll('[data-teil]')).toHaveLength(3);
    expect(screen.getByTestId('match-box-m2-away-bib')).toBeInTheDocument();
    expect(screen.queryByTestId('match-box-m2-home-bib')).toBeNull();
    expect(gast.getAttribute('aria-label')).toContain('Leibchen');
  });

  it('@ZM-158 der Kasten bleibt die Tippfläche der Torzahl (≥ 44 px hoch, im Knopf) und die Zahl bleibt lesbar', () => {
    laeuft({ home: rot, away: weste });
    const knopf = screen.getByTestId('match-goals-m2-home');
    expect(knopf).toContainElement(screen.getByTestId('match-box-m2-home'));
    expect(knopf).toHaveTextContent('1');
    expect(screen.getByTestId('match-box-m2-away-digits')).toHaveTextContent('0');
  });

  it('@ZM-158 Gegenbeispiel: ohne Kästen (Spielliste) steht die Zahl wie bisher, ohne Kasten, Form und Zeichen', () => {
    laeuft(undefined);
    expect(screen.queryByTestId('match-box-m2-home')).toBeNull();
    expect(screen.getByTestId('match-goals-m2-home')).toHaveTextContent('1');
    expect(document.querySelectorAll('[data-teil]')).toHaveLength(0);
  });

  it('@ZM-161 Gegenbeispiel: kein Leibchen → kein Zeichen, keine Form (beide Kästen einfarbig)', () => {
    laeuft({ home: rot, away: { fill: { kind: 'solid', color: BLAU }, bib: false } });
    expect(document.querySelectorAll('[data-teil]')).toHaveLength(0);
    expect(screen.queryByTestId('match-box-m2-away-bib')).toBeNull();
  });
});

describe('@ZM-158 @ZM-195 Als Nächstes: Kästen mit „0“ statt Strich', () => {
  it('@ZM-195 geplantes Spiel mit Kästen: „0“ in Trikot- bzw. Ausweichfarbe, kein „–“', () => {
    render(<MatchCard matchId="m2" homeTeam={NORD} awayTeam={SUED} status="scheduled" result={null} kasten={{ home: rot, away: { fill: { kind: 'solid', color: BLAU }, bib: false } }} />);
    expect(screen.getByTestId('match-box-m2-home-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('match-box-m2-away-digits')).toHaveTextContent('0');
    expect(screen.getByTestId('match-box-m2-away')).toHaveAttribute('data-color', BLAU);
    expect(document.body.textContent).not.toContain('–');
  });

  it('@ZM-158 Gegenbeispiel: geplantes Spiel ohne Kästen zeigt weiter „–“', () => {
    render(<MatchCard matchId="m9" homeTeam={NORD} awayTeam={SUED} status="scheduled" result={null} />);
    expect(screen.getByTestId('match-goals-m9-home')).toHaveTextContent('–');
    expect(screen.queryByTestId('match-box-m9-home')).toBeNull();
  });
});
