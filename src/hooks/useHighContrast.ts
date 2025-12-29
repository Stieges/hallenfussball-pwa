/**
 * useHighContrast - High Contrast Mode Hook
 *
 * Provides high contrast mode for better accessibility.
 * Increases color contrast ratios and uses more distinct colors.
 *
 * Konzept-Referenz: docs/concepts/LIVE-COCKPIT-KONZEPT.md §4.1
 *
 * Features:
 * - Persists preference to localStorage
 * - Respects system preference (prefers-contrast: more)
 * - Provides CSS class toggle
 * - High contrast color palette
 */

import { useState, useEffect, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'highContrastMode';

interface UseHighContrastReturn {
  /** Whether high contrast mode is enabled */
  isHighContrast: boolean;
  /** Toggle high contrast mode */
  toggleHighContrast: () => void;
  /** Enable high contrast mode */
  enableHighContrast: () => void;
  /** Disable high contrast mode */
  disableHighContrast: () => void;
  /** High contrast color overrides */
  colors: HighContrastColors;
}

interface HighContrastColors {
  // Backgrounds
  background: string;
  surface: string;
  surfaceElevated: string;

  // Text
  textPrimary: string;
  textSecondary: string;

  // Semantic
  primary: string;
  success: string;
  warning: string;
  error: string;

  // Borders
  border: string;
}

// High contrast color palette (WCAG AAA compliant)
const HIGH_CONTRAST_COLORS: HighContrastColors = {
  // Pure black background for maximum contrast
  background: '#000000',
  surface: '#0A0A0A',
  surfaceElevated: '#141414',

  // Pure white text for maximum contrast
  textPrimary: '#FFFFFF',
  textSecondary: '#E0E0E0',

  // Brighter, more saturated semantic colors
  primary: '#00BFFF', // Bright cyan
  success: '#00FF7F', // Spring green
  warning: '#FFD700', // Gold
  error: '#FF4444', // Bright red

  // High visibility borders
  border: '#FFFFFF',
};

// Standard (non-high-contrast) colors
const STANDARD_COLORS: HighContrastColors = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceElevated: '#252525',
  textPrimary: '#E0E0E0',
  textSecondary: '#999999',
  primary: '#00E676',
  success: '#4CAF50',
  warning: '#FFC107',
  error: '#F44336',
  border: '#333333',
};

/**
 * Check if user prefers high contrast via system settings
 */
function getSystemPreference(): boolean {
  if (typeof window === 'undefined') {return false;}

  // Check for forced-colors (Windows High Contrast Mode)
  const forcedColors = window.matchMedia('(forced-colors: active)');
  if (forcedColors.matches) {return true;}

  // Check for prefers-contrast: more
  const prefersContrast = window.matchMedia('(prefers-contrast: more)');
  if (prefersContrast.matches) {return true;}

  return false;
}

/**
 * Get saved preference from localStorage
 */
function getSavedPreference(): boolean | null {
  if (typeof window === 'undefined') {return null;}

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === null) {return null;}
    return saved === 'true';
  } catch {
    return null;
  }
}

/**
 * Save preference to localStorage
 */
function savePreference(enabled: boolean): void {
  if (typeof window === 'undefined') {return;}

  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // localStorage might be blocked
  }
}

export function useHighContrast(): UseHighContrastReturn {
  // Initialize with saved preference or system preference
  const [isHighContrast, setIsHighContrast] = useState<boolean>(() => {
    const saved = getSavedPreference();
    if (saved !== null) {return saved;}
    return getSystemPreference();
  });

  // Listen for system preference changes
  useEffect(() => {
    if (typeof window === 'undefined') {return;}

    const mediaQuery = window.matchMedia('(prefers-contrast: more)');

    const handleChange = (e: MediaQueryListEvent) => {
      // Only auto-update if user hasn't set a preference
      if (getSavedPreference() === null) {
        setIsHighContrast(e.matches);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Apply/remove CSS class on document
  useEffect(() => {
    if (typeof document === 'undefined') {return;}

    if (isHighContrast) {
      document.documentElement.classList.add('high-contrast');
      document.documentElement.setAttribute('data-high-contrast', 'true');
    } else {
      document.documentElement.classList.remove('high-contrast');
      document.documentElement.removeAttribute('data-high-contrast');
    }
  }, [isHighContrast]);

  const toggleHighContrast = useCallback(() => {
    setIsHighContrast(prev => {
      const newValue = !prev;
      savePreference(newValue);
      return newValue;
    });
  }, []);

  const enableHighContrast = useCallback(() => {
    setIsHighContrast(true);
    savePreference(true);
  }, []);

  const disableHighContrast = useCallback(() => {
    setIsHighContrast(false);
    savePreference(false);
  }, []);

  const colors = useMemo(() => {
    return isHighContrast ? HIGH_CONTRAST_COLORS : STANDARD_COLORS;
  }, [isHighContrast]);

  return {
    isHighContrast,
    toggleHighContrast,
    enableHighContrast,
    disableHighContrast,
    colors,
  };
}

export default useHighContrast;
