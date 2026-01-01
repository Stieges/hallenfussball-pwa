/**
 * Breakpoint Design Tokens
 *
 * Responsive breakpoints for consistent media queries.
 * Mobile-first approach with min-width queries.
 *
 * @see https://m3.material.io/foundations/layout/applying-layout/window-size-classes
 */

// =============================================================================
// Breakpoint Values
// =============================================================================

export const breakpoints = {
  /** Small phones and below */
  mobile: '480px',

  /** Tablets and large phones */
  tablet: '768px',

  /** Desktop and laptops */
  desktop: '1024px',

  /** Wide screens */
  wide: '1280px',

  /** Extra wide screens */
  ultrawide: '1536px',
} as const;

// =============================================================================
// Breakpoint Values (numeric, for JS calculations)
// =============================================================================

export const breakpointValues = {
  mobile: 480,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultrawide: 1536,
} as const;

// =============================================================================
// Media Query Helpers
// =============================================================================

export const mediaQueries = {
  /** Mobile and below (max-width) */
  mobile: `@media (max-width: ${breakpoints.mobile})`,

  /** Mobile and up (min-width) - usually default styles */
  mobileUp: `@media (min-width: 0)`,

  /** Tablet only */
  tablet: `@media (min-width: ${parseInt(breakpoints.mobile) + 1}px) and (max-width: ${breakpoints.tablet})`,

  /** Tablet and up */
  tabletUp: `@media (min-width: ${parseInt(breakpoints.mobile) + 1}px)`,

  /** Below tablet (max-width: 767px) - phones only */
  tabletDown: `@media (max-width: ${parseInt(breakpoints.tablet) - 1}px)`,

  /** Desktop and up */
  desktop: `@media (min-width: ${parseInt(breakpoints.tablet) + 1}px)`,

  /** Wide screens and up */
  wide: `@media (min-width: ${breakpoints.wide})`,

  /** Ultra wide screens */
  ultrawide: `@media (min-width: ${breakpoints.ultrawide})`,

  /** Reduced motion preference */
  reducedMotion: '@media (prefers-reduced-motion: reduce)',

  /** Dark mode preference (for future light theme support) */
  darkMode: '@media (prefers-color-scheme: dark)',

  /** Light mode preference */
  lightMode: '@media (prefers-color-scheme: light)',

  /** High contrast mode */
  highContrast: '@media (prefers-contrast: more)',

  /** Hover available (no touch devices) */
  hover: '@media (hover: hover)',

  /** Touch devices */
  touch: '@media (hover: none)',
} as const;

// =============================================================================
// Container Widths
// =============================================================================

export const containerWidths = {
  /** Small container (forms, dialogs) */
  sm: '640px',

  /** Medium container (content pages) */
  md: '768px',

  /** Large container (main content) */
  lg: '1024px',

  /** Extra large container (dashboard) */
  xl: '1280px',

  /** Full width with max constraint */
  full: '1536px',
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type BreakpointToken = keyof typeof breakpoints;
export type MediaQueryToken = keyof typeof mediaQueries;
export type ContainerWidth = keyof typeof containerWidths;
