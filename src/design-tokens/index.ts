/**
 * Design Tokens - Main Export
 *
 * Single source of truth for all design values in the application.
 * Import from here for consistent styling across components.
 *
 * @example
 * ```typescript
 * import { colors, spacing, typography } from '@/design-tokens';
 *
 * const style = {
 *   color: colors.primary,
 *   padding: spacing['2'],
 *   ...typography.bodyMedium,
 * };
 * ```
 *
 * @see https://tr.designtokens.org/format/
 */

// =============================================================================
// Token Exports
// =============================================================================

export { colors, type ColorToken } from './colors';

export {
  spacing,
  spacingSemantics,
  spacingLegacy,
  type SpacingToken,
  type SpacingSemantic,
} from './spacing';

export {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  letterSpacing,
  typography,
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
  radiiSemantics,
  radiiLegacy,
  type RadiusToken,
  type RadiusSemantic,
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
import { spacing, spacingSemantics, spacingLegacy } from './spacing';
import {
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  typography,
} from './typography';
import { shadows, shadowSemantics } from './shadows';
import { radii, radiiSemantics } from './radii';
import { durations, easings, transitions, animations } from './motion';
import { breakpoints, mediaQueries, containerWidths } from './breakpoints';
import { gradients } from './gradients';

/**
 * All tokens as a single object
 * Useful for theming providers or style utilities
 */
export const tokens = {
  colors,
  spacing,
  spacingSemantics,
  spacingLegacy,
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
