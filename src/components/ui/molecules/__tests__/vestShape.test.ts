/**
 * @ZM-161 Form des Trainingsleibchens (E1): gerade Seiten, gerade schräge Armausschnitte, runder Halsausschnitt; die Trikotfarbe ist an Schultern, Hals und
 * Seiten zu sehen, etwa die Hälfte der Fläche. Reine Geometrie (`vestShape.ts`) aus den Tokens `displayLayout.scoreArea.vest`.
 */
import { describe, expect, it } from 'vitest';
import { displayLayout } from '../../../../design-tokens';
import { vestPieceBox, vestPieces, type VestPoint } from '../vestShape';

const V = displayLayout.scoreArea.vest;
const x = (p: readonly VestPoint[]) => p.map((q) => q[0]);
const y = (p: readonly VestPoint[]) => p.map((q) => q[1]);

/** Fläche eines Vielecks in Prozent der Kastenfläche (Schnürsenkelformel; Koordinaten in Prozent, also durch 100 · 100). */
function flaeche(punkte: readonly VestPoint[]): number {
  let s = 0;
  punkte.forEach((a, i) => {
    const b = punkte[(i + 1) % punkte.length];
    s += a[0] * b[1] - b[0] * a[1];
  });
  return Math.abs(s) / 2 / 100;
}

describe('@ZM-161 vestPieces: drei Teile in der Trikotfarbe', () => {
  it.each(['large', 'small', 'cockpit'] as const)('%s: links, rechts und Hals – alle liegen im Kasten (0 bis 100 %)', (size) => {
    const teile = vestPieces(size);
    expect(teile).toHaveLength(3);
    for (const teil of teile) {
      expect(Math.min(...x(teil))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...x(teil))).toBeLessThanOrEqual(100);
      expect(Math.min(...y(teil))).toBeGreaterThanOrEqual(0);
      expect(Math.max(...y(teil))).toBeLessThanOrEqual(100);
    }
  });

  it.each(['large', 'small', 'cockpit'] as const)('%s: gerade Seiten – links bis zur Seitenkante, rechts gespiegelt, am Träger bis zur äußeren Kante', (size) => {
    const [links, rechts] = vestPieces(size);
    const { edge, strap } = V[size];
    expect(Math.min(...x(links))).toBe(0);
    expect(Math.max(...x(links))).toBeCloseTo(strap, 5);
    expect(Math.min(...x(rechts))).toBeCloseTo(100 - strap, 5);
    expect(Math.max(...x(rechts))).toBe(100);
    // unten (y = 100) reicht der linke Teil bis zur Seitenkante des Leibchens
    const unten = links.filter((p) => p[1] === 100).map((p) => p[0]);
    expect(Math.max(...unten)).toBeCloseTo(edge, 5);
    // spiegelbildlich: Fläche links = Fläche rechts
    expect(flaeche(links)).toBeCloseTo(flaeche(rechts), 5);
  });

  it.each(['large', 'small', 'cockpit'] as const)('%s: der Hals ist symmetrisch zur Mitte, liegt oben und nie tiefer als seine Tiefe', (size) => {
    const hals = vestPieces(size)[2];
    const { neckHalf, neckDepth } = V[size];
    expect(Math.min(...x(hals))).toBeCloseTo(neckHalf, 5);
    expect(Math.max(...x(hals))).toBeCloseTo(100 - neckHalf, 5);
    expect(Math.min(...y(hals))).toBe(0);
    expect(Math.max(...y(hals))).toBeCloseTo(neckDepth, 5);
  });

  it('@ZM-161 runder Hals: unten gerundet (viele Stützpunkte), nicht eckig wie ein V', () => {
    const hals = vestPieces('large')[2];
    expect(hals.length).toBeGreaterThan(10);
    const tiefste = hals.filter((p) => p[1] >= V.large.neckDepth - 0.5);
    expect(tiefste.length).toBeGreaterThan(0);
  });

  it('@ZM-161 die Trikotfarbe ist etwa die Hälfte der Fläche (große Form 40 bis 55 %)', () => {
    const summe = vestPieces('large').reduce((s, teil) => s + flaeche(teil), 0);
    expect(summe).toBeGreaterThan(40);
    expect(summe).toBeLessThan(55);
  });

  it('@ZM-161 Cockpit-Kasten: flacher Hals (höchstens ein Drittel der großen Form), damit die Ziffer ganz auf der Leibchenfarbe steht', () => {
    expect(V.cockpit.neckDepth).toBeLessThanOrEqual(V.large.neckDepth / 3);
    expect(Math.max(...y(vestPieces('cockpit')[2]))).toBeCloseTo(V.cockpit.neckDepth, 5);
  });

  it('kleine Kästen: schmalere Seitenkante, flacherer Hals, breitere Halsöffnung enger', () => {
    expect(V.small.neckDepth).toBeLessThan(V.large.neckDepth);
    expect(V.small.neckHalf).toBeGreaterThan(V.large.neckHalf);
    expect(V.small.edge).toBeLessThan(V.large.edge);
  });
});

describe('@ZM-161 vestPieceBox: Lage und Zuschnitt eines Teils', () => {
  it('liefert das umschließende Rechteck in Prozent und einen Zuschnitt in Prozent dieses Rechtecks', () => {
    const [links] = vestPieces('large');
    const b = vestPieceBox(links);
    expect(b.left).toBe('0.00%');
    expect(b.top).toBe('0.00%');
    expect(b.width).toBe(`${V.large.strap.toFixed(2)}%`);
    expect(b.height).toBe('100.00%');
    expect(b.clipPath).toMatch(/^polygon\((\d+\.\d{2}% \d+\.\d{2}%(, )?)+\)$/);
  });
});
