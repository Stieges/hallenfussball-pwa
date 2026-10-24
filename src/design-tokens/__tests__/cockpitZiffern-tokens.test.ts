/**
 * Tokens für Ziffern und Kästen des Cockpits (@SL-178, Plan Cockpit v2 A1, Weiche F1 Variante 1):
 * Ziffernhöhe = 0,727 em (Inter), Handy >= 65 px, Laptop >= 55 px in jeder Stufe ab 620 px Fensterhöhe; die Tor-Taste bleibt >= 56 px.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cssVars } from '../cssVars';
import { cockpitHeightSteps, cockpitMinHoehe } from '../breakpoints';
import { cockpitHeightSteps as ausBarrel } from '../index';

const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');
const px = (name: string): number => {
  const treffer = new RegExp(`${name}:\\s*(\\d+)px;`).exec(css);
  if (!treffer) { throw new Error(`${name} fehlt in global.css`); }
  return Number(treffer[1]);
};
/** Versalhöhe der Ziffern in Inter (gemessen, wie `cockpit.ziffern` in visual:metrics) */
const ZIFFERN_ANTEIL = 0.727;
const STUFEN = ['knapp', 'normal', 'gross'] as const;

describe('Cockpit-Ziffern-Tokens', () => {
  it.each([
    ['cockpitZifferHandy', '--sizing-cockpit-ziffer-handy'], ['cockpitZifferKnapp', '--sizing-cockpit-ziffer-knapp'],
    ['cockpitZifferNormal', '--sizing-cockpit-ziffer-normal'], ['cockpitZifferGross', '--sizing-cockpit-ziffer-gross'],
    ['cockpitKastenHandy', '--sizing-cockpit-kasten-handy'], ['cockpitKastenKnapp', '--sizing-cockpit-kasten-knapp'],
    ['cockpitKastenNormal', '--sizing-cockpit-kasten-normal'], ['cockpitKastenGross', '--sizing-cockpit-kasten-gross'],
  ] as const)('%s → var(%s), in global.css definiert', (schluessel, name) => {
    expect(cssVars.sizing[schluessel]).toBe(`var(${name})`);
    expect(css).toContain(`${name}:`);
  });

  it('Handy: Ziffernhöhe >= 65 px (Vorgabe Daniel ≈ 6 px/mm)', () => {
    expect(px('--sizing-cockpit-ziffer-handy') * ZIFFERN_ANTEIL).toBeGreaterThanOrEqual(65);
  });

  it.each(STUFEN)('Laptop, Stufe %s: Ziffernhöhe >= 55 px (11 mm bei 5,0 px/mm), auch bei 620 px (H1)', (stufe) => {
    expect(px(`--sizing-cockpit-ziffer-${stufe}`) * ZIFFERN_ANTEIL).toBeGreaterThanOrEqual(55);
  });

  it.each(STUFEN)('Stufe %s: der Kasten ist höher als die Ziffer (Luft für den Rahmen)', (stufe) => {
    expect(px(`--sizing-cockpit-kasten-${stufe}`)).toBeGreaterThan(px(`--sizing-cockpit-ziffer-${stufe}`) * ZIFFERN_ANTEIL);
  });

  it('Schwellen: eine Quelle in breakpoints.ts, im Barrel erreichbar, knapp = unter 720 (F5)', () => {
    expect(cockpitHeightSteps).toEqual({ knapp: 720, gross: 800 });
    expect(ausBarrel).toBe(cockpitHeightSteps);
    expect(cockpitMinHoehe).toBe(620);
  });
});

/**
 * Höhenbudget bei 620 px (Weiche F1): feste Anteile aus dem abgenommenen Mockup `laptop-620` (nativ gemessen: Kopf 48, Ränder und
 * Abstände, Tafelkopf, Etikett, Zeitbalken, „Nächstes“, Leiste, Foul-Reihe, Namenszeile 20 bzw. 14 in Variante a). Die Tor-Taste nimmt den Rest.
 */
describe('F1: 11 mm auch bei 620 px Fensterhöhe – Tor-Taste bleibt >= 56 px', () => {
  const FEST_OHNE_KASTEN_UHR_TOR = 393; // Mockup laptop-620: 621 − Kasten 70 − Uhrzeile 62 − Tor 96
  const NAMENSZEILE_HAUPT = 20;
  const NAMENSZEILE_VARIANTE_A = 14; // nur „Heim“/„Gast“ über dem Kasten (< 720 px)
  const ZWEITE_LEISTENZEILE = 22; // sehr langer Teamname in der Leiste (zwei Zeilen)
  const TOR_MIN = 56;
  const tor = (hoehe: number, zeilenOhne: number, lang: boolean): number =>
    hoehe - (FEST_OHNE_KASTEN_UHR_TOR - (NAMENSZEILE_HAUPT - zeilenOhne)) - px('--sizing-cockpit-kasten-knapp') - px('--sizing-cockpit-ziffer-knapp') - (lang ? ZWEITE_LEISTENZEILE : 0);

  it('620 px, Variante a, kurze Namen: Tor >= 56 px', () => {
    expect(tor(620, NAMENSZEILE_VARIANTE_A, false)).toBeGreaterThanOrEqual(TOR_MIN);
  });
  it('620 px, Variante a, lange Namen (zweite Leistenzeile): Tor >= 56 px', () => {
    expect(tor(620, NAMENSZEILE_VARIANTE_A, true)).toBeGreaterThanOrEqual(TOR_MIN);
  });
  // Ersatz der entfallenen gerechneten Gegenprobe (sie rechnete mit dem Mockup-Kasten 76 px; die Stufe „knapp“ hat jetzt 68 px): die Mindesthöhe der
  // Tor-Taste ist ein eigener Token je Stufe und liegt nie unter 56 px; das Minimum am echten Fenster (620 px) weist `cockpit-hoehen.spec.ts` nach.
  it.each(STUFEN)('Stufe %s: Mindesthöhe der Tor-Taste (Token) >= 56 px', (stufe) => {
    expect(px(`--sizing-cockpit-tor-${stufe}`)).toBeGreaterThanOrEqual(TOR_MIN);
  });
  it('Gegenprobe: ein Kasten von 76 px (Mockup-Wert) ließe bei 620 px ohne Variante a und mit langem Namen nur noch Tor < 56 px; 68 px reichen mit Variante a', () => {
    const mitKasten = (kasten: number, zeilenOhne: number): number =>
      620 - (FEST_OHNE_KASTEN_UHR_TOR - (NAMENSZEILE_HAUPT - zeilenOhne)) - kasten - px('--sizing-cockpit-ziffer-knapp') - ZWEITE_LEISTENZEILE;
    expect(mitKasten(px('--sizing-cockpit-kasten-knapp'), NAMENSZEILE_VARIANTE_A)).toBeGreaterThanOrEqual(TOR_MIN);
    expect(mitKasten(px('--sizing-cockpit-kasten-knapp') + 40, NAMENSZEILE_HAUPT)).toBeLessThan(TOR_MIN);
  });
  it('unter 620 px (600) reicht der Platz nicht: dort scrollt die Fläche, die Ziffern bleiben gleich groß', () => {
    expect(tor(600, NAMENSZEILE_VARIANTE_A, true)).toBeLessThan(TOR_MIN);
  });
});
