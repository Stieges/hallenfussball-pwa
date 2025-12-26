/**
 * Theme Object
 *
 * Legacy theme object that re-exports values from the design tokens system.
 * This file exists for backwards compatibility with existing components.
 *
 * For new code, prefer importing directly from `../design-tokens`:
 *
 * @example
 * ```typescript
 * // Preferred (new code)
 * import { colors, spacing, typography } from '../design-tokens';
 *
 * // Legacy (existing code - still works)
 * import { theme } from '../styles/theme';
 * ```
 *
 * @deprecated Prefer importing from `../design-tokens` directly
 */

import {
  colors,
  spacing,
  radii,
  shadows,
  gradients,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  typography,
  breakpoints,
  mediaQueries,
} from '../design-tokens';

// =============================================================================
// Legacy Theme Object
// =============================================================================

export const theme = {
  colors: {
    background: colors.background,
    surface: colors.surface,
    surfaceHover: colors.surfaceHover,
    surfaceDark: colors.surfaceDark,
    primary: colors.primary,
    primaryDark: colors.primaryDark,
    secondary: colors.secondary,
    accent: colors.accent,
    warning: colors.warning,
    error: colors.error,
    success: colors.success,
    text: {
      primary: colors.textPrimary,
      secondary: colors.textSecondary,
      muted: colors.textMuted,
      placeholder: colors.textPlaceholder,
    },
    border: colors.border,
    borderActive: colors.borderActive,
    status: {
      live: colors.statusLive,
      liveBg: colors.statusLiveBg,
      liveRowBg: colors.statusLiveRowBg,
      upcoming: colors.statusUpcoming,
      upcomingBg: colors.statusUpcomingBg,
      finished: colors.statusFinished,
      finishedBg: colors.statusFinishedBg,
      draft: colors.statusDraft,
      draftBg: colors.statusDraftBg,
      external: colors.statusExternal,
      externalBg: colors.statusExternalBg,
    },
    correction: {
      bg: colors.correctionBg,
      border: colors.correctionBorder,
      text: colors.correctionText,
      icon: colors.correctionIcon,
    },
    medal: {
      gold: colors.medalGold,
      silver: colors.medalSilver,
      bronze: colors.medalBronze,
    },
  },

  gradients: {
    primary: gradients.primary,
    surface: gradients.surface,
    card: gradients.card,
  },

  shadows,

  // 8pt Grid System - directly from design tokens
  borderRadius: radii,
  spacing,

  // Typography - MD3 Type Scale
  typography,
  fontFamilies,
  lineHeights,

  // Font sizes with legacy naming (xs, sm, md, lg, xl, xxl, xxxl)
  fontSizes,

  // Font weights (converted to strings for CSS compatibility)
  fontWeights: {
    normal: String(fontWeights.normal),
    medium: String(fontWeights.medium),
    semibold: String(fontWeights.semibold),
    bold: String(fontWeights.bold),
  },

  fonts: {
    display: fontFamilies.display,
    heading: fontFamilies.heading,
    body: fontFamilies.body,
    mono: fontFamilies.mono,
  },

  // Responsive breakpoints
  breakpoints,

  // Media query helpers (for use in CSS modules)
  media: {
    mobile: mediaQueries.mobile,
    tablet: mediaQueries.tablet,
    tabletUp: mediaQueries.tabletUp,
    desktop: mediaQueries.desktop,
    wide: mediaQueries.wide,
  },
} as const;

export type Theme = typeof theme;

// =============================================================================
// Re-export design tokens for convenience
// =============================================================================

export {
  colors,
  spacing,
  radii,
  shadows,
  gradients,
  typography,
  fontFamilies,
  fontSizes,
  fontWeights,
  lineHeights,
  breakpoints,
  mediaQueries,
} from '../design-tokens';
