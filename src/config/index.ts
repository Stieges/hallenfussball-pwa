/**
 * Config Module - Central configuration exports
 *
 * Re-exports all configuration modules for convenient importing:
 * - app: Application metadata (title, version)
 * - legal: Legal configuration (DSGVO, Impressum)
 * - colorPresets: Color presets for theming
 * - sports: Sport-specific configurations
 */

// App configuration
export { appConfig, getAppTitle, getAppShortName } from './app';
export type { AppConfig } from './app';

// Legal configuration
export { LEGAL_CONFIG, isPlaceholder, getUnfilledPlaceholders } from './legal';
export type { LegalConfig } from './legal';

// Color presets
export {
  colorPresets,
  getPreset,
  getDefaultPreset,
  getPresetsByCategory,
  getFreePresets,
  getPremiumPresets,
  getCategories,
  isPresetPremium,
  categoryLabels,
  getCategoryLabel,
} from './colorPresets';
export type { ColorPreset, PresetCategory } from './colorPresets';

// Sports configuration
export * from './sports';
