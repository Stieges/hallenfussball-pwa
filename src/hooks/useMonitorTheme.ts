/**
 * useMonitorTheme - Standalone theme hook for monitor components
 *
 * Resolves 'auto' theme to 'light' | 'dark' based on system preference.
 * No Context required - works with prop-based theme passing.
 *
 * @example
 * ```tsx
 * const { themeColors } = useMonitorTheme(theme);
 * // Use themeColors.text, themeColors.background, etc.
 * ```
 */

import { useState, useEffect } from 'react';
import { monitorThemes, type MonitorThemeColors } from '../design-tokens';
import type { MonitorTheme } from '../types/monitor';

export interface UseMonitorThemeReturn {
  /** Resolved theme ('light' or 'dark') */
  resolvedTheme: 'light' | 'dark';
  /** Theme color values from monitorThemes */
  themeColors: MonitorThemeColors;
}

/**
 * Hook to resolve 'auto' theme based on system preference
 * and provide theme colors for monitor components.
 *
 * @param theme - 'light' | 'dark' | 'auto' (default: 'dark')
 * @returns { resolvedTheme, themeColors }
 */
export function useMonitorTheme(theme: MonitorTheme = 'dark'): UseMonitorThemeReturn {
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => {
    if (typeof window === 'undefined') {return true;}
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') {return;}
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  const resolvedTheme = theme === 'auto'
    ? (systemPrefersDark ? 'dark' : 'light')
    : theme;

  const themeColors = monitorThemes[resolvedTheme];

  return { resolvedTheme, themeColors };
}
