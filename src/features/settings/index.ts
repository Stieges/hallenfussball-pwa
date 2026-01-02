/**
 * Settings Feature - Barrel Export
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

// Types
export * from './types/settings.types';

// Hooks
export { useSettings } from './hooks/useSettings';
export type { UseSettingsReturn } from './hooks/useSettings';

// Components
export { SettingsScreen } from './components/SettingsScreen';
export { SettingsCategory } from './components/SettingsCategory';
export { SettingItem } from './components/SettingItem';
export { BaseThemeSelector } from './components/BaseThemeSelector';
export { FontSizeSelector } from './components/FontSizeSelector';
