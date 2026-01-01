/**
 * CSS Variables Design Tokens Tests
 *
 * Verifies that cssVars structure matches the CSS variables defined in global.css.
 * Ensures theme-switching will work correctly.
 */

import { describe, it, expect } from 'vitest';
import { cssVars } from '../cssVars';
import { colors } from '../colors';
import { spacing } from '../spacing';
import { fontSizes, fontWeights, fontFamilies } from '../typography';
import { radii } from '../radii';
import { shadows } from '../shadows';

describe('cssVars', () => {
  describe('structure', () => {
    it('should have colors namespace', () => {
      expect(cssVars.colors).toBeDefined();
      expect(typeof cssVars.colors).toBe('object');
    });

    it('should have spacing namespace', () => {
      expect(cssVars.spacing).toBeDefined();
      expect(typeof cssVars.spacing).toBe('object');
    });

    it('should have fontSizes namespace', () => {
      expect(cssVars.fontSizes).toBeDefined();
      expect(typeof cssVars.fontSizes).toBe('object');
    });

    it('should have fontWeights namespace', () => {
      expect(cssVars.fontWeights).toBeDefined();
      expect(typeof cssVars.fontWeights).toBe('object');
    });

    it('should have fontFamilies namespace', () => {
      expect(cssVars.fontFamilies).toBeDefined();
      expect(typeof cssVars.fontFamilies).toBe('object');
    });

    it('should have borderRadius namespace', () => {
      expect(cssVars.borderRadius).toBeDefined();
      expect(typeof cssVars.borderRadius).toBe('object');
    });

    it('should have shadows namespace', () => {
      expect(cssVars.shadows).toBeDefined();
      expect(typeof cssVars.shadows).toBe('object');
    });

    it('should have gradients namespace', () => {
      expect(cssVars.gradients).toBeDefined();
      expect(typeof cssVars.gradients).toBe('object');
    });
  });

  describe('CSS variable format', () => {
    it('colors should be var() references', () => {
      expect(cssVars.colors.primary).toMatch(/^var\(--/);
      expect(cssVars.colors.background).toMatch(/^var\(--/);
      expect(cssVars.colors.textPrimary).toMatch(/^var\(--/);
    });

    it('spacing should be var() references', () => {
      expect(cssVars.spacing.xs).toMatch(/^var\(--/);
      expect(cssVars.spacing.md).toMatch(/^var\(--/);
      expect(cssVars.spacing.xl).toMatch(/^var\(--/);
    });

    it('fontSizes should be var() references', () => {
      expect(cssVars.fontSizes.xs).toMatch(/^var\(--/);
      expect(cssVars.fontSizes.md).toMatch(/^var\(--/);
      expect(cssVars.fontSizes.xl).toMatch(/^var\(--/);
    });

    it('borderRadius should be var() references', () => {
      expect(cssVars.borderRadius.sm).toMatch(/^var\(--/);
      expect(cssVars.borderRadius.md).toMatch(/^var\(--/);
      expect(cssVars.borderRadius.full).toMatch(/^var\(--/);
    });
  });

  describe('color token coverage', () => {
    const colorKeys = Object.keys(colors).filter(
      // Exclude confettiColors which is an array
      (key) => key !== 'confettiColors'
    );

    it('should have cssVars equivalent for all color tokens', () => {
      colorKeys.forEach((key) => {
        const cssVarValue = cssVars.colors[key as keyof typeof cssVars.colors];
        expect(cssVarValue, `Missing cssVars.colors.${key}`).toBeDefined();
      });
    });
  });

  describe('spacing token coverage', () => {
    const spacingKeys = Object.keys(spacing);

    it('should have cssVars equivalent for all spacing tokens', () => {
      spacingKeys.forEach((key) => {
        const cssVarValue = cssVars.spacing[key as keyof typeof cssVars.spacing];
        expect(cssVarValue, `Missing cssVars.spacing.${key}`).toBeDefined();
      });
    });
  });

  describe('typography token coverage', () => {
    it('should have cssVars for all fontSizes', () => {
      Object.keys(fontSizes).forEach((key) => {
        const cssVarValue = cssVars.fontSizes[key as keyof typeof cssVars.fontSizes];
        expect(cssVarValue, `Missing cssVars.fontSizes.${key}`).toBeDefined();
      });
    });

    it('should have cssVars for all fontWeights', () => {
      Object.keys(fontWeights).forEach((key) => {
        const cssVarValue = cssVars.fontWeights[key as keyof typeof cssVars.fontWeights];
        expect(cssVarValue, `Missing cssVars.fontWeights.${key}`).toBeDefined();
      });
    });

    it('should have cssVars for all fontFamilies', () => {
      Object.keys(fontFamilies).forEach((key) => {
        const cssVarValue = cssVars.fontFamilies[key as keyof typeof cssVars.fontFamilies];
        expect(cssVarValue, `Missing cssVars.fontFamilies.${key}`).toBeDefined();
      });
    });

    it('should have cssVars for common lineHeights', () => {
      // cssLineHeights uses MD3-style keys (displayLg, bodyMd, etc.)
      const commonLineHeights = ['displayLg', 'headlineMd', 'title', 'bodyMd', 'bodySm'];
      commonLineHeights.forEach((key) => {
        const cssVarValue = cssVars.lineHeights[key as keyof typeof cssVars.lineHeights];
        expect(cssVarValue, `Missing cssVars.lineHeights.${key}`).toBeDefined();
      });
    });
  });

  describe('radii token coverage', () => {
    it('should have cssVars for all practical radii tokens', () => {
      // Skip 'none' as 0 doesn't need a CSS variable
      const radiiKeys = Object.keys(radii).filter((k) => k !== 'none');
      radiiKeys.forEach((key) => {
        const cssVarValue = cssVars.borderRadius[key as keyof typeof cssVars.borderRadius];
        expect(cssVarValue, `Missing cssVars.borderRadius.${key}`).toBeDefined();
      });
    });
  });

  describe('shadow token coverage', () => {
    it('should have cssVars for all practical shadow tokens', () => {
      // Skip 'none' as box-shadow: none doesn't need a CSS variable
      const shadowKeys = Object.keys(shadows).filter((k) => k !== 'none');
      shadowKeys.forEach((key) => {
        const cssVarValue = cssVars.shadows[key as keyof typeof cssVars.shadows];
        expect(cssVarValue, `Missing cssVars.shadows.${key}`).toBeDefined();
      });
    });
  });

  describe('gradient token coverage', () => {
    it('should have cssVars for theme-relevant gradient tokens', () => {
      // Only gradients that might change with theme are in cssVars
      // Hero, overlay, success, error, warning, info are static
      const themeGradients = ['primary', 'surface', 'card'];
      themeGradients.forEach((key) => {
        const cssVarValue = cssVars.gradients[key as keyof typeof cssVars.gradients];
        expect(cssVarValue, `Missing cssVars.gradients.${key}`).toBeDefined();
      });
    });
  });

  describe('theme namespace', () => {
    it('should have theme variables for corporate colors', () => {
      expect(cssVars.theme).toBeDefined();
      expect(cssVars.theme.primary).toMatch(/^var\(--theme-/);
      expect(cssVars.theme.secondary).toMatch(/^var\(--theme-/);
      expect(cssVars.theme.gradient).toMatch(/^var\(--theme-/);
    });

    it('should have hover and light variants', () => {
      expect(cssVars.theme.primaryHover).toMatch(/^var\(--theme-/);
      expect(cssVars.theme.primaryLight).toMatch(/^var\(--theme-/);
      expect(cssVars.theme.secondaryHover).toMatch(/^var\(--theme-/);
    });

    it('should have text-on-color tokens', () => {
      expect(cssVars.theme.onPrimary).toMatch(/^var\(--theme-/);
      expect(cssVars.theme.onSecondary).toMatch(/^var\(--theme-/);
    });
  });
});

describe('CSS Variable naming conventions', () => {
  it('colors should use color- prefix with kebab-case', () => {
    // All colors use --color- prefix for namespacing
    expect(cssVars.colors.textPrimary).toBe('var(--color-text-primary)');
    expect(cssVars.colors.surfaceHover).toBe('var(--color-surface-hover)');
    expect(cssVars.colors.borderActive).toBe('var(--color-border-active)');
  });

  it('status colors should use color-status- prefix', () => {
    expect(cssVars.colors.statusLive).toBe('var(--color-status-live)');
    expect(cssVars.colors.statusUpcoming).toBe('var(--color-status-upcoming)');
    expect(cssVars.colors.statusFinished).toBe('var(--color-status-finished)');
  });

  it('medal colors should use color-medal- prefix', () => {
    expect(cssVars.colors.medalGold).toBe('var(--color-medal-gold)');
    expect(cssVars.colors.medalSilver).toBe('var(--color-medal-silver)');
    expect(cssVars.colors.medalBronze).toBe('var(--color-medal-bronze)');
  });

  it('spacing should use spacing- prefix', () => {
    expect(cssVars.spacing.md).toBe('var(--spacing-md)');
    expect(cssVars.spacing.lg).toBe('var(--spacing-lg)');
  });

  it('font-sizes should use font-size- prefix', () => {
    expect(cssVars.fontSizes.md).toBe('var(--font-size-md)');
    expect(cssVars.fontSizes.lg).toBe('var(--font-size-lg)');
  });

  it('border-radius should use border-radius- prefix', () => {
    expect(cssVars.borderRadius.md).toBe('var(--border-radius-md)');
    expect(cssVars.borderRadius.lg).toBe('var(--border-radius-lg)');
  });
});
