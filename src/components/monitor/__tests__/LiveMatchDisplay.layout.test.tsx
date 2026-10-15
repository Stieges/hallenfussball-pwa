/**
 * @ZM-140 Farben und Kontrast · Raster Kasten | Trenner | Kasten, Namen mittig unter ihrem Kasten
 * @ZM-125 / @ZM-087 Lesbarkeit · Kindermodus ohne leere Kästen (@W2A-031)
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';
import de from '../../../i18n/locales/de/monitor.json';

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

describe('@ZM-140 Raster: Kasten | Trenner | Kasten, Namen unter ihrem Kasten', () => {
  it('Heim-Name liegt in derselben Spalte wie der Heim-Kasten, Gast ebenso', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const grid = screen.getByTestId('live-grid');
    expect(grid.style.gridTemplateColumns).toMatch(/minmax\(0,\s?1fr\)\s\S+\sminmax\(0,\s?1fr\)/);
    expect(screen.getByTestId('live-block-home').style.gridColumn).toBe('1');
    expect(screen.getByTestId('live-name-home').style.gridColumn).toBe('1');
    expect(screen.getByTestId('live-block-away').style.gridColumn).toBe('3');
    expect(screen.getByTestId('live-name-away').style.gridColumn).toBe('3');
  });

  it('Namen stehen im selben Raster wie die Kästen, nicht in einer eigenen Reihe (Gegenbeispiel)', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const grid = screen.getByTestId('live-grid');
    expect(screen.getByTestId('live-name-home').parentElement).toBe(grid);
    expect(screen.getByTestId('live-block-home').parentElement).toBe(grid);
  });

  it('Trenner steht in der Mitte', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-separator').style.gridColumn).toBe('2');
  });

  it('Namen zentriert unter ihrem Kasten', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    expect(screen.getByTestId('live-name-home').style.justifySelf).toBe('center');
  });
});

describe('Kindermodus ohne Stand (@W2A-031)', () => {
  it('keine leeren Kästen, kein Trenner, Namen bleiben in den Spalten 1 und 3', () => {
    render(<LiveMatchDisplay match={createMatch()} hideScore />);
    expect(document.querySelector('[data-position]')).toBeNull();
    expect(screen.queryByTestId('live-separator')).toBeNull();
    expect(screen.getByTestId('live-name-home').style.gridColumn).toBe('1');
    expect(screen.getByTestId('live-name-away').style.gridColumn).toBe('3');
  });

  it('klein „ohne Ergebnis“ unter der Uhr', () => {
    render(<LiveMatchDisplay match={createMatch()} hideScore />);
    expect(screen.getByText(/liveMatch\.withoutResult/)).toBeInTheDocument();
    expect(de.liveMatch.withoutResult).toBe('ohne Ergebnis');
  });
});

describe('@ZM-140 Kasten-Rahmen und Gruppen-Text', () => {
  it('Schwarzer Kasten bekommt einen hellen Rahmen', () => {
    render(<LiveMatchDisplay match={createMatch()} colorScheme={{ preset: 'classic', homeColor: '#000000', awayColor: '#DC2626', useTeamColors: false }} />);
    expect(document.querySelector('[data-position="home"]')).toHaveStyle({ borderStyle: 'solid' });
  });

  it('Gelber Kasten bekommt keinen Rahmen', () => {
    render(<LiveMatchDisplay match={createMatch()} colorScheme={{ preset: 'classic', homeColor: '#FDE047', awayColor: '#DC2626', useTeamColors: false }} />);
    expect(document.querySelector('[data-position="home"]')).not.toHaveStyle({ borderStyle: 'solid' });
  });

  it('Gruppe läuft über i18n', () => {
    render(<LiveMatchDisplay match={createMatch({ group: 'A' })} />);
    expect(screen.getByText(/liveMatch\.group/)).toBeInTheDocument();
    expect(de.liveMatch.group).toBe('Gruppe {{group}}');
  });
});
