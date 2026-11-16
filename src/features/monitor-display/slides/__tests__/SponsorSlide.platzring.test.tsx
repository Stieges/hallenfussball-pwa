/**
 * @OB-038 „die Plätze 1 bis 3 auf der Sponsor-Folie des Monitors“ → die Platzzahl in einem Ring in der Farbe des Platzes, ohne Medaillen-Bild.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('qrcode.react', () => ({ QRCodeSVG: () => <div data-testid="qr-code" /> }));

import { SponsorSlide } from '../SponsorSlide';
import { cssVars, displayFinal } from '../../../../design-tokens';
import { OHNE_EMOJI } from '../../../../test/symbolText';
import type { Tournament } from '../../../../types/tournament';
import type { MonitorSlide, MonitorTheme, PerformanceSettings } from '../../../../types/monitor';

const PERF: PerformanceSettings = {
  enableTransitions: false, enableAnimations: false, enableGlow: false, enableBackgroundEffects: false, pollingInterval: 1000,
};

/** jsdom schreibt Hex-Farben als rgb(…) zurück: die Erwartung wird über ein Element gleich umgerechnet. */
const alsRgb = (farbe: string): string => {
  const el = document.createElement('i');
  el.style.borderColor = farbe;
  return el.style.borderColor;
};

function zeige(tier: string, theme: MonitorTheme = 'dark') {
  const tournament = { id: 't1', title: 'Cup', isPublic: true, shareCode: 'ABC123', sponsors: [{ id: 'sp1', name: 'Bäckerei Huber', tier }] } as unknown as Tournament;
  const slide = { id: 's1', type: 'sponsor', duration: null, order: 0, config: { sponsorId: 'sp1' } } as unknown as MonitorSlide;
  return render(<SponsorSlide slide={slide} tournament={tournament} performanceSettings={PERF} theme={theme} style={{}} />);
}

describe('@OB-038 Sponsor-Folie: Platzzahl im Ring', () => {
  it.each([
    ['gold', '1', displayFinal.gold.dark],
    ['silver', '2', cssVars.colors.medalSilver],
    ['bronze', '3', cssVars.colors.medalBronze],
  ] as const)('%s: Zahl %s im Ring in der Farbe des Platzes, ohne Medaillen-Bild', (tier, zahl, farbe) => {
    const { container } = zeige(tier);
    const ring = screen.getByTestId('sponsor-tier-ring');
    expect(ring).toHaveTextContent(new RegExp(`^${zahl}$`));
    expect(ring.style.borderColor).toBe(alsRgb(farbe));
    expect(ring.style.borderRadius).toBe(cssVars.borderRadius.full);
    expect(container.textContent).not.toMatch(OHNE_EMOJI);
    expect(container.textContent).toContain('slides.sponsor.tier');
  });

  it('Gold trägt im hellen Thema das dunklere Gold (Kontrast auf hellem Grund), wie die Endstand-Folie', () => {
    zeige('gold', 'light');
    expect(screen.getByTestId('sponsor-tier-ring').style.borderColor).toBe(alsRgb(displayFinal.gold.light));
  });
});
