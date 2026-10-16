/**
 * B-44a2 Gestaltung nach Sichtprüfung: Stand zuerst, Hinweise lesbar, Ruhe, gleiche Lage in allen Zuständen.
 * @ZM-125 · @ZM-087 · @ZM-137 · @ZM-139 · @ZM-140
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import { MatchTimer } from '../MatchTimer';
import { TeamNameDisplay } from '../TeamNameDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';
import { displayFontSizes, displayLayout, monitorThemes } from '../../../design-tokens';
import { getContrastRatio } from '../../../design-tokens/display';

vi.mock('../../../hooks', () => ({
  useMonitorTheme: vi.fn(() => ({
    resolvedTheme: 'dark',
    themeColors: {
      text: '#FFFFFF', textSecondary: '#A0A0A0', textMuted: '#666666', background: '#0A0A14',
      backgroundGradient: 'linear-gradient(180deg, #0a0a0f 0%, #1a1a2e 100%)', surface: '#1a1a2e',
      border: '#2a2a4e', borderActive: '#00E676', liveBadgeBg: 'rgba(0,230,118,0.2)', liveBadgeText: '#00E676',
      pauseBadgeBg: 'rgba(255,193,7,0.2)', pauseBadgeText: '#FFC107', glow: '', glowActive: '',
      textShadow: '', textShadowLight: '', textShadowScore: '', progressTrack: '#222', progressInsetShadow: '',
      progressBar: '#00E676', progressShadow: '', timerNormal: '#fff', timerOvertime: '#f00', timerPaused: '#fa0',
      timerSecondary: '#aaa', timerSeparator: '#888', timerWarning: '#fa0', progressBarWarning: '#fa0',
      progressShadowWarning: '', overtimeBadgeBg: '', glowActiveTitle: '',
    },
  })),
}));

const L = displayLayout.scoreArea;

function createMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1', number: 11, phaseLabel: 'Gruppe A', fieldId: 'f1', field: 1,
    scheduledKickoff: new Date().toISOString(), homeTeam: { id: 't1', name: 'SV Blau-Weiß Kiel' },
    awayTeam: { id: 't2', name: 'TSV Eintracht Nord' }, homeScore: 2, awayScore: 1,
    status: 'RUNNING', elapsedSeconds: 100, durationSeconds: 600, events: [], group: 'A',
    ...overrides,
  };
}

describe('Kasten hoch und Namen in Kastenbreite', () => {
  it('Kasten-Zelle hat die Höhe aus dem Token (nicht von der Trenner-Schrift bestimmt)', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-block-home').style.height).toBe(L.blockHeight);
    expect(screen.getByTestId('live-block-away').style.height).toBe(L.blockHeight);
  });

  // B-44a4 (Ruling 16.10., @ZM-087): Namenszelle wieder breiter als der Kasten, beide gleich
  it('Namenszelle breiter als die Kastenzelle, oben bündig, beide gleich', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const home = screen.getByTestId('live-name-home');
    const away = screen.getByTestId('live-name-away');
    expect(home.style.width).toBe(L.teamNameWidth);
    expect(away.style.width).toBe(L.teamNameWidth);
    expect(parseFloat(home.style.width)).toBeGreaterThan(parseFloat(screen.getByTestId('live-block-home').style.width));
    expect(home.style.alignSelf).toBe('start');
    expect(away.style.alignSelf).toBe('start');
  });

  it('Namenszeile reserviert zwei Zeilen Höhe, damit ein Umbruch nichts verschiebt', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-grid').style.gridTemplateRows).toContain(L.blockHeight);
    expect(screen.getByTestId('live-grid').style.gridTemplateRows).toContain(String(L.nameLines));
  });
});

describe('Namen im Normalmodus', () => {
  it('Vorgabe der Namensgröße ist das Token teamName, bei beiden gleich', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-name-home').firstElementChild).toHaveAttribute('data-fit-vorgabe', displayFontSizes.teamName);
    expect(screen.getByTestId('live-name-away').firstElementChild).toHaveAttribute('data-fit-vorgabe', displayFontSizes.teamName);
  });
});

describe('Namen im Kindermodus groß', () => {
  it('TeamNameDisplay nimmt die Schriftgröße aus dem Token', () => {
    render(<TeamNameDisplay name="TuS Holm" size="md" fontSize={displayFontSizes.teamNameKids} />);
    expect(screen.getByText('TuS Holm').style.fontSize).toBe(displayFontSizes.teamNameKids);
  });
});

describe('Doppelpunkt genau mittig', () => {
  it('Trenner-Zelle ist Flex mit Mitte, ohne eigene Breite (wächst nach beiden Seiten gleich)', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const sep = screen.getByTestId('live-separator');
    expect(sep.style.display).toBe('flex');
    expect(sep.style.justifyContent).toBe('center');
    expect(sep.style.justifySelf).toBe('center');
    expect(parseFloat(sep.style.width)).toBe(0);
  });
});

describe('Rahmenlogik einheitlich', () => {
  it('Rot und Gelb: beide Kästen mit demselben dezenten Rahmen', () => {
    render(<LiveMatchDisplay match={createMatch()} colorScheme={{ preset: 'classic', homeColor: '#FDE047', awayColor: '#DC2626', useTeamColors: false }} />);
    const home = document.querySelector<HTMLElement>('[data-position="home"]')!;
    const away = document.querySelector<HTMLElement>('[data-position="away"]')!;
    expect(home.style.borderStyle).toBe('solid');
    expect(away.style.borderStyle).toBe('solid');
    expect(home.style.borderWidth).toBe(L.frameWidthSubtle);
    expect(away.style.borderWidth).toBe(L.frameWidthSubtle);
  });

  it('Standard: Blau (unter 3 : 1) macht beide Rahmen kräftig (gleiche Breite, Entscheidung 2026-10-15)', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(document.querySelector<HTMLElement>('[data-position="home"]')!.style.borderWidth).toBe(L.frameWidthStrong);
    expect(document.querySelector<HTMLElement>('[data-position="away"]')!.style.borderWidth).toBe(L.frameWidthStrong);
  });

  it('Schwarz: kräftiger Rahmen, der andere Kasten bekommt dieselbe Breite', () => {
    render(<LiveMatchDisplay match={createMatch()} colorScheme={{ preset: 'classic', homeColor: '#000000', awayColor: '#DC2626', useTeamColors: false }} />);
    expect(document.querySelector<HTMLElement>('[data-position="home"]')!.style.borderWidth).toBe(L.frameWidthStrong);
    expect(document.querySelector<HTMLElement>('[data-position="away"]')!.style.borderWidth).toBe(L.frameWidthStrong);
  });
});

describe('Gleiche Lage in allen Zuständen', () => {
  it.each([
    ['laufend', createMatch(), false],
    ['Endergebnis', createMatch({ status: 'FINISHED' }), false],
    ['Kindermodus', createMatch(), true],
  ] as const)('%s: unterer Bereich mit fester Höhe, Raster mit fester Kastenzeile', (_n, match, kids) => {
    render(<LiveMatchDisplay match={match} hideScore={kids} />);
    expect(screen.getByTestId('live-lower').style.height).toBe(L.lowerHeight);
    expect(screen.getByTestId('live-lower').style.paddingTop).toBe(L.lowerPaddingTop);
    expect(screen.getByTestId('live-grid').style.gridTemplateRows).toContain(L.blockHeight);
  });

  it('Kindermodus: Namen groß in der Kastenreihe, gleiche Rasterhöhe', () => {
    render(<LiveMatchDisplay match={createMatch()} hideScore />);
    expect(screen.getByTestId('live-name-home').style.gridRow).toBe('1');
    // B4: die Größe kommt im gerenderten Kindermodus wirklich beim Namen an (Vorgabe des Anpassens)
    expect(screen.getByTestId('live-name-home').firstElementChild).toHaveAttribute('data-fit-vorgabe', displayFontSizes.teamNameKids);
    expect(screen.getByTestId('live-name-away').firstElementChild).toHaveAttribute('data-fit-vorgabe', displayFontSizes.teamNameKids);
    expect(screen.getByTestId('live-name-home').style.alignSelf).toBe('start');
    expect(screen.getByTestId('live-name-away').style.alignSelf).toBe('start');
    expect(screen.getByTestId('live-name-home').style.marginTop).toBe(L.kidsNamesOffset);
  });
});

describe('„ohne Ergebnis“ lesbar und mit Abstand (Kindermodus)', () => {
  it('Textfarbe statt blasser Zweitfarbe, Hinweisgröße, in der Namenszeile (unter den großen Namen)', () => {
    render(<LiveMatchDisplay match={createMatch()} hideScore />);
    const el = screen.getByTestId('live-without-result');
    expect(el.style.color).toBe('rgb(255, 255, 255)');
    expect(el.style.fontSize).toBe(displayFontSizes.clockHint);
    expect(el.style.gridRow).toBe('2');
  });
  it('Kontrast der echten Theme-Werte (Text auf Hintergrund) ≥ 4,5 : 1', () => {
    for (const t of [monitorThemes.dark, monitorThemes.light]) {
      expect(getContrastRatio(t.text, t.background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('Hinweise unter der Uhr (@ZM-137)', () => {
  const props = { elapsedSeconds: 300, durationSeconds: 360, status: 'PAUSED', timerElapsedSeconds: 300, size: 'xl' } as const;

  it('gesetzt in Hinweisgröße (≥ 3 % Bildhöhe), kompakt, in einer gemeinsamen Gruppe', () => {
    render(<MatchTimer {...props} />);
    const group = screen.getByTestId('clock-hints');
    expect(group.children.length).toBe(2);
    for (const hint of Array.from(group.children) as HTMLElement[]) {
      expect(hint.style.fontSize).toBe(displayFontSizes.clockHint);
    }
    expect(parseFloat(group.style.lineHeight)).toBeLessThanOrEqual(1.3);
    expect(group.style.rowGap).toBe(L.hintGap);
  });

  it('Abstand zwischen Uhr und Hinweisen', () => {
    render(<MatchTimer {...props} />);
    expect(screen.getByTestId('clock-hints').style.marginTop).toBe(L.hintGapAbove);
  });

  it('abgelaufen ohne Abpfiff: Hinweis ebenfalls in Hinweisgröße', () => {
    render(<MatchTimer elapsedSeconds={400} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={400} size="xl" />);
    const group = screen.getByTestId('clock-hints');
    expect((group.children[0] as HTMLElement).style.fontSize).toBe(displayFontSizes.clockHint);
  });

  it('Hinweiszeile darf nie umbrechen (absolut, nicht nur im Vergleich der Zustände)', () => {
    render(<MatchTimer {...props} />);
    const group = screen.getByTestId('clock-hints');
    expect(group.style.flexWrap).toBe('nowrap');
    expect(group.style.whiteSpace).toBe('nowrap');
  });

  it('ohne Hinweis bleibt die Hinweiszeile als leere Zeile fester Höhe stehen (Lage ändert sich nie)', () => {
    render(<MatchTimer elapsedSeconds={10} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={10} clockMode="immer-durchlaufend" size="xl" />);
    const group = screen.getByTestId('clock-hints');
    expect(group.children.length).toBe(0);
    expect(group.style.minHeight).not.toBe('');
  });
});

// ---------------------------------------------------------------------------
// Festes Raster: Zeilen liegen in jedem Zustand an denselben Stellen (Controller-Zusatz, Daniel: „uneinheitlich“)
// jsdom hat kein Layout; verglichen werden deshalb alle Stile, die Lage und Höhe der Zeilen bestimmen.
// Die gemessenen Oberkanten im Browser (± 1 %) prüft das Sichtnachweis-Skript (b44a2-shots.mjs).
// ---------------------------------------------------------------------------
const ZUSTAENDE: ReadonlyArray<readonly [string, Partial<LiveMatch>, boolean]> = [
  ['laufend', {}, false],
  ['Schlussphase', { elapsedSeconds: 550, timerElapsedSeconds: 550, status: 'PAUSED' }, false],
  ['angehalten', { status: 'PAUSED', elapsedSeconds: 300, timerElapsedSeconds: 300 }, false],
  ['abgelaufen', { elapsedSeconds: 700, timerElapsedSeconds: 700 }, false],
  ['Endergebnis', { status: 'FINISHED' }, false],
  ['zweistellig', { homeScore: 12 }, false],
  ['Kindermodus', {}, true],
  ['lange Namen', { awayTeam: { id: 't2', name: 'Sportgemeinschaft Fortuna Nordheim-Süd 1921 e. V. 2' } }, false],
];
const LAGE_IDS = ['live-header', 'live-badge', 'live-grid', 'live-lower'] as const;

function signatur(match: Partial<LiveMatch>, kids: boolean): Record<string, string> {
  const { unmount } = render(<LiveMatchDisplay match={createMatch(match)} hideScore={kids} />);
  const sig: Record<string, string> = {};
  for (const id of LAGE_IDS) {
    const s = screen.getByTestId(id).style;
    sig[id] = [s.height, s.minHeight, s.width, s.gridTemplateRows, s.gridTemplateColumns, s.marginBottom, s.paddingTop].join('|');
  }
  sig.nameHome = screen.getByTestId('live-name-home').style.width;
  const clock = screen.queryByTestId('monitor-clock');
  sig.clock = clock ? [clock.style.padding, (clock.firstElementChild as HTMLElement).style.fontSize, (clock.firstElementChild as HTMLElement).style.lineHeight].join('|') : 'keine Uhr';
  const hints = screen.queryByTestId('clock-hints');
  sig.hints = hints ? [hints.style.minHeight, hints.style.marginTop, hints.style.flexWrap].join('|') : 'keine Hinweiszeile';
  unmount();
  return sig;
}

describe('Festes Raster: gleiche Lage in allen Zuständen', () => {
  const base = signatur({}, false);
  it.each(ZUSTAENDE)('%s: Kopfzeile, Marke, Rasterzeilen, unterer Bereich wie im Normalfall', (_n, match, kids) => {
    const sig = signatur(match, kids);
    for (const id of [...LAGE_IDS, 'nameHome'] as const) { expect(sig[id]).toBe(base[id]); }
  });

  it.each(ZUSTAENDE.filter(([n]) => n !== 'Endergebnis'))('%s: Uhr und Hinweiszeile haben dieselben Maße (Hervorhebung nur über Füllung)', (_n, match, kids) => {
    const sig = signatur(match, kids);
    expect(sig.clock).toBe(base.clock);
    expect(sig.hints).toBe(base.hints);
  });

  it('Hervorhebung nur über die Füllung: gleiche Polsterung mit und ohne Hervorhebung', () => {
    const a = signatur({}, false).clock;
    const b = signatur({ status: 'PAUSED', elapsedSeconds: 300, timerElapsedSeconds: 300 }, false).clock;
    expect(a).toBe(b);
  });

  it('Marke: dieselbe Breite für LIVE, PAUSE und BEENDET', () => {
    const widths = (['RUNNING', 'PAUSED', 'FINISHED'] as const).map((status) => {
      const { unmount } = render(<LiveMatchDisplay match={createMatch({ status })} />);
      const w = screen.getByTestId('live-badge').style.width;
      unmount();
      return w;
    });
    expect(new Set(widths).size).toBe(1);
    expect(widths[0]).toBe(L.badgeWidth);
  });

  it('Kopfzeile ist ein Raster mit drei Spalten, auch ohne Gruppe', () => {
    render(<LiveMatchDisplay match={createMatch({ group: undefined })} />);
    expect(screen.getByTestId('live-header').style.gridTemplateColumns).toBe('1fr auto 1fr');
  });
});

describe('B2 Kopfzeile und Marke wachsen mit der Bildhöhe (keine festen Pixel)', () => {
  it('Feld/Spiel, Gruppe und Marke in den Tokens liveInfo und liveBadge', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-info').style.fontSize).toBe(displayFontSizes.liveInfo);
    expect(screen.getByTestId('live-group').style.fontSize).toBe(displayFontSizes.liveInfo);
    expect(screen.getByTestId('live-badge').style.fontSize).toBe(displayFontSizes.liveBadge);
    expect(screen.getByTestId('live-separator').style.fontSize).toBe(displayFontSizes.liveSeparator);
  });
});

describe('B1 Schiedsrichter-Zeile im festen Raster', () => {
  it('liegt im reservierten unteren Bereich, nicht als zusätzlicher Footer', () => {
    render(<LiveMatchDisplay match={createMatch({ refereeName: 'SR1' })} />);
    const ref = screen.getByTestId('live-referee');
    expect(screen.getByTestId('live-lower')).toContainElement(ref);
    expect(ref).toHaveTextContent('liveMatch.referee');
    expect(ref.style.fontSize).toBe(displayFontSizes.clockHint);
  });

  it('Gegenbeispiel: ohne Schiedsrichter keine Zeile, die Lage bleibt (Höhe des unteren Bereichs fest)', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.queryByTestId('live-referee')).toBeNull();
    expect(screen.getByTestId('live-lower').style.height).toBe(L.lowerHeight);
  });

  it('mit Schiedsrichter gleiche Rasterstile wie ohne', () => {
    const a = signatur({}, false);
    const b = signatur({ refereeName: 'SR1' }, false);
    for (const id of [...LAGE_IDS, 'nameHome', 'clock', 'hints'] as const) { expect(b[id]).toBe(a[id]); }
  });
});
