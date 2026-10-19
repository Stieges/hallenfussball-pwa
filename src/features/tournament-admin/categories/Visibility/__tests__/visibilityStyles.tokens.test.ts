/**
 * Spielanzeige 2.3 Fixrunde A1: keine festen px-Werte in den Stilen der Sichtbarkeits-Seite (Plan Global Constraints:
 * „auch nicht beim Verschieben“). Zahlen ohne Einheit sind nur für Faktoren erlaubt (flex, flexShrink, opacity).
 */
import { describe, it, expect } from 'vitest';
import { visibilityStyles } from '../visibilityStyles';
import { cssVars } from '../../../../../design-tokens';

const FAKTOREN = new Set(['flex', 'flexShrink', 'opacity']);

describe('visibilityStyles nutzt nur Tokens', () => {
  const eintraege = Object.entries(visibilityStyles).flatMap(([name, stil]) => Object.entries(stil).map(([eigenschaft, wert]) => ({ name, eigenschaft, wert })));

  it('A1 kein Wert enthält ein px-Literal', () => {
    expect(eintraege.filter((e) => typeof e.wert === 'string' && /\d+(\.\d+)?px/.test(e.wert.split(cssVars.borderWidth.thin).join(''))).map((e) => `${e.name}.${e.eigenschaft}`)).toEqual([]);
  });

  it('A1 Zahlen ohne Einheit nur bei flex, flexShrink, opacity', () => {
    expect(eintraege.filter((e) => typeof e.wert === 'number' && e.wert !== 0 && !FAKTOREN.has(e.eigenschaft)).map((e) => `${e.name}.${e.eigenschaft}`)).toEqual([]);
  });

  it('Gegenbeispiel: die Rahmen nutzen die Token-Breite', () => {
    expect(String(visibilityStyles.linkInput.border)).toContain('var(');
  });
});
