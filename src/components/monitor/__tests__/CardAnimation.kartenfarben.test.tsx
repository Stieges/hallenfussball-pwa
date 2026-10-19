/**
 * Karten-Farben nur für Karten (Oberfläche E), Befund C-KARTE-GELB-ALS-WARNFARBE: Monitor-Kartenanimation und CardFlash.
 * Gelb = cardYellow, Rot = cardRed, Gelb-Rot beide; keine festen Farbwerte, kein warning/error.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CardAnimation, CardFlash, type CardEventInfo } from '../CardAnimation';
import { contrastRatio, MIN_UI_CONTRAST, resolveToken } from '../../../test/contrast';

vi.mock('react-i18next', () => {
  const stable = { t: (key: string) => key, i18n: { language: 'de' } };
  return { useTranslation: () => stable };
});

const GELB = 'var(--color-card-yellow)';
const ROT = 'var(--color-card-red)';

function ereignis(cardType: CardEventInfo['cardType']): CardEventInfo {
  return { matchId: 'm1', teamId: 'a', teamName: 'FC Alpha', side: 'home', cardType, playerNumber: 7, timestamp: Date.now() };
}

function zeige(cardType: CardEventInfo['cardType']): HTMLElement {
  const { container } = render(<CardAnimation cardEvent={ereignis(cardType)} onAnimationComplete={vi.fn()} />);
  return container.querySelector<HTMLElement>('.card-animation-box')!;
}

describe('Karten-Farben nur für Karten (Oberfläche E) – Monitor-Kartenanimation', () => {
  it('die ganze Fläche ist die Karte: kein inneres Kartensymbol mehr', () => {
    const box = zeige('YELLOW');
    expect(box.querySelector('.card-icon')).toBeNull();
  });

  it('Gelb zeigt cardYellow, dunkle Schrift, kein Band', () => {
    const box = zeige('YELLOW');
    expect(box.style.background).toContain(GELB);
    expect(box.style.background).not.toContain(ROT);
    expect(box.querySelector('[data-testid="card-band"]')).toBeNull();
    expect(screen.getByTestId('card-kind-text').style.color).toBe('var(--color-scoreboard-on-highlight)');
  });

  it('Rot zeigt cardRed, helle Schrift, kein Band', () => {
    const box = zeige('RED');
    expect(box.style.background).toContain(ROT);
    expect(box.style.background).not.toContain(GELB);
    expect(box.querySelector('[data-testid="card-band"]')).toBeNull();
    expect(screen.getByTestId('card-kind-text').style.color).toBe('var(--color-scoreboard-on-live)');
  });

  it('Gelb-Rot zeigt beide Farben diagonal geteilt und die Schrift auf einem ruhigen dunklen Band quer über die Karte', () => {
    const box = zeige('YELLOW_RED');
    expect(box.style.background).toContain(GELB);
    expect(box.style.background).toContain(ROT);
    expect(box.style.background).toContain('linear-gradient(135deg');
    const band = screen.getByTestId('card-band');
    expect(band.style.background).toContain('var(--color-scoreboard-bg)');
    expect(band.style.color).toBe('var(--color-scoreboard-text)');
    expect(band.textContent).toContain('cardAnimation.yellowRedCard');
  });

  it.each(['light', 'dark'] as const)('%s: Band-Schrift auf dem Band ≥ 4,5 : 1, unabhängig vom Untergrund (Band deckend)', (theme) => {
    const band = resolveToken(theme, 'var(--color-scoreboard-bg)');
    expect(contrastRatio(resolveToken(theme, 'var(--color-scoreboard-text)'), band)).toBeGreaterThanOrEqual(4.5);
  });

  it('Kartenart, Team und Nummer sind groß: Schriftgrößen nur aus den Anzeige-Tokens, keine festen clamp()-Maße', () => {
    zeige('YELLOW');
    expect(screen.getByTestId('card-kind-text').style.fontSize).toBe('var(--font-size-score-lg)');
    expect(document.querySelector<HTMLElement>('[data-teamname]')?.style.fontSize).toBe('var(--font-size-score-sm)');
    expect(screen.getByTestId('card-player-number').style.fontSize).toBe('var(--font-size-score-md)');
    const quelle = readFileSync(resolve(process.cwd(), 'src/components/monitor/CardAnimation.tsx'), 'utf8');
    expect(quelle).not.toMatch(/clamp\(/);
  });

  it('Gegenbeispiel: keine festen Farben und kein warning/error in der Kartenanimation (Quelle)', () => {
    const quelle = readFileSync(resolve(process.cwd(), 'src/components/monitor/CardAnimation.tsx'), 'utf8');
    expect(quelle).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
    expect(quelle).not.toMatch(/rgba\(\s*(255, 235, 59|244, 67, 54|255, 193, 7|211, 47, 47)/);
    expect(quelle).not.toMatch(/colors\.(warning|error)\b/);
    expect(quelle).toContain('cardYellow');
    expect(quelle).toContain('cardRed');
  });

  it('CardFlash färbt Gelb mit cardYellow, Rot und Gelb-Rot mit cardRed (kein festes Rgba)', () => {
    const flash = (cardType: CardEventInfo['cardType']): string => {
      const { container, unmount } = render(<CardFlash show side="home" cardType={cardType} />);
      const h = container.innerHTML;
      unmount();
      return h;
    };
    expect(flash('YELLOW')).toContain(GELB);
    expect(flash('RED')).toContain(ROT);
    expect(flash('YELLOW_RED')).toContain(ROT);
    expect(flash('YELLOW')).not.toMatch(/rgba\(255, 235, 59/);
  });

  it.each(['light', 'dark'] as const)('%s: Schrift auf Kartengelb ist dunkel (≥ 4,5 : 1), auf Rot hell (≥ 3 : 1 für große Schrift)', (theme) => {
    const gelb = resolveToken(theme, GELB);
    const rot = resolveToken(theme, ROT);
    const dunkel = resolveToken(theme, 'var(--color-scoreboard-on-highlight)');
    const hell = resolveToken(theme, 'var(--color-scoreboard-on-live)');
    expect(contrastRatio(dunkel, gelb)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(hell, rot)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
    expect(contrastRatio(dunkel, rot)).toBeGreaterThanOrEqual(MIN_UI_CONTRAST);
  });
});
