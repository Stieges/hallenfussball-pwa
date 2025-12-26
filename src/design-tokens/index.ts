/**
 * Design Tokens - Main Export
 *
 * Single source of truth for all design values in the application.
 * Import from here for consistent styling across components.
 *
 * @example
 * ```typescript
 * import { colors, spacing, fontSizes } from '../design-tokens';
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
  type FontSizeKey,
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

// =============================================================================
// Convenience Object Export
// =============================================================================

import { colors } from './colors';
import { spacing, spacingSemantics } from './spacing';
import { fontFamilies, fontSizes, fontWeights, lineHeights, typography } from './typography';
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
} as const;

export type Tokens = typeof tokens;
export default tokens;
