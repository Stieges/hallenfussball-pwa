/**
 * @ZM-129 @ZM-125 Die Schrift der Monitor-Tabelle wird nach dem Zeichnen an die freie Höhe angepasst (`useFitFont`): nachgebautes Layout
 * (Höhe der Tabelle = 100 × Schrift in vh, Bildhöhe 1000 px): endet, wächst nie über den Startwert, beginnt bei neuem Startwert von vorn, läuft ohne
 * ResizeObserver ohne Fehler.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { useFitFont } from '../useFitFont';

function Probe({ start, min = 3, overscan = 0 }: { start: number; min?: number; overscan?: number }) {
  const { ref, fontSize } = useFitFont(start, min, overscan);
  return <div ref={ref} data-testid="probe" style={{ fontSize }} />;
}

const original = HTMLElement.prototype.getBoundingClientRect;
const fontOf = (el: Element): number => parseFloat((el as HTMLElement).style.fontSize);

beforeEach(() => {
  Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true });
  // Höhe der Tabelle: 100 Bildpunkte je vh Schrift (ab Oberkante 0)
  HTMLElement.prototype.getBoundingClientRect = function rect(this: HTMLElement) {
    const hoehe = parseFloat(this.style.fontSize) * 100;
    return { top: 0, bottom: hoehe, height: hoehe, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) };
  };
});
afterEach(() => { HTMLElement.prototype.getBoundingClientRect = original; vi.unstubAllGlobals(); cleanup(); });

describe('useFitFont', () => {
  it('passt die Tabelle, bleibt unter dem Startwert und endet', () => {
    const { getByTestId } = render(<Probe start={15} />);
    const font = fontOf(getByTestId('probe'));
    expect(font).toBeLessThan(15);
    expect(font * 100).toBeLessThanOrEqual(1000.5);
    expect(font).toBeGreaterThanOrEqual(3);
  });

  it('wächst nie über den Startwert und ändert eine passende Tabelle nicht', () => {
    const { getByTestId, rerender } = render(<Probe start={6} />);
    expect(fontOf(getByTestId('probe'))).toBe(6);
    rerender(<Probe start={6} />);
    expect(fontOf(getByTestId('probe'))).toBe(6);
  });

  it('stößt an die Untergrenze und hört dort auf (Gegenbeispiel: Inhalt, der nie passt)', () => {
    const { getByTestId } = render(<Probe start={15} overscan={95} />);
    expect(fontOf(getByTestId('probe'))).toBe(3);
  });

  it('der Bildrand zählt: bei 10 % Rand höchstens 80 % der Bildhöhe', () => {
    const { getByTestId } = render(<Probe start={15} overscan={10} />);
    expect(fontOf(getByTestId('probe')) * 100).toBeLessThanOrEqual(900.5);
  });

  it('ein neuer Startwert (andere Daten) beginnt von vorn und wird neu angepasst', () => {
    const { getByTestId, rerender } = render(<Probe start={15} />);
    const klein = fontOf(getByTestId('probe'));
    rerender(<Probe start={8} />);
    const neu = fontOf(getByTestId('probe'));
    expect(neu).toBeLessThanOrEqual(8);
    expect(neu).toBeLessThanOrEqual(10.01);
    expect(klein).toBeLessThan(15);
    rerender(<Probe start={5} />);
    expect(fontOf(getByTestId('probe'))).toBe(5);
  });

  it('ohne ResizeObserver und ohne document.fonts läuft der Hook ohne Fehler', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const fonts = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', { value: undefined, configurable: true });
    try {
      expect(() => render(<Probe start={15} />)).not.toThrow();
    } finally {
      if (fonts) { Object.defineProperty(document, 'fonts', fonts); } else { Reflect.deleteProperty(document, 'fonts'); }
    }
  });

  it('mit ResizeObserver: eine spätere Größenänderung verkleinert sofort', () => {
    let beobachter: (() => void) | undefined;
    vi.stubGlobal('ResizeObserver', class { constructor(cb: () => void) { beobachter = cb; } observe() { /* leer */ } disconnect() { /* leer */ } });
    const { getByTestId } = render(<Probe start={9} />);
    const el = getByTestId('probe');
    expect(fontOf(el)).toBe(9);
    // Inhalt wird höher (längere Namen): 150 Bildpunkte je vh
    HTMLElement.prototype.getBoundingClientRect = function rect(this: HTMLElement) {
      const hoehe = parseFloat(this.style.fontSize) * 150;
      return { top: 0, bottom: hoehe, height: hoehe, left: 0, right: 0, width: 0, x: 0, y: 0, toJSON: () => ({}) };
    };
    beobachter?.();
    expect(fontOf(el) * 150).toBeLessThanOrEqual(1000.5);
  });
});
