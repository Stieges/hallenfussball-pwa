/**
 * SW (@EK-062) Monitor: „Und Monitor, Zuschauer-Seite und Finalrunde zeigen 2:3 ohne Strafstoß.“
 * Halbfinale 1 FC Nord – DJK Berg: Direkteintrag 2:2 + 4:3, wieder eröffnet, Tor DJK Berg, Abpfiff. Die Spielzeile kommt
 * aus der echten Kette (Engine → `cacheColumns` → Mapper, `ek062Halbfinale.ts`), die Folie aus `toLiveMatch`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LiveMatchDisplay } from '../../../components/monitor/LiveMatchDisplay';
import { toLiveMatch } from '../monitorMatch';
import { gespielt } from '../../../core/view/__fixtures__/ek062Halbfinale';

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

async function monitorFolie(mitTorDjkBerg: boolean) {
  const { cup, hf1 } = await gespielt(mitTorDjkBerg);
  return render(<LiveMatchDisplay match={toLiveMatch(hf1, cup.tournament.teams, cup.tournament)} />);
}

describe('@EK-062 Monitor zeigt das wiedereröffnete Halbfinale 1 mit 2:3 ohne Strafstoß', () => {
  it('@EK-062 Monitor-Folie: FC Nord 2 : 3 DJK Berg, Endstand, kein Strafstoßschießen', async () => {
    const { container } = await monitorFolie(true);
    expect(screen.getByTestId('live-block-home').textContent).toBe('2');
    expect(screen.getByTestId('live-block-away').textContent).toBe('3');
    expect(screen.getByTestId('live-name-away').textContent).toContain('DJK Berg');
    expect(screen.getByTestId('live-endstand').textContent).toBe('Endstand');
    expect(container.textContent).not.toMatch(/Strafstoß/);
  });

  it('@EK-062 Gegenbeispiel: erneut 2:2 – Monitor zeigt 2 : 2', async () => {
    await monitorFolie(false);
    expect(screen.getByTestId('live-block-home').textContent).toBe('2');
    expect(screen.getByTestId('live-block-away').textContent).toBe('2');
  });

  // Befund C-MONITOR-OHNE-STRAFSTOSS (Ziel A-36c, LiveMatchDisplay.zm147.test.tsx): `LiveMatch` trägt keinen
  // Strafstoß-Stand; die Live-Folie kann „Strafstoßschießen 4 : 3“ heute nicht zeigen – nicht SW (R-SW-C).
  it.fails('@EK-062 Gegenbeispiel: erneut 2:2 – Monitor zeigt „Strafstoßschießen 4 : 3“', async () => {
    await monitorFolie(false);
    expect(screen.getByText('Strafstoßschießen 4 : 3')).toBeTruthy();
  });
});
