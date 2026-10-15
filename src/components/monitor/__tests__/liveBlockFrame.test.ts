/** B-44a2 Rahmenregel (@ZM-140): beide Kästen einheitlich mit dezentem Rahmen, kräftig bei Kontrast unter 3 : 1. */
import { describe, it, expect } from 'vitest';
import { displayLayout, monitorThemes } from '../../../design-tokens';
import { getBlockFrame } from '../liveBlockFrame';

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
    const f = getBlockFrame('#000000', bg, text);
    expect(f.width).toBe(L.frameWidthStrong);
    expect(f.color).toBe(text);
  });

  it('Gegenbeispiel: dezent ist schmaler als kräftig und nicht in voller Textfarbe', () => {
    const f = getBlockFrame('#DC2626', bg, text);
    expect(parseFloat(f.width)).toBeLessThan(parseFloat(L.frameWidthStrong));
    expect(f.color).not.toBe(text);
  });

  it('jede Farbe bekommt einen Rahmen (nie ohne)', () => {
    for (const c of ['#1E40AF', '#DC2626', '#FDE047', '#000000', '#FFFFFF', '#16A34A']) {
      expect(getBlockFrame(c, bg, text).width).toMatch(/px$/);
    }
  });
});
