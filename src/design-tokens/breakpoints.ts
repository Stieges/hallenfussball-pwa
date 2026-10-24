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
  /** Bis einschließlich dieser Breite gelten die schmalsten Handy-Maße (Gruppentabelle ohne Seitenrand, @ZM-088, @OB-060) */
  narrowPhone: '360px',

  /** Unterhalb davon zeigt die Kopfzeile der Startseite Marken nur als Symbol (@OB-021, 360–390 px ohne Überlauf) */
  compactHeader: '400px',

  /** Small phones and below */
  mobile: '480px',

  /** Unterhalb davon erscheinen zentrierte Dialoge als Blatt von unten (B-43b3, @OB-021) */
  sheet: '600px',

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
  narrowPhone: 360,
  compactHeader: 400,
  mobile: 480,
  sheet: 600,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
  ultrawide: 1536,
} as const;

/**
 * Stufen des Cockpits nach Fensterhöhe (Layout `breit`, Plan Cockpit v2 3.4, F5): unter `knapp` die Stufe „knapp“ (auch Variante a:
 * Name nur in der Leiste), ab `gross` die Stufe „gross“, dazwischen „normal“. Unter `cockpitMinHoehe` scrollt die Fläche.
 */
export const cockpitHeightSteps = { knapp: 720, gross: 800 } as const;
export const cockpitMinHoehe = 620;

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
