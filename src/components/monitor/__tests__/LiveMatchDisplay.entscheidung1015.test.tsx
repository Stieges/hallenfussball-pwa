/**
 * Entscheidungen Daniel 2026-10-15 zur Live-Folie: (1) beide Kästen gleich breiter Rahmen, (2) „Endstand“ bei beendetem Spiel.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';

vi.unmock('i18next'); vi.unmock('react-i18next'); // B-41: echte Texte
await (await import('../../../test/realDeI18n')).initRealDeI18n();

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

function blockOf(position: 'home' | 'away'): HTMLElement {
  return document.querySelector<HTMLElement>(`[data-position="${position}"]`)!;
}

describe('Gleich breiter Rahmen beider Kästen', () => {
  it('Standardfarben Blau und Rot: gemessene Rahmenbreite beider Kästen ist gleich und aus dem Token', () => {
    render(<LiveMatchDisplay match={createMatch()} />);
    const home = blockOf('home').style.borderWidth;
    const away = blockOf('away').style.borderWidth;
    expect(home).not.toBe('');
    expect(home).toBe(away);
  });

  it('Gegenbeispiel: ein dunkler Kasten (schwarz) macht auch den hellen Rahmen kräftig, Breite bleibt gleich', () => {
    render(<LiveMatchDisplay match={createMatch()} colorScheme={{ preset: 'custom', homeColor: '#000000', awayColor: '#FDE047', useTeamColors: false }} />);
    expect(blockOf('home').style.borderWidth).toBe(blockOf('away').style.borderWidth);
  });
});

describe('„Endstand“ bei beendetem Spiel', () => {
  it('beendet: „Endstand“ steht an der Stelle der Uhr, im festen unteren Bereich', () => {
    render(<LiveMatchDisplay match={createMatch({ status: 'FINISHED' })} />);
    const text = screen.getByTestId('live-endstand');
    expect(text.textContent).toBe('Endstand');
    expect(screen.getByTestId('live-lower').contains(text)).toBe(true);
  });

  it.each(['RUNNING', 'PAUSED', 'NOT_STARTED'] as const)('Gegenbeispiel: bei Status %s steht kein „Endstand“', (status) => {
    render(<LiveMatchDisplay match={createMatch({ status })} />);
    expect(screen.queryByTestId('live-endstand')).toBeNull();
    expect(screen.queryByText('Endstand')).toBeNull();
  });
});
