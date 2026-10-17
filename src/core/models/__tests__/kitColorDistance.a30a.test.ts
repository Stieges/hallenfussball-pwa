/**
 * A-30a (@SL-139 „fester Farbabstand ΔE2000“): Formelprüfung gegen die veröffentlichten Prüfpaare von
 * Sharma, Wu, Dalal (2005), „The CIEDE2000 Color-Difference Formula: Implementation Notes …“, Tabelle 1.
 * Die Paare decken die Sonderfälle der Formel ab (unbunte Farbe, Farbtonsprung über 180°, Mittelwert der Farbtöne).
 * Die fachlichen Beispielzeilen aus dem Gherkin prüft kit.a30a.test.ts.
 */
import { describe, expect, it } from 'vitest';
import { deltaE2000, hexToLab } from '../kitColorDistance';

describe('A-30a ΔE2000 nach Sharma et al. (Prüfpaare)', () => {
  it.each([
    { nr: 1, first: [50, 2.6772, -79.7751], second: [50, 0, -82.7485], erwartet: 2.0425 },
    { nr: 7, first: [50, 0, 0], second: [50, -1, 2], erwartet: 2.3669 },
    { nr: 13, first: [50, 2.49, -0.001], second: [50, -2.49, 0.0009], erwartet: 7.1792 },
    { nr: 14, first: [50, 2.49, -0.001], second: [50, -2.49, 0.001], erwartet: 7.1792 },
    { nr: 15, first: [50, 2.49, -0.001], second: [50, -2.49, 0.0011], erwartet: 7.2195 },
    { nr: 16, first: [50, 2.49, -0.001], second: [50, -2.49, 0.0012], erwartet: 7.2195 },
    { nr: 17, first: [50, -0.001, 2.49], second: [50, 0.0009, -2.49], erwartet: 4.8045 },
    { nr: 18, first: [50, -0.001, 2.49], second: [50, 0.001, -2.49], erwartet: 4.8045 },
    { nr: 19, first: [50, -0.001, 2.49], second: [50, 0.0011, -2.49], erwartet: 4.7461 },
    { nr: 20, first: [50, 2.5, 0], second: [50, 0, -2.5], erwartet: 4.3065 },
    { nr: 21, first: [50, 2.5, 0], second: [73, 25, -18], erwartet: 27.1492 },
    { nr: 25, first: [60.2574, -34.0099, 36.2677], second: [60.4626, -34.1751, 39.4387], erwartet: 1.2644 },
    { nr: 34, first: [2.0776, 0.0795, -1.135], second: [0.9033, -0.0636, -0.5514], erwartet: 0.9082 },
  ])('Prüfpaar $nr → ΔE2000 $erwartet', ({ first, second, erwartet }) => {
    const lab = (v: number[]) => ({ l: v[0], a: v[1], b: v[2] });
    expect(deltaE2000(lab(first), lab(second))).toBeCloseTo(erwartet, 4);
    expect(deltaE2000(lab(second), lab(first))).toBeCloseTo(erwartet, 4);
  });

  it('Weiß und Schwarz liegen auf der unbunten Achse (L 100 bzw. 0, a = b ≈ 0)', () => {
    const weiss = hexToLab('#FFFFFF');
    const schwarz = hexToLab('#000000');
    expect(weiss.l).toBeCloseTo(100, 2);
    expect(schwarz.l).toBeCloseTo(0, 6);
    expect(Math.abs(weiss.a) + Math.abs(weiss.b)).toBeLessThan(0.01);
  });
});
