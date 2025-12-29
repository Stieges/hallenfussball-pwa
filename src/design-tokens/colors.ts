/**
 * Color Design Tokens
 *
 * This file re-exports from the hierarchical color system.
 * For theme-aware colors, use the useTheme hook.
 *
 * @example
 * // Static usage (always dark mode):
 * import { colors } from '@/design-tokens';
 *
 * // Theme-aware usage:
 * import { useTheme } from '@/hooks/useTheme';
 * const { colors } = useTheme();
 */

// Re-export everything from the new hierarchical structure
export {
  // Default colors (dark mode)
  colors,

  // Palette (raw color values)
  palette,

  // Semantic colors for each theme
  semanticColorsDark,
  semanticColorsLight,

  // Theme utilities
  themeColors,
  getColorsByTheme,

  // Types
  type Theme,
  type SemanticColorToken as ColorToken,
  type SemanticColors,
  type Palette,
  type PaletteColor,
} from './colors/index';

// Backwards compatibility alias
export { palette as primitives } from './colors/index';
export type { Palette as PrimitiveColors } from './colors/index';
