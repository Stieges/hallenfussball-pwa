/**
 * Settings Types - TypeScript Definitionen für Einstellungen
 *
 * Zwei-Ebenen Theme-System:
 * - BaseTheme: Leuchtdichte (light/dark/high-contrast)
 * - AccentTheme: Vereinsfarben (Pro-Feature)
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

// =============================================================================
// Schriftgröße
// =============================================================================

export type FontSize = 'small' | 'normal' | 'large' | 'x-large';

export const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: 'Klein',
  normal: 'Normal',
  large: 'Groß',
  'x-large': 'Sehr groß',
};

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

export const BASE_THEME_LABELS: Record<BaseTheme, { label: string; description: string; icon: string }> = {
  system: {
    label: 'System',
    description: 'Automatisch nach Geräteeinstellung',
    icon: '🔄',
  },
  light: {
    label: 'Hell',
    description: 'Helles Erscheinungsbild',
    icon: '☀️',
  },
  dark: {
    label: 'Dunkel',
    description: 'Dunkles Erscheinungsbild',
    icon: '🌙',
  },
  'high-contrast': {
    label: 'Hoher Kontrast',
    description: 'Maximale Lesbarkeit bei hellem Umgebungslicht',
    icon: '◐',
  },
};

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

export const ACCENT_THEMES: Record<AccentThemeId, AccentTheme> = {
  default: {
    id: 'default',
    name: 'Standard (Grün)',
    primary: '#00E676',
    primaryText: '#000000',
    secondary: '#00B0FF',
    secondaryText: '#000000',
    isPro: false,
  },
  'fc-bayern': {
    id: 'fc-bayern',
    name: 'FC Bayern München',
    primary: '#DC052D',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#DC052D',
    isPro: true,
  },
  bvb: {
    id: 'bvb',
    name: 'Borussia Dortmund',
    primary: '#FDE100',
    primaryText: '#000000',
    secondary: '#000000',
    secondaryText: '#FDE100',
    isPro: true,
  },
  schalke: {
    id: 'schalke',
    name: 'FC Schalke 04',
    primary: '#004D9D',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#004D9D',
    isPro: true,
  },
  werder: {
    id: 'werder',
    name: 'Werder Bremen',
    primary: '#1D9053',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#1D9053',
    isPro: true,
  },
  hsv: {
    id: 'hsv',
    name: 'Hamburger SV',
    primary: '#0A3D91',
    primaryText: '#FFFFFF',
    secondary: '#FFFFFF',
    secondaryText: '#0A3D91',
    isPro: true,
  },
  custom: {
    id: 'custom',
    name: 'Eigene Farben',
    primary: '#00E676',
    primaryText: '#000000',
    secondary: '#00B0FF',
    secondaryText: '#000000',
    isPro: true,
  },
};

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

export const SETTINGS_CATEGORIES: Record<
  SettingsCategory,
  { label: string; icon: string }
> = {
  appearance: { label: 'Erscheinungsbild', icon: '🎨' },
  language: { label: 'Sprache', icon: '🌍' },
  behavior: { label: 'App-Verhalten', icon: '⚡' },
  data: { label: 'Daten', icon: '💾' },
  support: { label: 'Hilfe & Support', icon: '❓' },
  about: { label: 'Über', icon: 'ℹ️' },
  legal: { label: 'Rechtliches', icon: '⚖️' },
};
