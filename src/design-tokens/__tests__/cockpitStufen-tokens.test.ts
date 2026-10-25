/**
 * Maße des Laptop-Cockpits je Stufe der Fensterhöhe (Plan Cockpit v2 B2, @SL-187): Tor ≥ 56 px, Foul-Reihe und Fußleiste ≥ 44 px (Tippfläche),
 * die Stufen wachsen von knapp über normal zu gross, die „gross“-Werte wachsen mit der Fensterhöhe weiter (nie unter dem Wert der Stufe).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cssVars } from '../cssVars';

const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');
const px = (name: string): number => {
  const treffer = new RegExp(`${name}:\\s*(\\d+)px;`).exec(css);
  if (!treffer) { throw new Error(`${name} fehlt in global.css`); }
  return Number(treffer[1]);
};
const STUFEN = ['knapp', 'normal', 'gross'] as const;

describe('Stufen-Tokens des Laptop-Cockpits', () => {
  it.each(STUFEN)('Stufe %s: Tor ≥ 56 px, Foul-Reihe und Fußleiste ≥ 44 px, Team-Leiste ≥ 40 px', (stufe) => {
    expect(px(`--sizing-cockpit-tor-${stufe}`)).toBeGreaterThanOrEqual(56);
    expect(px(`--sizing-cockpit-fuss-${stufe}`)).toBeGreaterThanOrEqual(44);
    expect(px(`--sizing-cockpit-leiste-${stufe}`)).toBeGreaterThanOrEqual(44);
    expect(px(`--sizing-cockpit-kopf-${stufe}`)).toBeGreaterThanOrEqual(40);
  });

  it.each(['tor', 'fuss', 'leiste', 'kopf'])('%s wächst von knapp über normal zu gross', (name) => {
    expect(px(`--sizing-cockpit-${name}-knapp`)).toBeLessThan(px(`--sizing-cockpit-${name}-normal`));
    expect(px(`--sizing-cockpit-${name}-normal`)).toBeLessThan(px(`--sizing-cockpit-${name}-gross`));
  });

  it('jede Stufe hat ihren Eintrag in `cssVars.sizing` (Tor, Foul-Reihe, Fußleiste, Team-Leiste)', () => {
    for (const name of ['Tor', 'Fuss', 'Leiste', 'Kopf']) {
      for (const stufe of ['Knapp', 'Normal', 'Gross']) {
        const schluessel = `cockpit${name}${stufe}` as keyof typeof cssVars.sizing;
        expect(cssVars.sizing[schluessel], schluessel).toBe(`var(--sizing-cockpit-${name.toLowerCase()}-${stufe.toLowerCase()})`);
      }
    }
  });

  it.each([['kasten', 164], ['ziffer', 128], ['fuss', 112], ['kopf', 60], ['leiste', 80]] as const)('„gross“ wächst ab 800 px mit der Fensterhöhe weiter (%s): bei 800 px der Wert der Stufe, bei 1080 px %i px (Mockup), nie darüber', (name, bei1080) => {
    const treffer = new RegExp(`--sizing-cockpit-${name}-gross-fluid:\\s*clamp\\(var\\(--sizing-cockpit-${name}-gross\\),\\s*calc\\(var\\(--sizing-cockpit-${name}-gross\\) \\+ \\(100vh - 800px\\) \\* ([\\d.]+)\\),\\s*(\\d+)px\\)`).exec(css);
    expect(treffer, `${name} fluid`).not.toBeNull();
    const [, steigung, obergrenze] = treffer ?? [];
    const basis = px(`--sizing-cockpit-${name}-gross`);
    const bei = (hoehe: number): number => Math.min(Number(obergrenze), Math.max(basis, basis + (hoehe - 800) * Number(steigung)));
    expect(bei(800)).toBe(basis);
    expect(bei(1080)).toBeCloseTo(bei1080, 0);
    expect(bei(2000)).toBe(Number(obergrenze));
    expect(bei(799)).toBe(basis); // darunter gilt die Stufe „normal“; die Untergrenze hält den Wert nie unter den der Stufe
  });
});
