/**
 * Karten-Farben nur für Karten (Oberfläche E), Befund C-KARTE-GELB-ALS-WARNFARBE: Monitor-Kartenanimation und CardFlash.
 * Gelb = cardYellow, Rot = cardRed, Gelb-Rot beide; keine festen Farbwerte, kein warning/error.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
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
  return { matchId: 'm1', teamId: 'a', teamName: 'FC Alpha', side: 'home', cardType, timestamp: Date.now() };
}

function flaechen(cardType: CardEventInfo['cardType']): { box: string; symbol: string } {
  const { container } = render(<CardAnimation cardEvent={ereignis(cardType)} onAnimationComplete={vi.fn()} />);
  const box = container.querySelector<HTMLElement>('.card-animation-box');
  const symbol = container.querySelector<HTMLElement>('.card-icon');
  return { box: box?.style.background ?? '', symbol: symbol?.style.background ?? '' };
}

describe('Karten-Farben nur für Karten (Oberfläche E) – Monitor-Kartenanimation', () => {
  it('Gelb zeigt cardYellow und kein Rot', () => {
    const f = flaechen('YELLOW');
    for (const w of [f.box, f.symbol]) {
      expect(w).toContain(GELB);
      expect(w).not.toContain(ROT);
    }
  });

  it('Rot zeigt cardRed und kein Gelb', () => {
    const f = flaechen('RED');
    for (const w of [f.box, f.symbol]) {
      expect(w).toContain(ROT);
      expect(w).not.toContain(GELB);
    }
  });

  it('Gelb-Rot zeigt beide Farben diagonal geteilt', () => {
    const f = flaechen('YELLOW_RED');
    for (const w of [f.box, f.symbol]) {
      expect(w).toContain(GELB);
      expect(w).toContain(ROT);
      expect(w).toContain('linear-gradient(135deg');
    }
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
