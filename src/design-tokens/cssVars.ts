/**
 * CSS Variable Wrapper for Theme Support
 *
 * USAGE:
 * import { cssVars } from '@/design-tokens';
 * style={{ background: cssVars.colors.background }}
 *
 * DO NOT USE (legacy - no theme support):
 * import { colors } from '@/design-tokens';
 * style={{ background: colors.background }}
 *
 * These values reference CSS Custom Properties defined in global.css,
 * which are updated automatically when the theme changes.
 * This enables theme-switching without React re-renders.
 */

// =============================================================================
// Colors
// =============================================================================

export const cssColors = {
  // Primary
  primary: 'var(--color-primary)',
  primaryHover: 'var(--color-primary-hover)',
  primaryActive: 'var(--color-primary-active)',
  primaryLight: 'var(--color-primary-light)',
  primaryMedium: 'var(--color-primary-medium)',
  primarySubtle: 'var(--color-primary-subtle)',
  primarySelected: 'var(--color-primary-selected)',
  primaryBorder: 'var(--color-primary-border)',
  primaryBorderActive: 'var(--color-primary-border-active)',
  primaryBorderStrong: 'var(--color-primary-border-strong)',
  primaryGlow: 'var(--color-primary-glow)',
  primaryGlowLight: 'var(--color-primary-glow-light)',

  // Secondary
  secondary: 'var(--color-secondary)',
  secondaryHover: 'var(--color-secondary-hover)',
  secondarySubtle: 'var(--color-secondary-subtle)',
  secondaryLight: 'var(--color-secondary-light)',
  secondaryMedium: 'var(--color-secondary-medium)',
  secondaryBorder: 'var(--color-secondary-border)',
  secondaryBorderActive: 'var(--color-secondary-border-active)',
  secondaryBorderStrong: 'var(--color-secondary-border-strong)',

  // Backgrounds
  background: 'var(--color-background)',
  surface: 'var(--color-surface)',
  surfaceSolid: 'var(--color-surface-solid)',
  surfaceHover: 'var(--color-surface-hover)',
  surfaceDark: 'var(--color-surface-dark)',
  surfaceDarkMedium: 'var(--color-surface-dark-medium)',
  surfaceDarkLight: 'var(--color-surface-dark-light)',
  surfaceHighlight: 'var(--color-surface-highlight)',

  // Text
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textDisabled: 'var(--color-text-disabled)',
  textTertiary: 'var(--color-text-tertiary)',

  // Text on colored backgrounds
  onPrimary: 'var(--color-on-primary)',
  onSecondary: 'var(--color-on-secondary)',

  // Borders
  border: 'var(--color-border)',
  borderSolid: 'var(--color-border-solid)',
  borderSubtle: 'var(--color-border-subtle)',
  borderLight: 'var(--color-border-light)',

  // Semantic: Error
  error: 'var(--color-error)',
  errorLight: 'var(--color-error-light)',
  errorMedium: 'var(--color-error-medium)',
  errorBorder: 'var(--color-error-border)',
  errorGlow: 'var(--color-error-glow)',

  // Semantic: Warning
  warning: 'var(--color-warning)',
  warningSubtle: 'var(--color-warning-subtle)',
  warningLight: 'var(--color-warning-light)',
  warningMedium: 'var(--color-warning-medium)',
  warningBorder: 'var(--color-warning-border)',
  warningBorderActive: 'var(--color-warning-border-active)',
  warningBorderStrong: 'var(--color-warning-border-strong)',

  // Semantic: Success
  success: 'var(--color-success)',

  // Semantic: Accent
  accent: 'var(--color-accent)',

  // Shadows
  shadowSoft: 'var(--color-shadow-soft)',
  shadowMedium: 'var(--color-shadow-medium)',
} as const;

// =============================================================================
// Gradients
// =============================================================================

export const cssGradients = {
  primarySecondary: 'var(--gradient-primary-secondary)',
  subtle: 'var(--gradient-subtle)',
  subtleHover: 'var(--gradient-subtle-hover)',
} as const;

// =============================================================================
// Spacing
// =============================================================================

export const cssSpacing = {
  xs: 'var(--spacing-xs)',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
  xl: 'var(--spacing-xl)',
  xxl: 'var(--spacing-xxl)',
} as const;

// =============================================================================
// Border Radius
// =============================================================================

export const cssBorderRadius = {
  sm: 'var(--border-radius-sm)',
  md: 'var(--border-radius-md)',
  lg: 'var(--border-radius-lg)',
  xl: 'var(--border-radius-xl)',
} as const;

// =============================================================================
// Shadows
// =============================================================================

export const cssShadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
} as const;

// =============================================================================
// Typography - Font Families
// =============================================================================

export const cssFontFamilies = {
  display: 'var(--font-display)',
  heading: 'var(--font-heading)',
  body: 'var(--font-body)',
  mono: 'var(--font-mono)',
} as const;

// =============================================================================
// Typography - Font Sizes
// =============================================================================

export const cssFontSizes = {
  // Display
  displayLg: 'var(--font-size-display-lg)',
  displayMd: 'var(--font-size-display-md)',
  displaySm: 'var(--font-size-display-sm)',

  // Headlines
  headlineLg: 'var(--font-size-headline-lg)',
  headlineMd: 'var(--font-size-headline-md)',
  headlineSm: 'var(--font-size-headline-sm)',

  // Titles
  titleLg: 'var(--font-size-title-lg)',
  titleMd: 'var(--font-size-title-md)',
  titleSm: 'var(--font-size-title-sm)',

  // Body
  bodyLg: 'var(--font-size-body-lg)',
  bodyMd: 'var(--font-size-body-md)',
  bodySm: 'var(--font-size-body-sm)',

  // Labels
  labelLg: 'var(--font-size-label-lg)',
  labelMd: 'var(--font-size-label-md)',
  labelSm: 'var(--font-size-label-sm)',

  // Special
  statLabel: 'var(--font-size-stat-label)',

  // Legacy aliases (for backward compatibility)
  xs: 'var(--font-size-xs)',
  sm: 'var(--font-size-sm)',
  md: 'var(--font-size-md)',
  lg: 'var(--font-size-lg)',
  xl: 'var(--font-size-xl)',
  xxl: 'var(--font-size-xxl)',
  xxxl: 'var(--font-size-xxxl)',
} as const;

// =============================================================================
// Typography - Line Heights
// =============================================================================

export const cssLineHeights = {
  displayLg: 'var(--line-height-display-lg)',
  displayMd: 'var(--line-height-display-md)',
  displaySm: 'var(--line-height-display-sm)',
  headlineLg: 'var(--line-height-headline-lg)',
  headlineMd: 'var(--line-height-headline-md)',
  headlineSm: 'var(--line-height-headline-sm)',
  title: 'var(--line-height-title)',
  bodyLg: 'var(--line-height-body-lg)',
  bodyMd: 'var(--line-height-body-md)',
  bodySm: 'var(--line-height-body-sm)',
  label: 'var(--line-height-label)',
} as const;

// =============================================================================
// Typography - Font Weights
// =============================================================================

export const cssFontWeights = {
  normal: 'var(--font-weight-normal)',
  medium: 'var(--font-weight-medium)',
  semibold: 'var(--font-weight-semibold)',
  bold: 'var(--font-weight-bold)',
} as const;

// =============================================================================
// Touch Targets
// =============================================================================

export const cssTouchTargets = {
  minimum: 'var(--touch-target-minimum)',
  comfortable: 'var(--touch-target-comfortable)',
  primary: 'var(--touch-target-primary)',
} as const;

// =============================================================================
// Icon Sizes
// =============================================================================

export const cssIconSizes = {
  xs: 'var(--icon-size-xs)',
  sm: 'var(--icon-size-sm)',
  md: 'var(--icon-size-md)',
  lg: 'var(--icon-size-lg)',
  xl: 'var(--icon-size-xl)',
} as const;

// =============================================================================
// Input/Button Heights
// =============================================================================

export const cssInputHeights = {
  sm: 'var(--input-height-sm)',
  md: 'var(--input-height-md)',
  lg: 'var(--input-height-lg)',
} as const;

// =============================================================================
// Theme Variables (Corporate Colors)
// =============================================================================

export const cssTheme = {
  primary: 'var(--theme-primary)',
  primaryHover: 'var(--theme-primary-hover)',
  primaryActive: 'var(--theme-primary-active)',
  primaryLight: 'var(--theme-primary-light)',
  onPrimary: 'var(--theme-on-primary)',

  secondary: 'var(--theme-secondary)',
  secondaryHover: 'var(--theme-secondary-hover)',
  secondaryLight: 'var(--theme-secondary-light)',
  onSecondary: 'var(--theme-on-secondary)',

  gradient: 'var(--theme-gradient)',
} as const;

// =============================================================================
// Combined Export (recommended for most use cases)
// =============================================================================

export const cssVars = {
  colors: cssColors,
  gradients: cssGradients,
  spacing: cssSpacing,
  borderRadius: cssBorderRadius,
  shadows: cssShadows,
  fontFamilies: cssFontFamilies,
  fontSizes: cssFontSizes,
  lineHeights: cssLineHeights,
  fontWeights: cssFontWeights,
  touchTargets: cssTouchTargets,
  iconSizes: cssIconSizes,
  inputHeights: cssInputHeights,
  theme: cssTheme,
} as const;

// =============================================================================
// Type Exports for Autocomplete
// =============================================================================

export type CssVarColors = keyof typeof cssColors;
export type CssVarGradients = keyof typeof cssGradients;
export type CssVarSpacing = keyof typeof cssSpacing;
export type CssVarBorderRadius = keyof typeof cssBorderRadius;
export type CssVarShadows = keyof typeof cssShadows;
export type CssVarFontFamilies = keyof typeof cssFontFamilies;
export type CssVarFontSizes = keyof typeof cssFontSizes;
export type CssVarLineHeights = keyof typeof cssLineHeights;
export type CssVarFontWeights = keyof typeof cssFontWeights;
export type CssVarTouchTargets = keyof typeof cssTouchTargets;
export type CssVarIconSizes = keyof typeof cssIconSizes;
export type CssVarInputHeights = keyof typeof cssInputHeights;
export type CssVarTheme = keyof typeof cssTheme;
