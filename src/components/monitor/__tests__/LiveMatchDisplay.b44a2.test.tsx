/**
 * B-44a2 Gestaltung nach Sichtprüfung: Stand zuerst, Hinweise lesbar, Ruhe, gleiche Lage in allen Zuständen.
 * @ZM-125 · @ZM-087 · @ZM-137 · @ZM-139 · @ZM-140
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import { MatchTimer } from '../MatchTimer';
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

  it('Namenszelle genau so breit wie die Kastenzelle, oben bündig, beide gleich', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const home = screen.getByTestId('live-name-home');
    const away = screen.getByTestId('live-name-away');
    expect(home.style.width).toBe(screen.getByTestId('live-block-home').style.width);
    expect(away.style.width).toBe(screen.getByTestId('live-block-away').style.width);
    expect(home.style.alignSelf).toBe('start');
    expect(away.style.alignSelf).toBe('start');
  });

  it('Namenszeile reserviert zwei Zeilen Höhe, damit ein Umbruch nichts verschiebt', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-grid').style.gridTemplateRows).toContain(L.blockHeight);
    expect(screen.getByTestId('live-grid').style.gridTemplateRows).toContain(String(L.nameLines));
  });
});

describe('Doppelpunkt genau mittig', () => {
  it('Trenner-Zelle ist Flex mit Mitte, ohne eigene Breite (wächst nach beiden Seiten gleich)', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const sep = screen.getByTestId('live-separator');
    expect(sep.style.display).toBe('flex');
    expect(sep.style.justifyContent).toBe('center');
    expect(sep.style.justifySelf).toBe('center');
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

  it('Standard: Blau (unter 3 : 1) kräftig, Rot dezent', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(document.querySelector<HTMLElement>('[data-position="home"]')!.style.borderWidth).toBe(L.frameWidthStrong);
    expect(document.querySelector<HTMLElement>('[data-position="away"]')!.style.borderWidth).toBe(L.frameWidthSubtle);
  });

  it('Schwarz: kräftiger Rahmen, der andere Kasten bleibt dezent', () => {
    render(<LiveMatchDisplay match={createMatch()} colorScheme={{ preset: 'classic', homeColor: '#000000', awayColor: '#DC2626', useTeamColors: false }} />);
    expect(document.querySelector<HTMLElement>('[data-position="home"]')!.style.borderWidth).toBe(L.frameWidthStrong);
    expect(document.querySelector<HTMLElement>('[data-position="away"]')!.style.borderWidth).toBe(L.frameWidthSubtle);
  });
});

describe('Gleiche Lage in allen Zuständen', () => {
  it.each([
    ['laufend', createMatch(), false],
    ['Endergebnis', createMatch({ status: 'FINISHED' }), false],
    ['Kindermodus', createMatch(), true],
  ] as const)('%s: unterer Bereich mit fester Höhe, Raster mit fester Kastenzeile', (_n, match, kids) => {
    render(<LiveMatchDisplay match={match} hideScore={kids} />);
    expect(screen.getByTestId('live-lower').style.minHeight).toBe(L.lowerHeight);
    expect(screen.getByTestId('live-lower').style.paddingTop).toBe(L.lowerPaddingTop);
    expect(screen.getByTestId('live-grid').style.gridTemplateRows).toContain(L.blockHeight);
  });

  it('Kindermodus: Namen mittig über Kasten- und Namenszeile, gleiche Rasterhöhe', () => {
    render(<LiveMatchDisplay match={createMatch()} hideScore />);
    expect(screen.getByTestId('live-name-home').style.gridRow).toBe('1 / 3');
    expect(screen.getByTestId('live-name-home').style.alignSelf).toBe('center');
  });
});

describe('„ohne Ergebnis“ lesbar und mit Abstand (Kindermodus)', () => {
  it('Textfarbe statt blasser Zweitfarbe, Hinweisgröße, Abstand zum Balken', () => {
    render(<LiveMatchDisplay match={createMatch()} hideScore />);
    const el = screen.getByTestId('live-without-result');
    expect(el.style.color).toBe('rgb(255, 255, 255)');
    expect(el.style.fontSize).toBe(displayFontSizes.clockHint);
    expect(el.style.marginTop).toBe(L.hintGapAbove);
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

  it('Gegenbeispiel: ohne Hinweis keine leere Gruppe', () => {
    render(<MatchTimer elapsedSeconds={10} durationSeconds={360} status="RUNNING" timerStartTime={new Date().toISOString()} timerElapsedSeconds={10} clockMode="immer-durchlaufend" size="xl" />);
    expect(screen.queryByTestId('clock-hints')).toBeNull();
  });
});
