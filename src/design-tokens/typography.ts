/**
 * Typography Design Tokens
 *
 * Material Design 3 inspired typography scale with 8pt-aligned line heights.
 * Provides both legacy (xs/sm/md) and MD3 (bodyMedium) naming conventions.
 *
 * @see https://m3.material.io/styles/typography/type-scale-tokens
 */

// =============================================================================
// Font Families
// =============================================================================

export const fontFamilies = {
  /** Display typography - for large, impactful headlines */
  display: '"Bebas Neue", Impact, "Arial Black", sans-serif',
  /** Heading typography - for section headers */
  heading: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  /** Body typography - for paragraphs and general text */
  body: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  /** Monospace - for code and technical content */
  mono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
} as const;

// =============================================================================
// Font Sizes (Legacy semantic names - xs, sm, md, lg, xl, xxl, xxxl)
// =============================================================================

export const fontSizes = {
  /** 11px - Extra small (labels, badges) */
  xs: '11px',
  /** 12px - Small (secondary text) */
  sm: '12px',
  /** 14px - Medium (body text) */
  md: '14px',
  /** 16px - Large (emphasized body) */
  lg: '16px',
  /** 18px - Extra large (titles) */
  xl: '18px',
  /** 24px - Double extra large (headlines) */
  xxl: '24px',
  /** 28px - Triple extra large (display) */
  xxxl: '28px',
} as const;

// =============================================================================
// MD3 Font Sizes Scale (for new code using MD3 conventions)
// =============================================================================

export const fontSizesMd3 = {
  // Display (Bebas Neue for impact)
  displayLarge: '48px',
  displayMedium: '36px',
  displaySmall: '28px',

  // Match/Score Display (extra large for TV/Monitor views)
  scoreXl: '90px',
  scoreLg: '72px',
  scoreMd: '56px',
  scoreSm: '40px',

  // Headline
  headlineLarge: '24px',
  headlineMedium: '20px',
  headlineSmall: '18px',

  // Title
  titleLarge: '18px',
  titleMedium: '16px',
  titleSmall: '14px',

  // Body
  bodyLarge: '16px',
  bodyMedium: '14px',
  bodySmall: '12px',

  // Label
  labelLarge: '14px',
  labelMedium: '12px',
  labelSmall: '11px',

  // Special
  statLabel: '10px',
} as const;

// =============================================================================
// Font Weights
// =============================================================================

export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// =============================================================================
// Line Heights (8pt Grid Aligned)
// =============================================================================

export const lineHeights = {
  // Display
  displayLarge: '56px',  // 7 × 8
  displayMedium: '40px', // 5 × 8
  displaySmall: '32px',  // 4 × 8

  // Match/Score Display
  scoreXl: '96px',   // 12 × 8
  scoreLg: '80px',   // 10 × 8
  scoreMd: '64px',   // 8 × 8
  scoreSm: '48px',   // 6 × 8

  // Headline
  headlineLarge: '32px', // 4 × 8
  headlineMedium: '24px', // 3 × 8
  headlineSmall: '24px',  // 3 × 8

  // Title
  titleLarge: '24px',    // 3 × 8
  titleMedium: '24px',   // 3 × 8
  titleSmall: '20px',    // 2.5 × 8

  // Body
  bodyLarge: '24px',     // 3 × 8
  bodyMedium: '20px',    // 2.5 × 8
  bodySmall: '16px',     // 2 × 8

  // Label
  labelLarge: '20px',    // 2.5 × 8
  labelMedium: '16px',   // 2 × 8
  labelSmall: '16px',    // 2 × 8

  // Special
  statLabel: '16px',
} as const;

// =============================================================================
// Letter Spacing
// =============================================================================

export const letterSpacing = {
  tighter: '-0.5px',
  tight: '-0.25px',
  normal: '0',
  wide: '0.5px',
  wider: '1px',
} as const;

// =============================================================================
// Composite Typography Styles (MD3 format)
// =============================================================================

export const typography = {
  displayLarge: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizesMd3.displayLarge,
    lineHeight: lineHeights.displayLarge,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.tighter,
  },
  displayMedium: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizesMd3.displayMedium,
    lineHeight: lineHeights.displayMedium,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.tight,
  },
  displaySmall: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizesMd3.displaySmall,
    lineHeight: lineHeights.displaySmall,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.tight,
  },

  headlineLarge: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizesMd3.headlineLarge,
    lineHeight: lineHeights.headlineLarge,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.normal,
  },
  headlineMedium: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizesMd3.headlineMedium,
    lineHeight: lineHeights.headlineMedium,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },
  headlineSmall: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizesMd3.headlineSmall,
    lineHeight: lineHeights.headlineSmall,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },

  titleLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.titleLarge,
    lineHeight: lineHeights.titleLarge,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },
  titleMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.titleMedium,
    lineHeight: lineHeights.titleMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  titleSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.titleSmall,
    lineHeight: lineHeights.titleSmall,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },

  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.bodyLarge,
    lineHeight: lineHeights.bodyLarge,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodyMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.bodyMedium,
    lineHeight: lineHeights.bodyMedium,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.bodySmall,
    lineHeight: lineHeights.bodySmall,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.normal,
  },

  labelLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.labelLarge,
    lineHeight: lineHeights.labelLarge,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.labelMedium,
    lineHeight: lineHeights.labelMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizesMd3.labelSmall,
    lineHeight: lineHeights.labelSmall,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wider,
  },
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type FontSizeKey = keyof typeof fontSizes;
export type FontWeightKey = keyof typeof fontWeights;
export type Typography = typeof typography;
export type TypographyKey = keyof Typography;
