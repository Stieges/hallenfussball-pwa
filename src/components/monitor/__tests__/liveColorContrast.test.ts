/**
 * @ZM-140 Der Monitor zeigt die getragene Farbe gut sichtbar:
 * Ziffern mindestens 4,5 : 1, Kasten mindestens 3 : 1 zum Hintergrund, sonst heller Rahmen. Ohne Farbe Blau.
 */
import { describe, it, expect } from 'vitest';
import {
  getContrastRatio,
  getScoreTextColor,
  needsContrastFrame,
} from '../../../design-tokens/display';
import { DEFAULT_SPECTATOR_DISPLAY } from '../../../core/models/spectatorDisplay';

import { monitorThemes } from '../../../design-tokens';

// M4: gegen die echten Hintergrund-Tokens, nicht gegen einen Testwert
const DARK_BACKGROUND = monitorThemes.dark.background;
const LIGHT_BACKGROUND = monitorThemes.light.background;
const SAMPLE_COLORS = ['#1E40AF', '#DC2626', '#FDE047', '#000000', '#FFFFFF', '#16A34A', '#F97316'];

describe('@ZM-140 Ziffernfarbe nach Kontrast', () => {
  it.each(SAMPLE_COLORS)('Ziffern auf %s erreichen mindestens 4,5 : 1', (bg) => {
    expect(getContrastRatio(getScoreTextColor(bg), bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('Gelb als Leibchen: schwarze Ziffern', () => {
    expect(getScoreTextColor('#FDE047')).toBe('#171717');
  });

  it('Schwarz als Leibchen: weiße Ziffern', () => {
    expect(getScoreTextColor('#000000')).toBe('#FFFFFF');
  });

  it('Gegenbeispiel: Blau bekommt nicht schwarze Ziffern', () => {
    expect(getScoreTextColor('#1E40AF')).toBe('#FFFFFF');
  });
});

describe('@ZM-140 Kasten hebt sich vom Hintergrund ab (echte Token-Werte)', () => {
  it('Schwarz auf dunklem Monitor-Hintergrund: Rahmen nötig', () => {
    expect(needsContrastFrame('#000000', DARK_BACKGROUND)).toBe(true);
  });

  it('Gelb auf dunklem Monitor-Hintergrund: kein Rahmen', () => {
    expect(needsContrastFrame('#FDE047', DARK_BACKGROUND)).toBe(false);
  });

  it('Blau auf dunklem Monitor-Hintergrund: Rahmen (Kontrast unter 3 : 1)', () => {
    expect(getContrastRatio('#1E40AF', DARK_BACKGROUND)).toBeLessThan(3);
    expect(needsContrastFrame('#1E40AF', DARK_BACKGROUND)).toBe(true);
  });

  it('Weiß auf hellem Monitor-Hintergrund: Rahmen nötig', () => {
    expect(needsContrastFrame('#FFFFFF', LIGHT_BACKGROUND)).toBe(true);
  });

  it('Schwarz auf hellem Monitor-Hintergrund: kein Rahmen', () => {
    expect(needsContrastFrame('#000000', LIGHT_BACKGROUND)).toBe(false);
  });
});

// W14: die Vorgabe liegt nicht mehr an der Monitor-Folie, sondern in der Turnier-Einstellung „Anzeige für Zuschauer“ (@ZM-152)
describe('@ZM-152 Vorbelegung der Standardfarben ist Blau (Heim) und Rot (Gast)', () => {
  it('@ZM-152 Vorbelegung: Teamfarben an, Heim Blau, Gast Rot', () => {
    expect(DEFAULT_SPECTATOR_DISPLAY).toEqual({ teamColors: true, homeColor: '#1565C0', awayColor: '#C62828' });
  });

  it('@ZM-140 Gegenbeispiel: die alten Folien-Vorgaben #1E40AF und #DC2626 gelten nirgends mehr', () => {
    expect(Object.values(DEFAULT_SPECTATOR_DISPLAY)).not.toContain('#1E40AF');
    expect(Object.values(DEFAULT_SPECTATOR_DISPLAY)).not.toContain('#DC2626');
  });
});
