/**
 * Theme Manager Tests
 *
 * Tests for corporate color theme management and CSS variable injection.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  applyCorporateColors,
  resetToDefaultTheme,
  saveTheme,
  loadTheme,
  clearTheme,
  createThemeConfig,
  getCurrentConfig,
  isCustomTheme,
  DEFAULT_COLORS,
  type CorporateColors,
} from '../themeManager';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string | undefined> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      store[key] = undefined;
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ThemeManager', () => {
  beforeEach(() => {
    // Reset DOM
    document.documentElement.style.cssText = '';
    // Reset localStorage mock
    localStorageMock.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetToDefaultTheme();
  });

  describe('applyCorporateColors', () => {
    it('should set theme-primary CSS variable', () => {
      const colors: CorporateColors = {
        primary: '#FF5722',
        secondary: '#2196F3',
      };

      applyCorporateColors(colors);

      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#FF5722');
    });

    it('should set theme-secondary CSS variable', () => {
      const colors: CorporateColors = {
        primary: '#FF5722',
        secondary: '#2196F3',
      };

      applyCorporateColors(colors);

      expect(document.documentElement.style.getPropertyValue('--theme-secondary')).toBe('#2196F3');
    });

    it('should set hover states (darkened colors)', () => {
      const colors: CorporateColors = {
        primary: '#00E676',
        secondary: '#00B0FF',
      };

      applyCorporateColors(colors);

      // Hover states should be set (darker than original)
      const hoverValue = document.documentElement.style.getPropertyValue('--theme-primary-hover');
      expect(hoverValue).toBeTruthy();
      expect(hoverValue).not.toBe('#00E676'); // Should be different from primary
    });

    it('should set light/alpha variants', () => {
      const colors: CorporateColors = {
        primary: '#00E676',
        secondary: '#00B0FF',
      };

      applyCorporateColors(colors);

      const lightValue = document.documentElement.style.getPropertyValue('--theme-primary-light');
      expect(lightValue).toBeTruthy();
      expect(lightValue).toContain('rgba'); // Should be RGBA format
    });

    it('should set gradient', () => {
      const colors: CorporateColors = {
        primary: '#FF5722',
        secondary: '#2196F3',
      };

      applyCorporateColors(colors);

      const gradient = document.documentElement.style.getPropertyValue('--theme-gradient');
      expect(gradient).toContain('linear-gradient');
      expect(gradient).toContain('#FF5722');
      expect(gradient).toContain('#2196F3');
    });

    it('should auto-calculate text colors for contrast', () => {
      // Dark primary should get light text
      const colors: CorporateColors = {
        primary: '#1a1a1a', // Very dark
        secondary: '#ffffff', // Very light
      };

      applyCorporateColors(colors);

      const textOnPrimary = document.documentElement.style.getPropertyValue('--theme-on-primary');
      const textOnSecondary = document.documentElement.style.getPropertyValue('--theme-on-secondary');

      expect(textOnPrimary).toBeTruthy();
      expect(textOnSecondary).toBeTruthy();
    });

    it('should use provided text colors if specified', () => {
      const colors: CorporateColors = {
        primary: '#00E676',
        secondary: '#00B0FF',
        textOnPrimary: '#FFFFFF',
        textOnSecondary: '#000000',
      };

      applyCorporateColors(colors);

      expect(document.documentElement.style.getPropertyValue('--theme-on-primary')).toBe('#FFFFFF');
      expect(document.documentElement.style.getPropertyValue('--theme-on-secondary')).toBe('#000000');
    });
  });

  describe('resetToDefaultTheme', () => {
    it('should remove all theme properties', () => {
      // First apply some colors
      applyCorporateColors({
        primary: '#FF5722',
        secondary: '#2196F3',
      });

      // Verify they are set
      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#FF5722');

      // Reset
      resetToDefaultTheme();

      // Verify they are removed
      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('');
    });

    it('should clear current config', () => {
      // Apply and save
      applyCorporateColors({
        primary: '#FF5722',
        secondary: '#2196F3',
      });

      // Reset
      resetToDefaultTheme();

      // Config should be null
      expect(getCurrentConfig()).toBeNull();
    });
  });

  describe('saveTheme / loadTheme', () => {
    it('should save theme to localStorage', async () => {
      const config = createThemeConfig({
        primary: '#FF5722',
        secondary: '#2196F3',
      });

      await saveTheme(config);

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'hallenfussball_theme',
        expect.any(String)
      );
    });

    it('should load theme from localStorage and apply it', async () => {
      const config = createThemeConfig({
        primary: '#FF5722',
        secondary: '#2196F3',
      });

      // Store directly in mock
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(config));

      await loadTheme();

      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('#FF5722');
    });

    it('should return null when no theme is stored', async () => {
      localStorageMock.getItem.mockReturnValueOnce(null);

      const result = await loadTheme();

      expect(result).toBeNull();
    });
  });

  describe('clearTheme', () => {
    it('should remove theme from localStorage', async () => {
      await clearTheme();

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('hallenfussball_theme');
    });

    it('should reset to default theme', async () => {
      applyCorporateColors({
        primary: '#FF5722',
        secondary: '#2196F3',
      });

      await clearTheme();

      expect(document.documentElement.style.getPropertyValue('--theme-primary')).toBe('');
    });
  });

  describe('createThemeConfig', () => {
    it('should create config with colors', () => {
      const colors: CorporateColors = {
        primary: '#FF5722',
        secondary: '#2196F3',
      };

      const config = createThemeConfig(colors);

      expect(config.colors).toEqual(colors);
      expect(config.customized).toBe(false);
      expect(config.updatedAt).toBeTruthy();
    });

    it('should accept preset options', () => {
      const config = createThemeConfig(
        { primary: '#FF5722', secondary: '#2196F3' },
        { presetId: 'fc-bayern', customized: true }
      );

      expect(config.presetId).toBe('fc-bayern');
      expect(config.customized).toBe(true);
    });
  });

  describe('isCustomTheme', () => {
    it('should return false when no theme is applied', () => {
      expect(isCustomTheme()).toBe(false);
    });

    it('should return true when custom colors differ from default', async () => {
      const config = createThemeConfig({
        primary: '#FF5722', // Different from default #00E676
        secondary: '#2196F3',
      });

      await saveTheme(config);

      expect(isCustomTheme()).toBe(true);
    });
  });

  describe('DEFAULT_COLORS', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_COLORS.primary).toBe('#00E676');
      expect(DEFAULT_COLORS.secondary).toBe('#00B0FF');
    });
  });
});
