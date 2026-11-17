/**
 * @ZM-213 Breitenbegrenzung des Mittentexts im Uhrband (`useBandFit`): der Text darf die Seitenspalten nie verdrängen oder überlappen.
 * jsdom hat kein Layout: Breiten werden über `offsetWidth`/`clientWidth` nachgebaut; geprüft wird die Rechnung (Schrift so klein, dass der Text
 * zwischen die längsten Wörter der Seiten passt; nie größer als die Vorgabe). Die echte Geometrie misst die Playwright-Spec `monitor-profil-halle`.
 */
import { useRef } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useBandFit } from '../useBandFit';

interface Breiten { band: number; text: number; links: number; rechts: number }

function Harness() {
  const refs = { band: useRef<HTMLDivElement>(null), slot: useRef<HTMLDivElement>(null), text: useRef<HTMLSpanElement>(null), links: useRef<HTMLDivElement>(null), rechts: useRef<HTMLDivElement>(null) };
  useBandFit(refs);
  return (
    <div ref={refs.band} data-testid="band">
      <div ref={refs.links}><span data-testid="l">Live</span></div>
      <div ref={refs.slot}><span ref={refs.text} data-testid="text" style={{ fontSize: '' }}>4 : 3 on penalties</span></div>
      <div ref={refs.rechts}><span data-testid="r">angehalten</span></div>
    </div>
  );
}

function stelle(b: Breiten): void {
  // Die Seitenkinder werden als Kopien gemessen (ohne `data-testid`): sie sind am Text zu erkennen
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
    if (this.getAttribute('data-testid') === 'text') { return b.text; }
    if (this.style.width === 'min-content') { return this.textContent === 'Live' ? b.links : this.textContent === 'angehalten' ? b.rechts : 0; }
    return 0;
  });
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return this.getAttribute('data-testid') === 'band' ? b.band : 0; });
  vi.spyOn(window, 'getComputedStyle').mockImplementation(() => ({ fontSize: '200px', paddingLeft: '0px', paddingRight: '0px' }) as unknown as CSSStyleDeclaration);
}

afterEach(() => { vi.restoreAllMocks(); });

describe('@ZM-213 useBandFit', () => {
  it('ein Text, der zwischen die Seitenspalten nicht passt, bekommt eine kleinere Schrift (Breite = Band − 2 × längstes Seitenwort)', () => {
    stelle({ band: 1600, text: 1740, links: 150, rechts: 400 });
    const { getByTestId } = render(<Harness />);
    // verfügbar 1600 − 2 × 400 = 800; Schrift 200 px × 800 / 1740 = 91,95 → 91 px
    expect(getByTestId('text').style.fontSize).toBe('91px');
  });

  it('Gegenbeispiel: passt der Text, bleibt die Vorgabe (keine Schrift am Element gesetzt)', () => {
    stelle({ band: 1600, text: 700, links: 150, rechts: 400 });
    const { getByTestId } = render(<Harness />);
    expect(getByTestId('text').style.fontSize).toBe('');
  });
});
