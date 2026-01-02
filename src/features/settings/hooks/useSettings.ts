/**
 * useSettings - Hook für App-Einstellungen
 *
 * Verwaltet alle Einstellungen AUSSER Theme (das ist in useTheme).
 * Persistiert zu localStorage.
 *
 * @see docs/concepts/SETTINGS-KONZEPT.md
 */

import { useCallback, useMemo } from 'react';
import { useLocalStorage } from '../../../hooks/useLocalStorage';
import {
  AppSettings,
  DEFAULT_SETTINGS,
  FontSize,
  FONT_SCALE_VALUES,
} from '../types/settings.types';

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = 'hallenfussball-settings';
const APP_VERSION = '2.3.0';

// =============================================================================
// Hook
// =============================================================================

export interface UseSettingsReturn {
  // State
  settings: AppSettings;

  // Individual settings
  fontSize: FontSize;
  language: AppSettings['language'];
  confirmDelete: boolean;
  autoSave: boolean;
  timerSound: boolean;
  hapticFeedback: boolean;

  // Actions
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  setFontSize: (size: FontSize) => void;
  setLanguage: (lang: AppSettings['language']) => void;
  toggleConfirmDelete: () => void;
  toggleAutoSave: () => void;
  toggleTimerSound: () => void;
  toggleHapticFeedback: () => void;
  resetSettings: () => void;

  // Utils
  fontScale: number;
}

export const useSettings = (): UseSettingsReturn => {
  const [settings, setSettings] = useLocalStorage<AppSettings>(STORAGE_KEY, {
    ...DEFAULT_SETTINGS,
    version: APP_VERSION,
    lastUpdated: new Date().toISOString(),
  });

  // ==========================================================================
  // Update helper
  // ==========================================================================

  const updateSetting = useCallback(
    <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({
        ...prev,
        [key]: value,
        lastUpdated: new Date().toISOString(),
      }));
    },
    [setSettings]
  );

  // ==========================================================================
  // Individual setters
  // ==========================================================================

  const setFontSize = useCallback(
    (size: FontSize) => {
      updateSetting('fontSize', size);
      // Update CSS variable for font scaling
      document.documentElement.setAttribute('data-font-size', size);
    },
    [updateSetting]
  );

  const setLanguage = useCallback(
    (lang: AppSettings['language']) => {
      updateSetting('language', lang);
    },
    [updateSetting]
  );

  const toggleConfirmDelete = useCallback(() => {
    updateSetting('confirmDelete', !settings.confirmDelete);
  }, [settings.confirmDelete, updateSetting]);

  const toggleAutoSave = useCallback(() => {
    updateSetting('autoSave', !settings.autoSave);
  }, [settings.autoSave, updateSetting]);

  const toggleTimerSound = useCallback(() => {
    updateSetting('timerSound', !settings.timerSound);
  }, [settings.timerSound, updateSetting]);

  const toggleHapticFeedback = useCallback(() => {
    updateSetting('hapticFeedback', !settings.hapticFeedback);
  }, [settings.hapticFeedback, updateSetting]);

  const resetSettings = useCallback(() => {
    setSettings({
      ...DEFAULT_SETTINGS,
      version: APP_VERSION,
      lastUpdated: new Date().toISOString(),
    });
    document.documentElement.setAttribute('data-font-size', 'normal');
  }, [setSettings]);

  // ==========================================================================
  // Computed values
  // ==========================================================================

  const fontScale = useMemo(
    () => FONT_SCALE_VALUES[settings.fontSize],
    [settings.fontSize]
  );

  // ==========================================================================
  // Apply font size on mount
  // ==========================================================================

  // Set data-font-size attribute on initial load
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-font-size', settings.fontSize);
  }

  // ==========================================================================
  // Return
  // ==========================================================================

  return {
    settings,
    fontSize: settings.fontSize,
    language: settings.language,
    confirmDelete: settings.confirmDelete,
    autoSave: settings.autoSave,
    timerSound: settings.timerSound,
    hapticFeedback: settings.hapticFeedback,
    updateSetting,
    setFontSize,
    setLanguage,
    toggleConfirmDelete,
    toggleAutoSave,
    toggleTimerSound,
    toggleHapticFeedback,
    resetSettings,
    fontScale,
  };
};

export default useSettings;
