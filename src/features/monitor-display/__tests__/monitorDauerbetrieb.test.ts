/**
 * Regeln des Monitor-Dauerbetriebs (B-17): Tasten, Vollbild-Taste, Browser-Quelle.
 * Gegenbeispiele: Escape und Leertaste verlassen die Seite nicht; Strg+f gehört dem Browser.
 * Szenarien: @ME-002, @ME-003, @ME-006, @ME-022.
 */
import { describe, it, expect } from 'vitest';
import { istAbgefangeneTaste, istBrowserQuelle, istVollbildTaste, MAUSZEIGER_RUHE_MS, VOLLBILD_TASTE } from '../monitorDauerbetrieb';

const taste = (key: string, extra: Partial<KeyboardEvent> = {}) =>
  ({ key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, ...extra });

describe('istAbgefangeneTaste (@ME-003, @ME-022)', () => {
  it.each(['Escape', ' ', 'Backspace', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'])(
    '%j wird abgefangen, die Seite verlässt sich nicht selbst',
    (key) => {
      expect(istAbgefangeneTaste(key)).toBe(true);
    },
  );

  it('Gegenbeispiel: die Taste „c“ (Cache-Anzeige) und Buchstaben werden nicht abgefangen', () => {
    expect(istAbgefangeneTaste('c')).toBe(false);
    expect(istAbgefangeneTaste('f')).toBe(false);
  });
});

describe('istVollbildTaste (@ME-002)', () => {
  it('„f“ löst das Vollbild aus, auch in Großschreibung', () => {
    expect(VOLLBILD_TASTE).toBe('f');
    expect(istVollbildTaste(taste('f'))).toBe(true);
    expect(istVollbildTaste(taste('F'))).toBe(true);
  });

  it('Gegenbeispiel: Strg+f, Cmd+f, Alt+f und Autowiederholung lösen nichts aus', () => {
    expect(istVollbildTaste(taste('f', { ctrlKey: true }))).toBe(false);
    expect(istVollbildTaste(taste('f', { metaKey: true }))).toBe(false);
    expect(istVollbildTaste(taste('f', { altKey: true }))).toBe(false);
    expect(istVollbildTaste(taste('f', { repeat: true }))).toBe(false);
  });

  it('Gegenbeispiel: andere Tasten lösen kein Vollbild aus', () => {
    expect(istVollbildTaste(taste('Escape'))).toBe(false);
    expect(istVollbildTaste(taste(' '))).toBe(false);
  });
});

describe('istBrowserQuelle (@ME-006)', () => {
  it('die feste Adresse /tv ist die Browser-Quelle', () => {
    expect(istBrowserQuelle('#/tv', 'Mozilla/5.0 Chrome/120')).toBe(true);
    expect(istBrowserQuelle('#/tv/', 'Mozilla/5.0 Chrome/120')).toBe(true);
  });

  it('eine OBS-Kennung im User-Agent ist die Browser-Quelle', () => {
    expect(istBrowserQuelle('#/display/t/mon-1', 'Mozilla/5.0 OBS/30.0')).toBe(true);
  });

  it('Gegenbeispiel: der normale Monitor-Link und der normale Browser sind keine Browser-Quelle', () => {
    expect(istBrowserQuelle('#/display/t1/mon-1', 'Mozilla/5.0 Chrome/120')).toBe(false);
    expect(istBrowserQuelle('#/tvprogramm', 'Mozilla/5.0 Chrome/120')).toBe(false);
  });

  it('die Ruhe-Zeit des Mauszeigers ist wenige Sekunden', () => {
    expect(MAUSZEIGER_RUHE_MS).toBeGreaterThanOrEqual(2_000);
    expect(MAUSZEIGER_RUHE_MS).toBeLessThanOrEqual(5_000);
  });
});
