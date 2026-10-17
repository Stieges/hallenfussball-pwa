/**
 * A-25a Monitor-Probe L3 (@ZM-147, Record zuschauer-und-monitor): „Ist nur das Ergebnis eingetragen, zeigt der Monitor den
 * Endstand ohne Verlauf … Dann zeigt er 2:2, ‚Strafstoßschießen 4 : 3‘ und FC Nord als Sieger, wie nach einem geleiteten
 * Spiel. Und er zeigt keine Schützen-Punktreihen und keine Torschützen, statt leerer Reihen.“
 * Halbfinale 1 (FC Nord – SV Süd) nur per Direkteintrag: keine Ereignisse.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../LiveMatchDisplay';
import type { LiveMatch } from '../../../hooks/useLiveMatches';

vi.unmock('i18next'); vi.unmock('react-i18next'); // echte DE-Texte
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

/** Halbfinale 1 nur eingetragen: 2:2, Strafstoßschießen 4:3 für FC Nord, kein einziges Ereignis. */
const halbfinale1: LiveMatch = {
  id: 'hf1', number: 13, phaseLabel: 'Halbfinale 1', fieldId: 'f1', field: 1,
  scheduledKickoff: new Date().toISOString(), homeTeam: { id: 'nord', name: 'FC Nord' },
  awayTeam: { id: 'sued', name: 'SV Süd' }, homeScore: 2, awayScore: 2,
  status: 'FINISHED', elapsedSeconds: 0, durationSeconds: 600, events: [],
};

describe('@ZM-147 Monitor: nur eingetragenes Ergebnis, Endstand ohne Verlauf', () => {
  it('@ZM-147 keine Schützen-Punktreihen und keine Torschützen, statt leerer Reihen', () => {
    const { container } = render(<LiveMatchDisplay match={halbfinale1} />);
    expect(container.querySelector('[data-testid*="shootout"], [data-testid*="scorer"], [data-testid*="kick"]')).toBeNull();
    expect(screen.queryByText(/Torschütze|Schütze/)).toBeNull();
    expect(screen.getByTestId('live-endstand').textContent).toBe('Endstand');
  });

  // Befund-Vorschlag C-MONITOR-OHNE-STRAFSTOSS (Ziel A-36c, Monitor liest die Ansicht): `LiveMatch` trägt keinen
  // Strafstoß-Stand und keinen Sieger; die Live-Folie kann „Strafstoßschießen 4 : 3“ heute nicht zeigen.
  it.fails('@ZM-147 zeigt 2:2, „Strafstoßschießen 4 : 3“ und FC Nord als Sieger', () => {
    render(<LiveMatchDisplay match={halbfinale1} />);
    expect(screen.getByText('Strafstoßschießen 4 : 3')).toBeTruthy();
  });
});
