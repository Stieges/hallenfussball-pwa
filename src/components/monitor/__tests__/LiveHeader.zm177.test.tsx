/**
 * R5 PR 3, @ZM-177: bei nur einer Gruppe steht am Monitor keine Gruppenangabe, nirgends „Gruppe all“;
 * Gegenprobe: bei zwei Gruppen steht „Gruppe A“ (Testumgebung gibt den Schlüssel zurück).
 * Mutation: Prüfung `isSingleGroupId` in `LiveHeader` entfernen → erster und zweiter Test rot.
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

describe('@ZM-177 Gruppenangabe in der Kopfzeile der Live-Folie', () => {
  it.each(['all', '', undefined])('Gruppe %j (eine Gruppe, Jeder gegen jeden): Kopfzeile ohne Gruppenangabe', (group) => {
    const { container } = render(<LiveMatchDisplay match={createMatch({ group })} />);
    expect(screen.getByTestId('live-group').textContent).toBe('');
    expect(container.textContent ?? '').not.toMatch(/\ball\b|liveMatch\.group/);
  });

  it('Gegenprobe: bei „A“ (mehrere Gruppen) steht die Gruppenangabe', () => {
    render(<LiveMatchDisplay match={createMatch({ group: 'A' })} />);
    expect(screen.getByTestId('live-group').textContent).toBe('monitor:liveMatch.group');
  });

  it('Gruppenname von außen (group-Prop „all“) wird ebenfalls nicht gezeigt', () => {
    render(<LiveMatchDisplay match={createMatch({ group: 'A' })} group="all" />);
    expect(screen.getByTestId('live-group').textContent).toBe('');
  });
});
