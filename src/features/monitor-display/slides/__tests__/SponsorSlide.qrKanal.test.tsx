/**
 * @RZ-029 Sponsor-Folie: zeigt der QR ersatzweise auf die Zuschauer-Seite, trägt er den Kanal QR (`?k=q`); eine Sponsor-Adresse bleibt
 * unverändert (wir zählen nur die eigene Seite).
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('qrcode.react', () => ({
  QRCodeSVG: (props: { value: string }) => <div data-testid="qr-code" data-value={props.value} />,
}));

import { SponsorSlide } from '../SponsorSlide';
import type { Tournament } from '../../../../types/tournament';
import type { MonitorSlide, PerformanceSettings } from '../../../../types/monitor';

const PERF: PerformanceSettings = {
  enableTransitions: false, enableAnimations: false, enableGlow: false, enableBackgroundEffects: false, pollingInterval: 1000,
};

function zeige(config: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const tournament = {
    id: 't1', title: 'Cup', isPublic: true, shareCode: 'ABC123',
    sponsors: [{ id: 'sp1', name: 'Bäckerei Huber', tier: 'gold', websiteUrl: 'https://huber.example.test/', ...extra }],
  } as unknown as Tournament;
  const slide = { id: 's1', type: 'sponsor', duration: null, order: 0, config: { sponsorId: 'sp1', ...config } } as unknown as MonitorSlide;
  render(<SponsorSlide slide={slide} tournament={tournament} performanceSettings={PERF} theme="dark" style={{}} />);
  return screen.getByTestId('qr-code').getAttribute('data-value') ?? '';
}

describe('@RZ-029 Sponsor-Folie: QR-Kanal', () => {
  it('Rückfall auf die Zuschauer-Adresse trägt ?k=q', () => {
    expect(zeige({})).toMatch(/\/#\/live\/ABC123\?k=q$/);
  });

  it('Gegenbeispiel: QR zur Sponsor-Webseite bleibt unverändert, ohne ?k=', () => {
    expect(zeige({ qrTarget: 'sponsor-website' })).toBe('https://huber.example.test/');
  });
});
