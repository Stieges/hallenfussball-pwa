/**
 * @ZM-151 Die Ergebniskästen auf dem Monitor springen nicht, wenn sich der Zustand des Spiels ändert.
 * Verhaltenstest ohne Layout-Engine: Größe und Lage der Kästen kommen aus den Inline-Stilen von Zelle, Kasten und Raster; diese
 * müssen in jedem Zustand (wartet, läuft, Pause, Ende regulär, Ende mit Verlängerung, Ende nach Strafstoß, 50-Zeichen-Name) identisch sein.
 * Die gemessene Geometrie steht in `tests/e2e/flows/zm151-kaesten.spec.ts`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';

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

function createMatch(overrides: Partial<LiveMatch> = {}): LiveMatch {
  return {
    id: 'm1', number: 11, phaseLabel: 'Gruppe A', fieldId: 'f1', field: 1,
    scheduledKickoff: new Date().toISOString(), homeTeam: { id: 't1', name: 'SV Blau-Weiß Kiel' },
    awayTeam: { id: 't2', name: 'TSV Eintracht Nord' }, homeScore: 2, awayScore: 1,
    status: 'RUNNING', elapsedSeconds: 100, durationSeconds: 600, events: [], group: 'A',
    ...overrides,
  };
}

import type { FinalScore } from '../../../core/view';

const LANG = 'Sportgemeinschaft Fußballfreunde Nordheim-Süd 1921';
const ENDE: Pick<FinalScore, 'decidedBy' | 'winner'> = { decidedBy: 'regular', winner: 'a' };
const stand = (extra: Partial<FinalScore>): FinalScore => ({ a: 2, b: 2, regular: { a: 2, b: 2 }, ...ENDE, ...extra });

/** Alles, was Größe und Lage der Kästen bestimmt: Raster, Zelle, Kasten, Trenner. */
function kastenStile() {
  const zelle = (s: string) => screen.getByTestId(`live-block-${s}`);
  const kasten = (s: string) => screen.getByTestId(`live-box-${s}`);
  const pick = (el: HTMLElement, keys: string[]) => keys.map((k) => `${k}=${(el.style as unknown as Record<string, string>)[k]}`).join(';');
  return {
    raster: pick(screen.getByTestId('live-grid'), ['gridTemplateColumns', 'gridTemplateRows', 'columnGap', 'rowGap', 'width']),
    home: pick(zelle('home'), ['gridRow', 'gridColumn', 'width', 'height', 'justifySelf']) + '|' + pick(kasten('home'), ['width', 'height', 'boxSizing', 'borderWidth']),
    away: pick(zelle('away'), ['gridRow', 'gridColumn', 'width', 'height', 'justifySelf']) + '|' + pick(kasten('away'), ['width', 'height', 'boxSizing', 'borderWidth']),
    trenner: pick(screen.getByTestId('live-separator'), ['gridRow', 'gridColumn', 'width']),
  };
}

const ZUSTAENDE: Array<[string, Partial<LiveMatch>, FinalScore | undefined]> = [
  ['wartet', { status: 'NOT_STARTED', homeScore: 0, awayScore: 0 }, undefined],
  ['läuft', {}, undefined],
  ['Pause', { status: 'PAUSED' }, undefined],
  ['Ende regulär', { status: 'FINISHED', homeScore: 3, awayScore: 1 }, stand({ a: 3, b: 1, regular: { a: 3, b: 1 } })],
  ['Ende nach Verlängerung', { status: 'FINISHED', homeScore: 2, awayScore: 1 }, stand({ a: 2, b: 1, regular: { a: 1, b: 1 }, overtime: { a: 1, b: 0 }, decidedBy: 'overtime' })],
  ['Ende nach Strafstoß', { status: 'FINISHED', homeScore: 2, awayScore: 2 }, stand({ penalty: { a: 4, b: 3 }, decidedBy: 'penalty' })],
  ['Ende nach Strafstoß, Gast gewinnt', { status: 'FINISHED', homeScore: 2, awayScore: 2 }, stand({ penalty: { a: 3, b: 4 }, decidedBy: 'penalty', winner: 'b' })],
  ['Ende nach Strafstoß, 50-Zeichen-Verlierer', { status: 'FINISHED', homeScore: 2, awayScore: 2, awayTeam: { id: 't2', name: LANG } }, stand({ penalty: { a: 4, b: 3 }, decidedBy: 'penalty' })],
];

describe('@ZM-151 Ergebniskästen: ein Raster für alle Zustände', () => {
  it.each(ZUSTAENDE)('%s: Raster, Zellen, Kästen und Trenner wie bei „läuft“', (_name, uebersteuert, finalScore) => {
    const { unmount } = render(<LiveMatchDisplay match={createMatch()} />);
    const bezug = kastenStile();
    unmount();
    render(<LiveMatchDisplay match={createMatch(uebersteuert)} finalScore={finalScore} />);
    expect(kastenStile()).toEqual(bezug);
  });

  it('Gegenbeispiel: Ende ohne Strafstoßschießen hat dieselben Kästen wie Ende mit Strafstoßschießen', () => {
    const ohne = ZUSTAENDE[3];
    const mit = ZUSTAENDE[5];
    const { unmount } = render(<LiveMatchDisplay match={createMatch(ohne[1])} finalScore={ohne[2]} />);
    const a = kastenStile();
    unmount();
    render(<LiveMatchDisplay match={createMatch(mit[1])} finalScore={mit[2]} />);
    expect(kastenStile()).toEqual(a);
    expect(screen.getByTestId('live-penalty-block')).toBeInTheDocument();
  });

  it('@ZM-156 der Sieger-Ring ist eine Outline (ändert die Größe nicht), der Pokal-Kreis (Finalrunde) liegt absolut über dem Kasten', () => {
    render(<LiveMatchDisplay match={createMatch(ZUSTAENDE[5][1])} finalScore={ZUSTAENDE[5][2]} finalRound />);
    const kasten = screen.getByTestId('live-box-home');
    expect(kasten.style.outlineStyle).toBe('solid');
    expect(kasten.style.borderWidth).toBe(screen.getByTestId('live-box-away').style.borderWidth);
    expect(screen.getByTestId('live-box-home-cup').style.position).toBe('absolute');
  });

  it('@ZM-156 Gegenbeispiel: Gruppenspiel mit Sieger hat den Ring (Outline), aber keinen Pokal; die Kästen bleiben gleich', () => {
    const { unmount } = render(<LiveMatchDisplay match={createMatch(ZUSTAENDE[3][1])} finalScore={ZUSTAENDE[3][2]} finalRound />);
    const finale = kastenStile();
    unmount();
    render(<LiveMatchDisplay match={createMatch(ZUSTAENDE[3][1])} finalScore={ZUSTAENDE[3][2]} />);
    expect(screen.getByTestId('live-box-home').style.outlineStyle).toBe('solid');
    expect(screen.queryByTestId('live-box-home-cup')).toBeNull();
    expect(kastenStile()).toEqual(finale);
  });
});
