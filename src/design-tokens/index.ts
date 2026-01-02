/**
 * Design Tokens - Main Export
 *
 * Single source of truth for all design values in the application.
 * Import from here for consistent styling across components.
 *
 * RECOMMENDED (Theme-aware via CSS Variables):
 * ```typescript
 * import { cssVars } from '@/design-tokens';
 *
 * const style = {
 *   color: cssVars.colors.primary,
 *   padding: cssVars.spacing.md,
 *   fontSize: cssVars.fontSizes.sm,
 * };
 * ```
 *
 * LEGACY (No theme support - will be deprecated):
 * ```typescript
 * import { colors, spacing, fontSizes } from '@/design-tokens';
 *
 * const style = {
 *   color: colors.primary,
 *   padding: spacing.md,
 *   fontSize: fontSizes.sm,
 * };
 * ```
 */

// =============================================================================
// Token Exports
// =============================================================================

export { colors, type ColorToken } from './colors';

export {
  spacing,
  spacingScale,
  spacingSemantics,
  type SpacingKey,
  type SpacingScaleKey,
} from './spacing';

export {
  fontFamilies,
  fontSizes,
  fontSizesMd3,
  fontWeights,
  lineHeights,
  letterSpacing,
  typography,
  // Fixed-size tokens (px - do NOT scale with font-size preference)
  displaySizes,
  scoreSizes,
  timerSize,
  type FontSizeKey,
  type DisplaySizeKey,
  type ScoreSizeKey,
  type FontWeightKey,
  type Typography,
  type TypographyKey,
} from './typography';

export {
  shadows,
  shadowSemantics,
  type ShadowToken,
  type ShadowSemantic,
} from './shadows';

export {
  radii,
  borderRadius, // Alias
  radiiSemantics,
  type RadiusKey,
} from './radii';

export {
  durations,
  durationsMs,
  easings,
  transitions,
  keyframes,
  animations,
  staggerDelay,
  withDelay,
  type Durations,
  type Easings,
  type Transitions,
} from './motion';

export {
  breakpoints,
  breakpointValues,
  mediaQueries,
  containerWidths,
  type BreakpointToken,
  type MediaQueryToken,
  type ContainerWidth,
} from './breakpoints';

export { gradients, type GradientToken } from './gradients';

export {
  touchTargets,
  touchTargetValues,
  iconSizes,
  iconSizeValues,
  inputHeights,
  buttonHeights,
  layoutHeights,
  layoutHeightValues,
  type TouchTargetKey,
  type IconSizeKey,
  type InputHeightKey,
  type ButtonHeightKey,
  type LayoutHeightKey,
} from './sizing';

// =============================================================================
// Convenience Object Export
// =============================================================================

import { colors } from './colors';
import { spacing, spacingSemantics } from './spacing';
import { touchTargets, iconSizes, inputHeights, buttonHeights, layoutHeights } from './sizing';
import { fontFamilies, fontSizes, fontWeights, lineHeights, typography, displaySizes, scoreSizes, timerSize } from './typography';
import { shadows, shadowSemantics } from './shadows';
import { radii, radiiSemantics } from './radii';
import { durations, easings, transitions, animations } from './motion';
import { breakpoints, mediaQueries, containerWidths } from './breakpoints';
import { gradients } from './gradients';

/**
 * All tokens as a single object
 */
export const tokens = {
  colors,
  spacing,
  spacingSemantics,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  typography,
  // Fixed-size tokens (px - do NOT scale)
  displaySizes,
  scoreSizes,
  timerSize,
  shadows,
  shadowSemantics,
  radii,
  radiiSemantics,
  durations,
  easings,
  transitions,
  animations,
  breakpoints,
  mediaQueries,
  containerWidths,
  gradients,
  touchTargets,
  iconSizes,
  inputHeights,
  buttonHeights,
  layoutHeights,
} as const;

export type Tokens = typeof tokens;
export default tokens;

// =============================================================================
// CSS Variable Exports (Theme-aware - RECOMMENDED)
// =============================================================================

export {
  cssVars,
  cssColors,
  cssGradients,
  cssSpacing,
  cssBorderRadius,
  cssShadows,
  cssFontFamilies,
  cssFontSizes,
  cssLineHeights,
  cssFontWeights,
  cssTouchTargets,
  cssIconSizes,
  cssInputHeights,
  cssTheme,
  type CssVarColors,
  type CssVarGradients,
  type CssVarSpacing,
  type CssVarBorderRadius,
  type CssVarShadows,
  type CssVarFontFamilies,
  type CssVarFontSizes,
  type CssVarLineHeights,
  type CssVarFontWeights,
  type CssVarTouchTargets,
  type CssVarIconSizes,
  type CssVarInputHeights,
  type CssVarTheme,
} from './cssVars';
