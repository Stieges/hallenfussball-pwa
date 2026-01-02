/**
 * Color Tokens - Main Export
 *
 * Provides theme-aware color tokens for the application.
 * Import from here for theme-switching support.
 *
 * @example
 * // For theme-aware components (when ThemeProvider is available):
 * import { useTheme } from '@/hooks/useTheme';
 * const { colors } = useTheme();
 *
 * // For static usage (defaults to dark mode):
 * import { colors } from '@/design-tokens/colors';
 */

export { palette, type Palette, type PaletteColor } from './palette';
export { semanticColorsDark, type SemanticColorToken, type SemanticColors } from './semantic';
export { semanticColorsLight } from './semantic-light';

// Default export is dark mode (for backward compatibility)
export { semanticColorsDark as colors } from './semantic';

// Theme type (high-contrast is a variant of dark with enhanced visibility)
export type Theme = 'light' | 'dark' | 'system' | 'high-contrast';

// Get colors by theme
export const getColorsByTheme = (theme: 'light' | 'dark') => {
  return theme === 'light' ? semanticColorsLight : semanticColorsDark;
};

// Re-export as default semantic colors (dark mode for backward compatibility)
import { semanticColorsDark } from './semantic';
import { semanticColorsLight } from './semantic-light';

export const themeColors = {
  dark: semanticColorsDark,
  light: semanticColorsLight,
} as const;
