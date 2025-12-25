/**
 * Typography Design Tokens
 *
 * Material Design 3 inspired typography scale with 8pt-aligned line heights.
 * This file is the single source of truth for all typography-related values.
 *
 * @see https://m3.material.io/styles/typography/type-scale-tokens
 */

// Font Families
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

// Font Sizes - MD3 Type Scale
export const fontSizes = {
  // Display (Bebas Neue for impact)
  displayLarge: '48px',
  displayMedium: '36px',
  displaySmall: '28px',

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

  // Special sizes (for statistics, badges)
  statLabel: '10px',
} as const;

// Line Heights - 8pt Grid Aligned
export const lineHeights = {
  // Display
  displayLarge: '56px',  // 7 x 8
  displayMedium: '40px', // 5 x 8
  displaySmall: '32px',  // 4 x 8

  // Headline
  headlineLarge: '32px', // 4 x 8
  headlineMedium: '24px', // 3 x 8
  headlineSmall: '24px',  // 3 x 8

  // Title
  titleLarge: '24px',    // 3 x 8
  titleMedium: '24px',   // 3 x 8
  titleSmall: '20px',    // 2.5 x 8

  // Body
  bodyLarge: '24px',     // 3 x 8
  bodyMedium: '20px',    // 2.5 x 8
  bodySmall: '16px',     // 2 x 8

  // Label
  labelLarge: '20px',    // 2.5 x 8
  labelMedium: '16px',   // 2 x 8
  labelSmall: '16px',    // 2 x 8

  // Special
  statLabel: '16px',     // 2 x 8
} as const;

// Font Weights
export const fontWeights = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const;

// Letter Spacing
export const letterSpacing = {
  tighter: '-0.5px',
  tight: '-0.25px',
  normal: '0',
  wide: '0.5px',
  wider: '1px',
} as const;

// Composite Typography Styles
export const typography = {
  // Display styles (use Bebas Neue)
  displayLarge: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displayLarge,
    lineHeight: lineHeights.displayLarge,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.tighter,
  },
  displayMedium: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displayMedium,
    lineHeight: lineHeights.displayMedium,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.tight,
  },
  displaySmall: {
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.displaySmall,
    lineHeight: lineHeights.displaySmall,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.tight,
  },

  // Headline styles
  headlineLarge: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.headlineLarge,
    lineHeight: lineHeights.headlineLarge,
    fontWeight: fontWeights.bold,
    letterSpacing: letterSpacing.normal,
  },
  headlineMedium: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.headlineMedium,
    lineHeight: lineHeights.headlineMedium,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },
  headlineSmall: {
    fontFamily: fontFamilies.heading,
    fontSize: fontSizes.headlineSmall,
    lineHeight: lineHeights.headlineSmall,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },

  // Title styles
  titleLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleLarge,
    lineHeight: lineHeights.titleLarge,
    fontWeight: fontWeights.semibold,
    letterSpacing: letterSpacing.normal,
  },
  titleMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleMedium,
    lineHeight: lineHeights.titleMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },
  titleSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.titleSmall,
    lineHeight: lineHeights.titleSmall,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.normal,
  },

  // Body styles
  bodyLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyLarge,
    lineHeight: lineHeights.bodyLarge,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodyMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodyMedium,
    lineHeight: lineHeights.bodyMedium,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.normal,
  },
  bodySmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    lineHeight: lineHeights.bodySmall,
    fontWeight: fontWeights.normal,
    letterSpacing: letterSpacing.normal,
  },

  // Label styles
  labelLarge: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelLarge,
    lineHeight: lineHeights.labelLarge,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelMedium: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelMedium,
    lineHeight: lineHeights.labelMedium,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wide,
  },
  labelSmall: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.labelSmall,
    lineHeight: lineHeights.labelSmall,
    fontWeight: fontWeights.medium,
    letterSpacing: letterSpacing.wider,
  },
} as const;

export type Typography = typeof typography;
export type TypographyKey = keyof Typography;
