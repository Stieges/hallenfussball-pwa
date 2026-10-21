/**
 * Token des Cockpits am Laptop (Plan LT-2, B4, Daniel 18.10.): jedes CSS-Token steht in `global.css` und wird von `cssVars` genannt;
 * `borderWidths` (TS) und die CSS-Variablen haben dieselben Werte.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cssVars } from '../cssVars';
import { borderWidths } from '../sizing';

const css = readFileSync(resolve(__dirname, '../../styles/global.css'), 'utf8');

describe('Cockpit-Laptop-Tokens (B4)', () => {
  it.each([
    ['cockpitEreignisspalte', '--sizing-cockpit-ereignisspalte', '25rem'],
    ['cockpitTorBreit', '--sizing-cockpit-tor-breit', 'calc(var(--touch-target-minimum) * 2)'],
    ['cockpitLeisteBreit', '--sizing-cockpit-leiste-breit', 'calc(var(--touch-target-primary) + var(--spacing-sm))'],
    ['cockpitMehrBreit', '--sizing-cockpit-mehr-breit', '6rem'],
    ['feldwahlMax', '--sizing-feldwahl-max', '26.25rem'],
  ] as const)('%s → var(%s) mit dem freigegebenen Wert %s', (schluessel, name, wert) => {
    expect(cssVars.sizing[schluessel]).toBe(`var(${name})`);
    expect(css).toContain(`${name}: ${wert};`);
  });

  it.each(['thin', 'medium', 'strong'] as const)('Rahmenbreite %s: die CSS-Variable (für CSS-Module) hat denselben Wert wie borderWidths (TS)', (stufe) => {
    expect(css).toContain(`--border-width-${stufe}: ${borderWidths[stufe]};`);
  });

  it('Gegenbeispiel: die Ereignisspalte ist nicht die alte Seitenleiste (300 px) und die Tor-Höhe ist kein festes Maß', () => {
    expect(css).not.toContain('--sizing-cockpit-ereignisspalte: 300px');
    expect(css).not.toMatch(/--sizing-cockpit-tor-breit:\s*\d+px/);
  });
});

describe('Vorwarnung der Zeile „Nächstes“ (Plan LT-3, B4, @SL-155)', () => {
  it('--color-next-warn-border steht in allen drei Themes (hell, dunkel, hoher Kontrast) und cssVars nennt es', () => {
    expect(cssVars.colors.nextWarnBorder).toBe('var(--color-next-warn-border)');
    expect(css.match(/--color-next-warn-border:/g)).toHaveLength(3);
  });
  it('Gegenbeispiel: die Rahmenfarbe ist kein Fehler-Rot (die Zeile ist ein Aufruf, kein Fehler, C-COCKPIT-NAECHSTES-WIE-FEHLER)', () => {
    expect(css).not.toMatch(/--color-next-warn-border:\s*var\(--color-error/);
  });
});
