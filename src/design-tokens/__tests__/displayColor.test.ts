/**
 * B-44a2 Rahmenregel (@ZM-140): beide Kästen einheitlich mit dezentem Rahmen, kräftig bei Kontrast unter 3 : 1
 * (aus `components/monitor/liveBlockFrame.ts` hierher verschoben, Spielanzeige 2.2).
 * Dazu `mixHex` (Verlierer-Dämpfung, @ZM-156) und die Tokens `vestStripeShare` (@ZM-161) und `borderWidths`.
 */
import { describe, it, expect } from 'vitest';
import { borderWidths, cssVars, displayLayout, monitorThemes } from '..';
import { getContrastRatio } from '../display';
import { getBlockFrame, getBlockFrames, mixHex } from '../displayColor';
import { palette } from '../colors/palette';

const L = displayLayout.scoreArea;
const bg = monitorThemes.dark.background;
const text = monitorThemes.dark.text;

describe('getBlockFrame', () => {
  it('Rot und Gelb (Kontrast ≥ 3 : 1): dezenter Rahmen, bei beiden gleich', () => {
    const rot = getBlockFrame('#DC2626', bg, text);
    const gelb = getBlockFrame('#FDE047', bg, text);
    expect(rot.width).toBe(L.frameWidthSubtle);
    expect(gelb).toEqual({ ...rot });
  });

  it('Blau (Kontrast < 3 : 1 auf dem dunklen Monitor): kräftiger Rahmen', () => {
    expect(getBlockFrame('#1E40AF', bg, text).width).toBe(L.frameWidthStrong);
  });

  it('Schwarz (Kontrast < 3 : 1): kräftiger Rahmen in Textfarbe', () => {
    const f = getBlockFrame(palette.kit.black, bg, text);
    expect(f.width).toBe(L.frameWidthStrong);
    expect(f.color).toBe(text);
  });

  it('Gegenbeispiel: dezent ist schmaler als kräftig und nicht in voller Textfarbe', () => {
    const f = getBlockFrame('#DC2626', bg, text);
    expect(parseFloat(f.width)).toBeLessThan(parseFloat(L.frameWidthStrong));
    expect(f.color).not.toBe(text);
  });

  it('jede Farbe bekommt einen Rahmen (nie ohne)', () => {
    for (const c of ['#1E40AF', '#DC2626', '#FDE047', palette.kit.black, palette.neutral[0], '#16A34A']) {
      expect(getBlockFrame(c, bg, text).width).toMatch(/px$/);
    }
  });
});

describe('getBlockFrames (Entscheidung Daniel 2026-10-15): gleiche Rahmenbreite beider Kästen', () => {
  it('Blau (kräftig) und Rot (dezent): beide bekommen die kräftige Breite, Farben bleiben je Kasten', () => {
    const f = getBlockFrames('#1E40AF', '#DC2626', bg, text);
    expect(f.home.width).toBe(L.frameWidthStrong);
    expect(f.away.width).toBe(f.home.width);
    expect(f.away.color).not.toBe(f.home.color);
  });

  it('Gegenbeispiel: zwei dezente Kästen behalten die dezente Breite', () => {
    const f = getBlockFrames('#DC2626', '#FDE047', bg, text);
    expect(f.home.width).toBe(L.frameWidthSubtle);
    expect(f.away.width).toBe(L.frameWidthSubtle);
  });
});

describe('getBlockFrame mit eigenen Breiten (ScoreBox compact/row)', () => {
  const widths = { subtle: borderWidths.medium, strong: borderWidths.strong };

  it('@ZM-140 Schwarz auf dunklem Grund: kräftige Breite der übergebenen Breiten, Rahmen in Textfarbe', () => {
    expect(getBlockFrame(palette.kit.black, bg, text, widths)).toEqual({ width: borderWidths.strong, color: text });
  });

  it('@ZM-140 Gegenbeispiel: Gelb auf dunklem Grund bekommt die dezente der übergebenen Breiten', () => {
    expect(getBlockFrame(palette.yellow[400], bg, text, widths).width).toBe(borderWidths.medium);
  });
});

describe('mixHex (B4: Anteil kommt als Zahl, nicht als „30%“)', () => {
  it('@ZM-156 Blau #1565C0 zu 30 % in Weiß: #5B93D3 (Wert aus dem Mockup)', () => {
    expect(mixHex(palette.kit.blue, palette.neutral[0], 0.3)).toBe('#5B93D3');
  });

  it('@ZM-156 Rot #C62828 zu 30 % in den dunklen Grund #0A1628: #8E2328 (Wert aus dem Mockup)', () => {
    expect(mixHex(palette.kit.red, '#0A1628', 0.3)).toBe('#8E2328');
  });

  it('Anteil 0 liefert die Farbe, Anteil 1 die andere; Kurzform und Kleinbuchstaben werden gelesen', () => {
    expect(mixHex('#1565c0', '#fff', 0)).toBe(palette.kit.blue);
    expect(mixHex(palette.kit.blue, '#fff', 1)).toBe(palette.neutral[0]);
  });

  it('Gegenbeispiel: ungültige Farbe wird unverändert zurückgegeben statt zu werfen', () => {
    expect(mixHex('blau', palette.neutral[0], 0.3)).toBe('blau');
  });
});

describe('Tokens der Spielanzeige 2.2', () => {
  it('@ZM-161 die Streifen der Weste sind 14 % je Seite breit (Mockup --vest: 14%)', () => {
    expect(displayLayout.scoreArea.vestStripeShare).toBe(0.14);
  });

  it('borderWidths: thin 1, medium 2, strong 3 px; cssVars.borderWidth.thin bleibt derselbe Wert', () => {
    expect(borderWidths).toEqual({ thin: '1px', medium: '2px', strong: '3px' });
    expect(cssVars.borderWidth.thin).toBe(borderWidths.thin);
  });

  it('@ZM-156 Blau #1565C0 gedämpft auf Weiß: schwarze Ziffern 6,56 : 1 (weiße nur 3,2 : 1)', () => {
    const gedaempft = mixHex(palette.kit.blue, palette.neutral[0], 0.3);
    expect(getContrastRatio(gedaempft, palette.kit.black)).toBeCloseTo(6.56, 1);
    expect(getContrastRatio(gedaempft, palette.neutral[0])).toBeCloseTo(3.2, 1);
  });
});
