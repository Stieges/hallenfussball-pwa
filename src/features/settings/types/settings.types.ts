/**
 * Settings Types - TypeScript Definitionen für Einstellungen
 *
 * Zwei-Ebenen Theme-System:
 * - BaseTheme: Leuchtdichte (light/dark/high-contrast)
 * - AccentTheme: Vereinsfarben (Pro-Feature)
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import i18n from 'i18next';

// =============================================================================
// Schriftgröße
// =============================================================================

export type FontSize = 'small' | 'normal' | 'large' | 'x-large';

export const FONT_SIZE_LABELS: Record<FontSize, string> = Object.create(null, {
  small: { get: () => i18n.t('settings:fontSize.small', { defaultValue: '' }), enumerable: true },
  normal: { get: () => i18n.t('settings:fontSize.normal', { defaultValue: '' }), enumerable: true },
  large: { get: () => i18n.t('settings:fontSize.large', { defaultValue: '' }), enumerable: true },
  'x-large': { get: () => i18n.t('settings:fontSize.xLarge', { defaultValue: '' }), enumerable: true },
}) as Record<FontSize, string>;

export const FONT_SCALE_VALUES: Record<FontSize, number> = {
  small: 0.875,
  normal: 1,
  large: 1.125,
  'x-large': 1.25,
};

// =============================================================================
// Base Theme (Ebene 1 - Leuchtdichte)
// =============================================================================

export type BaseTheme = 'system' | 'light' | 'dark' | 'high-contrast';

type BaseThemeLabelRecord = Record<BaseTheme, { label: string; description: string; icon: string }>;
export const BASE_THEME_LABELS: BaseThemeLabelRecord = Object.create(null, {
  system: {
    get: () => ({
      label: i18n.t('settings:baseTheme.system.label', { defaultValue: '' }),
      description: i18n.t('settings:baseTheme.system.description', { defaultValue: '' }),
      icon: '🔄',
    }),
    enumerable: true,
  },
  light: {
    get: () => ({
      label: i18n.t('settings:baseTheme.light.label', { defaultValue: '' }),
      description: i18n.t('settings:baseTheme.light.description', { defaultValue: '' }),
      icon: '☀️',
    }),
    enumerable: true,
  },
  dark: {
    get: () => ({
      label: i18n.t('settings:baseTheme.dark.label', { defaultValue: '' }),
      description: i18n.t('settings:baseTheme.dark.description', { defaultValue: '' }),
      icon: '🌙',
    }),
    enumerable: true,
  },
  'high-contrast': {
    get: () => ({
      label: i18n.t('settings:baseTheme.highContrast.label', { defaultValue: '' }),
      description: i18n.t('settings:baseTheme.highContrast.description', { defaultValue: '' }),
      icon: '◐',
    }),
    enumerable: true,
  },
}) as BaseThemeLabelRecord;

// =============================================================================
// Accent Theme (Ebene 2 - Identität) - Pro Feature
// =============================================================================

export type AccentThemeId =
  | 'default'
  | 'fc-bayern'
  | 'bvb'
  | 'schalke'
  | 'werder'
  | 'hsv'
  | 'custom';

export interface AccentTheme {
  id: AccentThemeId;
  name: string;
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
  isPro: boolean;
}

// Note: Club names (FC Bayern, BVB, etc.) are proper nouns and don't need translation.
// Only "Standard (Grün)" and "Eigene Farben" are translated.
const _accentThemeBase = {
  default: {
    id: 'default' as const,
    primary: '#00E676',
    primaryText: '#000000',
    secondary: '#00B0FF',
    secondaryText: '#000000',
    isPro: false,
  },
  'fc-bayern': {
    id: 'fc-bayern' as const,
    name: 'FC Bayern München',
    primary: '#DC052D',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#DC052D',
    isPro: true,
  },
  bvb: {
    id: 'bvb' as const,
    name: 'Borussia Dortmund',
    primary: '#FDE100',
    primaryText: '#000000',
    secondary: '#000000',
    secondaryText: '#FDE100',
    isPro: true,
  },
  schalke: {
    id: 'schalke' as const,
    name: 'FC Schalke 04',
    primary: '#004D9D',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#004D9D',
    isPro: true,
  },
  werder: {
    id: 'werder' as const,
    name: 'Werder Bremen',
    primary: '#1D9053',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#1D9053',
    isPro: true,
  },
  hsv: {
    id: 'hsv' as const,
    name: 'Hamburger SV',
    primary: '#0A3D91',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#0A3D91',
    isPro: true,
  },
  custom: {
    id: 'custom' as const,
    primary: '#00E676',
    primaryText: '#000000',
    secondary: '#00B0FF',
    secondaryText: '#000000',
    isPro: true,
  },
};

export const ACCENT_THEMES: Record<AccentThemeId, AccentTheme> = Object.create(null, {
  default: {
    get: () => ({ ..._accentThemeBase.default, name: i18n.t('settings:accentTheme.default', { defaultValue: '' }) }),
    enumerable: true,
  },
  'fc-bayern': { value: _accentThemeBase['fc-bayern'], enumerable: true },
  bvb: { value: _accentThemeBase.bvb, enumerable: true },
  schalke: { value: _accentThemeBase.schalke, enumerable: true },
  werder: { value: _accentThemeBase.werder, enumerable: true },
  hsv: { value: _accentThemeBase.hsv, enumerable: true },
  custom: {
    get: () => ({ ..._accentThemeBase.custom, name: i18n.t('settings:accentTheme.custom', { defaultValue: '' }) }),
    enumerable: true,
  },
}) as Record<AccentThemeId, AccentTheme>;

// =============================================================================
// Custom Colors (Pro Feature)
// =============================================================================

export interface CustomColors {
  primary: string;
  primaryText: string;
  secondary: string;
  secondaryText: string;
}

export const DEFAULT_CUSTOM_COLORS: CustomColors = {
  primary: '#00E676',
  primaryText: '#000000',
  secondary: '#00B0FF',
  secondaryText: '#000000',
};

// =============================================================================
// App Settings (ohne Theme - das ist in useTheme)
// =============================================================================

export interface AppSettings {
  // Schriftgröße
  fontSize: FontSize;

  // Sprache (Phase 2 - i18n)
  language: 'de' | 'en' | 'system';

  // App-Verhalten
  confirmDelete: boolean;
  autoSave: boolean;
  timerSound: boolean;
  hapticFeedback: boolean;

  // Meta
  version: string;
  lastUpdated: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'normal',
  language: 'system',
  confirmDelete: true,
  autoSave: true,
  timerSound: true,
  hapticFeedback: true,
  version: '',
  lastUpdated: '',
};

// =============================================================================
// Theme State (für erweiterten useTheme Hook)
// =============================================================================

export interface ThemeState {
  // Ebene 1: Leuchtdichte
  baseTheme: BaseTheme;

  // Ebene 2: Identität (Pro-Feature)
  accentTheme: AccentThemeId;

  // Custom Colors (Pro-Feature)
  customColors: CustomColors;
}

export const DEFAULT_THEME_STATE: ThemeState = {
  baseTheme: 'system',
  accentTheme: 'default',
  customColors: DEFAULT_CUSTOM_COLORS,
};

// =============================================================================
// Export Data Format
// =============================================================================

export interface ExportData {
  version: '1.0';
  exportedAt: string;
  data: {
    settings: AppSettings;
    theme: ThemeState;
  };
}

// =============================================================================
// Settings Categories für UI
// =============================================================================

export type SettingsCategory =
  | 'appearance'
  | 'language'
  | 'behavior'
  | 'data'
  | 'support'
  | 'about'
  | 'legal';

type SettingsCategoryRecord = Record<SettingsCategory, { label: string; icon: string }>;
export const SETTINGS_CATEGORIES: SettingsCategoryRecord = Object.create(null, {
  appearance: { get: () => ({ label: i18n.t('settings:categories.appearance', { defaultValue: '' }), icon: '🎨' }), enumerable: true },
  language: { get: () => ({ label: i18n.t('settings:categories.language', { defaultValue: '' }), icon: '🌍' }), enumerable: true },
  behavior: { get: () => ({ label: i18n.t('settings:categories.behavior', { defaultValue: '' }), icon: '⚡' }), enumerable: true },
  data: { get: () => ({ label: i18n.t('settings:categories.data', { defaultValue: '' }), icon: '💾' }), enumerable: true },
  support: { get: () => ({ label: i18n.t('settings:categories.support', { defaultValue: '' }), icon: '❓' }), enumerable: true },
  about: { get: () => ({ label: i18n.t('settings:categories.about', { defaultValue: '' }), icon: 'ℹ️' }), enumerable: true },
  legal: { get: () => ({ label: i18n.t('settings:categories.legal', { defaultValue: '' }), icon: '⚖️' }), enumerable: true },
}) as SettingsCategoryRecord;
