/* eslint-disable react-refresh/only-export-components */
/**
 * useTheme - Theme Management Hook
 *
 * Provides theme switching between light, dark, and system modes.
 * Persists user preference to localStorage.
 * Respects system preference when set to 'system'.
 *
 * @example
 * ```tsx
 * const { theme, setTheme, resolvedTheme, colors } = useTheme();
 *
 * // Toggle between themes
 * setTheme('light');
 *
 * // Get current resolved theme (always 'light' or 'dark')
 * console.log(resolvedTheme); // 'dark'
 *
 * // Use theme-aware colors
 * <div style={{ background: colors.background }} />
 * ```
 */

import { createContext, useContext, useCallback, useMemo, useEffect, useState, type ReactNode } from 'react';
import { useLocalStorage } from './useLocalStorage';
import { semanticColorsDark, semanticColorsLight, type Theme, type SemanticColors } from '../design-tokens/colors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ThemeContextValue {
  /** Current theme setting ('light', 'dark', 'system', or 'high-contrast') */
  theme: Theme;
  /** Set the theme */
  setTheme: (theme: Theme) => void;
  /** Resolved theme (resolves 'system' to actual, 'high-contrast' stays as-is) */
  resolvedTheme: 'light' | 'dark' | 'high-contrast';
  /** Current theme's semantic colors */
  colors: SemanticColors;
  /** Toggle between light and dark (ignores system) */
  toggleTheme: () => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helper: Get system preference
// ---------------------------------------------------------------------------

const getSystemTheme = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface ThemeProviderProps {
  children: ReactNode;
  /** Default theme if no preference stored */
  defaultTheme?: Theme;
  /** Storage key for persisting preference */
  storageKey?: string;
}

export const ThemeProvider = ({
  children,
  defaultTheme = 'system',
  storageKey = 'hallenfussball-theme',
}: ThemeProviderProps) => {
  const [theme, setThemeRaw] = useLocalStorage<Theme>(storageKey, defaultTheme);
  const [systemTheme, setSystemTheme] = useState<'light' | 'dark'>(getSystemTheme);

  // Listen for system theme changes
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? 'dark' : 'light');
    };

    // Modern API
    mediaQuery.addEventListener('change', handleChange);

    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // Resolve 'system' to actual theme, 'high-contrast' stays as-is
  const resolvedTheme = useMemo((): 'light' | 'dark' | 'high-contrast' => {
    if (theme === 'system') {
      return systemTheme;
    }
    return theme;
  }, [theme, systemTheme]);

  // Get colors based on resolved theme (high-contrast uses dark colors as base)
  const colors = useMemo(() => {
    return resolvedTheme === 'light' ? semanticColorsLight : semanticColorsDark;
  }, [resolvedTheme]);

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;

    // Set data attribute for CSS selectors
    root.setAttribute('data-theme', resolvedTheme);

    // Add/remove class for styling
    root.classList.remove('light', 'dark', 'high-contrast');
    root.classList.add(resolvedTheme);

    // Update meta theme-color for mobile browsers
    // High-contrast uses black background
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      const bgColor = resolvedTheme === 'light'
        ? semanticColorsLight.background
        : resolvedTheme === 'high-contrast'
          ? '#000000'
          : semanticColorsDark.background;
      metaThemeColor.setAttribute('content', bgColor);
    }
  }, [resolvedTheme]);

  // Set theme handler
  const setTheme = useCallback((newTheme: Theme) => {
    setThemeRaw(newTheme);
  }, [setThemeRaw]);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    setThemeRaw(resolvedTheme === 'dark' ? 'light' : 'dark');
  }, [resolvedTheme, setThemeRaw]);

  const value = useMemo((): ThemeContextValue => ({
    theme,
    setTheme,
    resolvedTheme,
    colors,
    toggleTheme,
  }), [theme, setTheme, resolvedTheme, colors, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Access theme context.
 * Must be used within a ThemeProvider.
 */
export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);

  if (!context) {
    // Fallback for usage outside provider (returns dark mode)
    return {
      theme: 'dark',
      setTheme: () => {
        console.warn('useTheme: No ThemeProvider found, setTheme is a no-op');
      },
      resolvedTheme: 'dark',
      colors: semanticColorsDark,
      toggleTheme: () => {
        console.warn('useTheme: No ThemeProvider found, toggleTheme is a no-op');
      },
    };
  }

  return context;
};

// Re-export types
export type { Theme };
