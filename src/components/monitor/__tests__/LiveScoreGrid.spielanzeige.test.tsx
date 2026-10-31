/**
 * Aufgabe 3.2 (Spielanzeige S3): Live-Folie des Monitors mit `ScoreBox` und `TeamName`.
 * Werte aus dem Gherkin: @ZM-161 (Weste), @ZM-157 (alle Zusätze), @ZM-156 (Ring/Pokal), @ZM-154 (Teamfarben aus),
 * @ZM-047:teil (Zwischenstand im Strafstoßschießen), @ZM-151 (Kästen gleich in jedem Zustand), RF3 (zweistelliger Stand).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.unmock('i18next'); vi.unmock('react-i18next');
import { initRealDeI18n } from '../../../test/realDeI18n';
await initRealDeI18n();

import { cssVars, displayLayout, monitorThemes } from '../../../design-tokens';
import { palette } from '../../../design-tokens/colors/palette';
import type { FinalScore } from '../../../core/view';
import type { SideBox } from '../../../core/models/scoreBoxColors';
import type { LiveMatch } from '../../../hooks/useLiveMatches';
import { LiveMatchDisplay } from '../LiveMatchDisplay';

vi.mock('../../../hooks/useLiveMatches', () => ({
  useLiveMatches: () => ({ liveMatches: new Map(), lastGoalEvent: null, lastCardEvent: null }),
}));

const GELB = palette.yellow[400];
const ROT = palette.kit.red;
const BLAU = palette.kit.blue;
const WEISS = palette.neutral[0];
const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const LOGO = { type: 'base64' as const, value: 'data:image/png;base64,AAAA' };

type Boxen = { home: SideBox; away: SideBox };
const solid = (color: string, bib = false): SideBox => ({ fill: { kind: 'solid', color }, bib });
const WESTE_SUED_WEISS_NORD: Boxen = { home: { fill: { kind: 'vest', center: GELB, stripes: ROT }, bib: true }, away: solid(WEISS) };

function spiel(over: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm12', number: 12, phaseLabel: 'Gruppe A', fieldId: 'f1', field: 1, scheduledKickoff: '', group: 'A',
    homeTeam: { id: 't1', name: 'SV Süd' }, awayTeam: { id: 't2', name: 'FC Nord' }, homeScore: 3, awayScore: 2,
    status: 'RUNNING', elapsedSeconds: 100, durationSeconds: 600, events: [], ...over,
  };
}

const ENDE = { decidedBy: 'regular', winner: 'a' } as const;
const stand = (extra: Partial<FinalScore>): FinalScore => ({ a: 2, b: 2, regular: { a: 2, b: 2 }, ...ENDE, ...extra });
const FINALE_STRAFSTOSS = stand({ overtime: { a: 0, b: 0 }, penalty: { a: 4, b: 3 }, decidedBy: 'penalty' });
const FINALE = spiel({ id: 'fin', number: 16, phaseLabel: 'Finale', status: 'FINISHED', homeScore: 2, awayScore: 2, homeTeam: { id: 't1', name: 'FC Nord' }, awayTeam: { id: 't2', name: 'SG Mitte', logo: LOGO } });

const box = (s: 'home' | 'away') => screen.getByTestId(`live-box-${s}`);
const teamName = (s: 'home' | 'away') => screen.getByTestId(`live-name-${s}`).querySelector<HTMLElement>('[data-teamname]')!;

describe('@ZM-161 Weste am Monitor', () => {
  it('@ZM-161 Live-Folie Spiel 12: SV Süd Weste Gelb mit roten Streifen, Leibchen-Zeichen, kein „in Leibchen“; FC Nord ganz weiß', () => {
    const { container } = render(<LiveMatchDisplay match={spiel()} boxes={WESTE_SUED_WEISS_NORD} />);
    expect(box('home').dataset.fill).toBe('vest');
    expect(box('home').dataset.color).toBe(GELB);
    expect(box('home').dataset.stripes).toBe(ROT);
    expect(screen.getByTestId('live-box-home-bib')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/in Leibchen/i);
    expect(box('away').dataset.fill).toBe('solid');
    expect(box('away').dataset.color).toBe(WEISS);
    expect(screen.queryByTestId('live-box-away-bib')).toBeNull();
    expect(box('away').dataset.stripes).toBeUndefined();
  });

  it('@ZM-161 die Zahl steht in der Mitte, das Leibchen-Zeichen liegt absolut außerhalb der Ziffernfläche', () => {
    render(<LiveMatchDisplay match={spiel()} boxes={WESTE_SUED_WEISS_NORD} />);
    expect(screen.getByTestId('live-box-home-digits')).toHaveTextContent('3');
    expect(screen.getByTestId('live-box-home-bib').style.position).toBe('absolute');
    expect(screen.getByTestId('live-box-home-digits').contains(screen.getByTestId('live-box-home-bib'))).toBe(false);
  });
});

describe('@ZM-154 Teamfarben aus', () => {
  it('@ZM-154 Teamfarben aus: Leibchen-Zeichen bleibt, keine Weste, kein „in Leibchen“', () => {
    const boxen: Boxen = { home: solid(BLAU), away: solid(ROT, true) };
    const { container } = render(<LiveMatchDisplay match={spiel()} boxes={boxen} />);
    expect(box('away').dataset.fill).toBe('solid');
    expect(box('away').dataset.color).toBe(ROT);
    expect(screen.getByTestId('live-box-away-bib')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/in Leibchen/i);
  });
});

describe('@ZM-157 Finale beendet mit allen Zusätzen', () => {
  const zeige = (match = FINALE, boxen?: Boxen) => render(
    <LiveMatchDisplay
      match={match} finalRound finalScore={FINALE_STRAFSTOSS}
      boxes={boxen ?? { home: { fill: { kind: 'vest', center: GELB, stripes: ROT }, bib: true }, away: solid(BLAU) }}
    />,
  );

  it('@ZM-157 Finale beendet: Pokal oben rechts, Leibchen-Zeichen oben links, Ring außen; „FN“ vor FC Nord, Logo vor SG Mitte; „nach Verlängerung“; Strafstoß unter „:“; „FC Nord gewinnt“', () => {
    zeige();
    expect(box('home').dataset.outcome).toBe('winner');
    expect(box('home').style.outlineStyle).toBe('solid');
    expect(screen.getByTestId('live-box-home-cup').style.right).not.toBe('');
    expect(screen.getByTestId('live-box-home-bib').style.left).not.toBe('');
    expect(screen.getByTestId('live-team-home-avatar')).toHaveTextContent('FN');
    expect(screen.getByTestId('live-team-away-avatar').querySelector('img')).toHaveAttribute('src', LOGO.value);
    for (const s of ['home', 'away'] as const) {
      expect(box(s).contains(screen.getByTestId(`live-team-${s}-avatar`))).toBe(false);
    }
    expect(screen.getByTestId('live-team-home-addon-0')).toHaveTextContent('nach Verlängerung');
    expect(screen.getByTestId('live-penalty')).toHaveTextContent('Strafstoßschießen 4 : 3');
    expect(screen.getByTestId('live-winner')).toHaveTextContent('FC Nord gewinnt');
  });

  it('@ZM-157 50-Zeichen-Name am Monitor steht als „SG FF Nordheim-Süd 1921“, darunter beide Zusätze', () => {
    zeige({ ...FINALE, homeTeam: { id: 't1', name: LANG } });
    expect(teamName('home').textContent).toBe('SG FF Nordheim-Süd 1921');
    expect(screen.getByTestId('live-team-home-addons').style.minHeight).not.toBe('');
    expect(screen.getByTestId('live-team-home-addon-0')).toHaveTextContent('nach Verlängerung');
    expect(screen.getByTestId('live-penalty')).toBeInTheDocument();
    expect(screen.getByTestId('live-grid').textContent).not.toContain('…');
  });

  it('@ZM-157 Logo/Initialen: Avatar steht außen neben dem Kasten (Variante c) in der Größe der Tokens, Initialen neutral (Thema statt Weiß auf Streufarbe)', () => {
    zeige();
    const avatar = screen.getByTestId('live-team-home-avatar');
    expect(avatar.style.width).toBe(`min(${displayLayout.scoreArea.avatarOutsideHeight}, ${displayLayout.scoreArea.avatarOutsideWidthCap})`);
    expect(avatar.style.justifySelf).toBe('start');
    const flaeche = avatar.firstElementChild as HTMLElement;
    const normiert = document.createElement('div');
    normiert.style.backgroundColor = monitorThemes.dark.surfaceHover;
    expect(flaeche.style.backgroundColor).toBe(normiert.style.backgroundColor);
  });

  it('@ZM-157 Variante c: Logo links vom Heimkasten und rechts vom Gastkasten, senkrecht mittig, nicht über dem Namen', () => {
    zeige();
    const heim = screen.getByTestId('live-team-home-avatar');
    const gast = screen.getByTestId('live-team-away-avatar');
    expect(heim.style.justifySelf).toBe('start');
    expect(gast.style.justifySelf).toBe('end');
    expect(heim.style.gridColumn).toBe('1');
    expect(gast.style.gridColumn).toBe('3');
    for (const a of [heim, gast]) {
      expect(a.style.alignSelf).toBe('center');
      expect(a.style.gridRow).toBe('1');
    }
    expect(screen.getByTestId('live-block-home')).not.toContainElement(heim);
    expect(screen.getByTestId('live-name-home')).not.toContainElement(heim);
    expect(screen.getByTestId('live-name-away')).not.toContainElement(gast);
  });

  it('@ZM-157 Gegenbeispiel: Team ohne Logo – Initialen im gleich großen Kreis an derselben Stelle wie das Logo', () => {
    zeige();
    const heim = screen.getByTestId('live-team-home-avatar');
    const gast = screen.getByTestId('live-team-away-avatar');
    expect(heim.querySelector('img')).toBeNull();
    expect(gast.querySelector('img')).not.toBeNull();
    expect(heim.style.width).toBe(gast.style.width);
    expect(heim.style.height).toBe(gast.style.height);
  });

  it('@ZM-157 kein Zeichen liegt in der Ziffernfläche: Pokal, Leibchen-Zeichen und Avatar sind keine Kinder der Ziffer', () => {
    zeige();
    const ziffer = screen.getByTestId('live-box-home-digits');
    expect(ziffer.children).toHaveLength(0);
  });
});

describe('@ZM-156 Ring und Pokal', () => {
  const GRUPPE_2_1 = stand({ a: 1, b: 2, regular: { a: 1, b: 2 }, winner: 'b' });
  const sieben = (over: Partial<LiveMatch> = {}) => spiel({ number: 7, status: 'FINISHED', homeScore: 1, awayScore: 2, homeTeam: { id: 't1', name: 'SV Süd' }, awayTeam: { id: 't2', name: 'FC Nord' }, ...over });

  it('@ZM-156 Spiel 7 (Gruppe A) 2:1: Ring am Kasten von FC Nord, kein Pokal, SV Süd zurückgenommen', () => {
    render(<LiveMatchDisplay match={sieben()} finalScore={GRUPPE_2_1} finalRound={false} boxes={{ home: solid(WEISS), away: solid(ROT) }} />);
    expect(box('away').dataset.outcome).toBe('winner');
    expect(box('home').dataset.outcome).toBe('loser');
    expect(screen.queryByTestId('live-box-away-cup')).toBeNull();
    expect(screen.queryByTestId('live-box-home-cup')).toBeNull();
    expect(teamName('away').style.fontWeight).toBe(cssVars.fontWeights.extrabold);
    expect(screen.getByTestId('live-endstand')).toHaveTextContent('Endstand');
  });

  it('@ZM-156 Spiel 7 (Gruppe A) 1:1: kein Ring, kein Pokal, niemand zurückgenommen', () => {
    render(<LiveMatchDisplay match={sieben({ homeScore: 1, awayScore: 1 })} finalScore={stand({ a: 1, b: 1, regular: { a: 1, b: 1 }, winner: null, decidedBy: null })} boxes={{ home: solid(WEISS), away: solid(ROT) }} />);
    expect(box('home').dataset.outcome).toBeUndefined();
    expect(box('away').dataset.outcome).toBeUndefined();
    expect(screen.queryByTestId('live-box-home-cup')).toBeNull();
    expect(screen.queryByTestId('live-box-away-cup')).toBeNull();
  });

  it('@ZM-156 Halbfinale: der Sieger trägt Ring und Pokal (Finalrunde)', () => {
    render(<LiveMatchDisplay match={sieben()} finalScore={GRUPPE_2_1} finalRound boxes={{ home: solid(WEISS), away: solid(ROT) }} />);
    expect(box('away').dataset.outcome).toBe('winner');
    expect(screen.getByTestId('live-box-away-cup')).toBeInTheDocument();
    expect(screen.queryByTestId('live-box-home-cup')).toBeNull();
  });

  it('@ZM-156 der zurückgenommene Kasten behält den Farbton seiner Teamfarbe', () => {
    render(<LiveMatchDisplay match={sieben()} finalScore={GRUPPE_2_1} boxes={{ home: solid(ROT), away: solid(BLAU) }} />);
    expect(box('home').dataset.color).toBe(ROT);
    expect(box('home').style.backgroundColor).not.toBe('');
  });
});

describe('@ZM-047:teil Strafstoßschießen läuft', () => {
  it('@ZM-047:teil Strafstoßschießen läuft 3:2: unter dem Doppelpunkt klein „Strafstoßschießen“, groß „3 : 2“, am selben Platz wie danach', () => {
    const laeuft = stand({ penalty: { a: 3, b: 2 }, decidedBy: null, winner: null });
    const { unmount } = render(<LiveMatchDisplay match={spiel({ homeScore: 2, awayScore: 2 })} finalScore={laeuft} finalRound />);
    expect(screen.getByTestId('live-penalty')).toHaveTextContent('Strafstoßschießen 3 : 2');
    const platz = (): string => {
      const zelle = screen.getByTestId('live-penalty-block').parentElement!;
      return `${zelle.style.gridColumn}|${zelle.style.gridRow}`;
    };
    const waehrend = platz();
    unmount();
    render(<LiveMatchDisplay match={FINALE} finalScore={FINALE_STRAFSTOSS} finalRound />);
    expect(platz()).toBe(waehrend);
  });

  it('Gegenbeispiel: ohne Strafstoßschießen steht unter dem Doppelpunkt nichts', () => {
    render(<LiveMatchDisplay match={spiel()} finalScore={stand({ a: 3, b: 2, regular: { a: 3, b: 2 }, winner: null, decidedBy: null })} />);
    expect(screen.queryByTestId('live-penalty-block')).toBeNull();
  });
});

describe('@ZM-151 / RF3 Kästen bleiben gleich', () => {
  const masse = () => ['home', 'away'].map((s) => {
    const k = screen.getByTestId(`live-box-${s}`);
    const zelle = screen.getByTestId(`live-block-${s}`);
    return [zelle.style.width, zelle.style.height, k.style.width, k.style.height, k.style.boxSizing, k.style.borderWidth].join('|');
  });

  it('@ZM-151 nur eingetragenes Ergebnis hat dieselben Kästen wie nach Strafstoßschießen', () => {
    const { unmount } = render(<LiveMatchDisplay match={spiel()} boxes={WESTE_SUED_WEISS_NORD} />);
    const lauf = masse();
    unmount();
    render(<LiveMatchDisplay match={FINALE} finalScore={FINALE_STRAFSTOSS} finalRound boxes={WESTE_SUED_WEISS_NORD} />);
    expect(masse()).toEqual(lauf);
    expect(lauf[0]).toContain(displayLayout.scoreArea.blockHeight);
  });

  it('RF3 10 : 9 mit Pokal und Leibchen-Zeichen: Kastenmaße unverändert', () => {
    const { unmount } = render(<LiveMatchDisplay match={spiel({ homeScore: 2, awayScore: 1 })} boxes={WESTE_SUED_WEISS_NORD} />);
    const klein = masse();
    unmount();
    render(
      <LiveMatchDisplay
        match={spiel({ status: 'FINISHED', homeScore: 10, awayScore: 9 })} finalRound boxes={WESTE_SUED_WEISS_NORD}
        finalScore={stand({ a: 10, b: 9, regular: { a: 10, b: 9 }, winner: 'a' })}
      />,
    );
    expect(masse()).toEqual(klein);
    expect(screen.getByTestId('live-box-home-digits')).toHaveTextContent('10');
    expect(screen.getByTestId('live-box-home-cup')).toBeInTheDocument();
    expect(screen.getByTestId('live-box-home-bib')).toBeInTheDocument();
  });
});
