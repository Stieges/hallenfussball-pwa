/**
 * Größen am Handy (Token-Prüfung): Tasten je Folienzeile ≥ 44 px mit ≥ 8 px Abstand, Eingaben 16 px und ≥ 44 px hoch.
 */
import { describe, it, expect } from 'vitest';
import { cssVars, touchTargets, spacing, fontSizes } from '../../../../../design-tokens';
import { iconButtonStyle, inputStyle, selectStyle, slideActionsStyle, slideDescStyle } from '../monitorEditorStyles';

const px = (wert: string) => Number.parseFloat(wert);

describe('Größen im Monitor-Editor', () => {
  it('Tasten je Folienzeile sind mindestens 44 px hoch und breit', () => {
    expect(iconButtonStyle.minWidth).toBe(cssVars.touchTargets.minimum);
    expect(iconButtonStyle.minHeight).toBe(cssVars.touchTargets.minimum);
    expect(px(touchTargets.minimum)).toBeGreaterThanOrEqual(44);
  });

  it('zwischen den Tasten liegen mindestens 8 px', () => {
    expect(slideActionsStyle.gap).toBe(cssVars.spacing.sm);
    expect(px(spacing.sm)).toBeGreaterThanOrEqual(8);
  });

  it('Eingabefelder und Auswahlen haben 16 px Schrift und mindestens 44 px Höhe', () => {
    for (const stil of [inputStyle, selectStyle]) {
      expect(stil.fontSize).toBe(cssVars.fontSizes.lg);
      expect(stil.minHeight).toBe(cssVars.touchTargets.minimum);
    }
    expect(px(fontSizes.lg) * 16).toBeGreaterThanOrEqual(16);
  });

  it('Gegenbeispiel: die Beschreibung der Folienzeile wird nie mit „…“ abgeschnitten', () => {
    expect(slideDescStyle.textOverflow).toBeUndefined();
    expect(slideDescStyle.whiteSpace).toBeUndefined();
  });
});
