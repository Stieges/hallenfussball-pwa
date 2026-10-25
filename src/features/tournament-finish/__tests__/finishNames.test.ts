/**
 * R3-4 Teamnamen brechen nie mitten im Wort (visuelle Prüfung `titel.wortbruch`, VISUAL-DESIGN § 2; Mockup NOTIZ 3: 50-Zeichen-Namen).
 */
import { describe, expect, it } from 'vitest';
import { keepTogether } from '../model/finishNames';

describe('Namen mit Bindestrich bleiben beisammen', () => {
  it('„Kleinstadt-Neudorf“ und „Rot-Weiß“ tragen das geschützte Trennzeichen, Leerzeichen bleiben Umbruchstellen', () => {
    const name = keepTogether('Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921');
    expect(name).toBe('Spielvereinigung Grün\u2011Gelb Kleinstadt\u2011Neudorf 1921');
    expect(name).toContain(' ');
    expect(name.replace(/\u2011/g, '-')).toBe('Spielvereinigung Grün-Gelb Kleinstadt-Neudorf 1921');
  });

  it('mehrere Bindestriche in einem Wort', () => {
    expect(keepTogether('A-B-C')).toBe('A\u2011B\u2011C');
  });

  it('Gegenbeispiele: Bindestrich am Rand oder zwischen Leerzeichen („FC – Süd“) bleibt unberührt, Namen ohne Bindestrich auch', () => {
    expect(keepTogether('FC Nord')).toBe('FC Nord');
    expect(keepTogether('FC - Süd')).toBe('FC - Süd');
    expect(keepTogether('-Nord-')).toBe('-Nord-');
  });
});
