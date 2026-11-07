/**
 * Zeitstrafen-Kreis am Monitor mit echten Texten (DE/EN): sichtbar nur die Rückennummer, kein Wort „Zeitstrafe“ und keine
 * Restzeit in Ziffern (@ZM-192); Bildschirmleser hören Art, Nummer und Restzeit (Sprachparität).
 */
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import { LivePenaltyCircles } from '../LivePenaltyCircles';
import { monitorThemes } from '../../../design-tokens';
import { createRealI18n, type RealLanguage } from '../../../test/realI18n';
import type { OeffentlicheZeitstrafen } from '../../../core/view';

vi.unmock('i18next');
vi.unmock('react-i18next');

const ZWEI: OeffentlicheZeitstrafen = {
  home: [],
  away: [
    { id: 'a', nummer: 5, restMs: 90_000, dauerMs: 120_000, anteil: 0.75 },
    { id: 'b', nummer: null, restMs: 83_400, dauerMs: 120_000, anteil: 0.695 },
  ],
  steht: false,
};

async function zeige(lng: RealLanguage) {
  const i18n = await createRealI18n(lng);
  render(<I18nextProvider i18n={i18n}><LivePenaltyCircles side="away" zeitstrafen={ZWEI} themeColors={monitorThemes.dark} /></I18nextProvider>);
  return Array.from(document.querySelectorAll<HTMLElement>('[data-zeitstrafe]'));
}

describe('@ZM-192 Kreis ohne Wort, Restzeit nur für Bildschirmleser', () => {
  it.each([
    ['de', ['Zeitstrafe Rückennummer 5, noch 1:30', 'Zeitstrafe ohne Rückennummer, noch 1:23']],
    ['en', ['Time Penalty shirt number 5, 1:30 left', 'Time Penalty without shirt number, 1:23 left']],
  ] as const)('@ZM-192 %s: sichtbar „5“ und eine leere Scheibe, gesprochen Art, Nummer und Restzeit', async (lng, labels) => {
    const kreise = await zeige(lng);
    expect(kreise.map((k) => k.textContent)).toEqual(['5', '']);
    expect(kreise.map((k) => k.getAttribute('aria-label'))).toEqual(labels);
    expect(document.body.textContent).not.toMatch(/Zeitstrafe|Penalty|1:30/);
  });

  it('@ZM-192 Gegenbeispiel: ohne Strafe auf dieser Seite gibt es keine Reihe', async () => {
    const i18n = await createRealI18n('de');
    const { container } = render(<I18nextProvider i18n={i18n}><LivePenaltyCircles side="home" zeitstrafen={ZWEI} themeColors={monitorThemes.dark} /></I18nextProvider>);
    expect(container).toBeEmptyDOMElement();
  });
});
