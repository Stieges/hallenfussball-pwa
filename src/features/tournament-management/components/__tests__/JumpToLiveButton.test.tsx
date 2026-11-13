/**
 * @ZP-109 schwebende Taste „Zum laufenden Spiel“ (Variante B): erscheint nur unter 1280 Bildpunkten, wenn die Karte des laufenden Spiels aus dem
 * Bild gescrollt ist (mehr als 200 Bildpunkte gescrollt), springt zur Karte und verschwindet, sobald die Karte wieder im Bild ist.
 * Echter IntersectionObserver gibt es in jsdom nicht: eine Attrappe meldet „im Bild“ bzw. „aus dem Bild“.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.unmock('i18next');
vi.unmock('react-i18next');

import { initRealDeI18n } from '../../../../test/realDeI18n';
import { cssVars } from '../../../../design-tokens';
import { JumpToLiveButton } from '../JumpToLiveButton';
import { footerLiftOf, jumpButtonBottom } from '../jumpToLivePosition';

await initRealDeI18n();

let melde: (inView: boolean) => void = () => undefined;
const scrollIntoView = vi.fn();

class AttrappeBeobachter {
  constructor(private readonly callback: IntersectionObserverCallback) {
    melde = (inView) => this.callback([{ isIntersecting: inView } as IntersectionObserverEntry], this as unknown as IntersectionObserver);
  }
  observe(): void { /* die Attrappe meldet nur auf Zuruf */ }
  disconnect(): void { melde = () => undefined; }
}

const TARGET = 'schedule-current-card-m5';

function stelle(breite: number, scrollY: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: breite });
  Object.defineProperty(window, 'scrollY', { configurable: true, value: scrollY });
}

function zeige() {
  return render(<><div data-testid={TARGET} tabIndex={-1} /><JumpToLiveButton targetId={TARGET} /></>);
}

const taste = () => screen.queryByTestId('schedule-jump-to-live');
const aus = () => act(() => { melde(false); });
const imBild = () => act(() => { melde(true); });

beforeEach(() => {
  vi.stubGlobal('IntersectionObserver', AttrappeBeobachter);
  Element.prototype.scrollIntoView = scrollIntoView;
  scrollIntoView.mockClear();
  stelle(390, 400);
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('@ZP-109 schwebende Taste „Zum laufenden Spiel“', () => {
  it('@ZP-109 unter 1280 Bildpunkten, Karte aus dem Bild, mehr als 200 Bildpunkte gescrollt: die Taste steht da, dunkle Pille mit heller Schrift, einzeilig', () => {
    zeige();
    expect(taste()).toBeNull(); // Karte beim Öffnen im Bild
    aus();
    expect(taste()).toHaveTextContent(/^Zum laufenden Spiel$/);
    expect(taste()?.style.background).toBe(cssVars.colors.textPrimary);
    expect(taste()?.style.color).toBe(cssVars.colors.background);
    expect(taste()?.style.whiteSpace).toBe('nowrap');
    expect(taste()?.style.minHeight).toBe(cssVars.touchTargets.primary);
  });

  it('@ZP-109 sie springt zur Karte und verschwindet, sobald die Karte wieder im Bild ist', async () => {
    zeige();
    aus();
    await userEvent.click(taste()!);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    imBild();
    expect(taste()).toBeNull();
  });

  it.each([
    ['ab 1280 Bildpunkten (Laptop)', 1280, 400, false],
    ['Tablet quer 1024 Bildpunkte: sichtbar', 1024, 400, true],
    ['genau 200 Bildpunkte gescrollt (nicht „mehr als“)', 390, 200, false],
    ['201 Bildpunkte gescrollt', 390, 201, true],
  ])('@ZP-109 Grenzfall „%s“: sichtbar = %s', (_name, breite, scrollY, sichtbar) => {
    stelle(breite, scrollY);
    zeige();
    aus();
    expect(taste() !== null).toBe(sichtbar);
  });

  it('@ZP-109 am Handy liegt die Pille über der Navigationsleiste und der Leiste „Teilen · Als PDF“', () => {
    expect(jumpButtonBottom(true)).toContain('--layout-height-bottom-nav');
    expect(jumpButtonBottom(true)).toContain('--schedule-action-bar-h');
  });

  it('@ZP-109 Gegenbeispiel: ab Tablet-Breite gibt es keine Navigationsleiste, die Pille hält sich nicht davon fern', () => {
    expect(jumpButtonBottom(false)).not.toContain('--layout-height-bottom-nav');
    expect(jumpButtonBottom(false)).not.toContain('--schedule-action-bar-h');
  });

  it('@ZP-109 nach dem Sprung hat die Karte den Fokus (Tastatur und Bildschirmleser); vorher nicht', async () => {
    zeige();
    aus();
    expect(document.activeElement).not.toBe(screen.getByTestId(TARGET));
    await userEvent.click(taste()!);
    expect(document.activeElement).toBe(screen.getByTestId(TARGET));
  });

  it('@ZP-109 steht die Fußzeile im Bild, liegt die Pille darüber (Lift = Höhe, die die Fußzeile ins Bild ragt); ohne Fußzeile im Bild bleibt es beim Grundabstand', () => {
    const rect = (top: number, bottom: number) => ({ getBoundingClientRect: () => ({ top, bottom }) });
    expect(footerLiftOf([rect(700, 800)], 844)).toBe(144); // Fußzeile beginnt bei 700, Fenster 844 hoch
    expect(footerLiftOf([rect(900, 1000)], 844)).toBe(0); // unter dem Bild
    expect(footerLiftOf([rect(-200, -10)], 844)).toBe(0); // über dem Bild
    expect(footerLiftOf([rect(900, 1000), rect(760, 860)], 844)).toBe(84); // mehrere Fußzeilen: die höchste zählt
    expect(jumpButtonBottom(true, 144)).toMatch(/^max\(.*144px/);
    expect(jumpButtonBottom(true, 0)).not.toContain('max(');
  });

  it('@ZP-109 Gegenbeispiel: ohne Karte des laufenden Spiels (Ziel fehlt) nie sichtbar', () => {
    render(<JumpToLiveButton targetId="gibt-es-nicht" />);
    expect(taste()).toBeNull();
  });
});
