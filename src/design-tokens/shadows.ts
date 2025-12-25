/**
 * Shadow Design Tokens
 *
 * Box shadow definitions for elevation and depth.
 * Darker shadows for dark theme compatibility.
 *
 * @see https://m3.material.io/styles/elevation/overview
 */

// =============================================================================
// Elevation Shadows
// =============================================================================

export const shadows = {
  /** No shadow */
  none: 'none',

  /** Level 1 - Subtle elevation (cards, buttons) */
  sm: '0 2px 4px rgba(0, 0, 0, 0.2)',

  /** Level 2 - Standard elevation (dropdowns, popovers) */
  md: '0 4px 12px rgba(0, 0, 0, 0.3)',

  /** Level 3 - High elevation (modals, dialogs) */
  lg: '0 8px 24px rgba(0, 0, 0, 0.4)',

  /** Level 4 - Maximum elevation (tooltips, floating) */
  xl: '0 12px 32px rgba(0, 0, 0, 0.5)',
} as const;

// =============================================================================
// Semantic Shadows
// =============================================================================

export const shadowSemantics = {
  /** Card shadow - consistent elevation for cards */
  card: shadows.md,

  /** Dialog/Modal shadow - high elevation */
  dialog: '0 8px 32px rgba(0, 0, 0, 0.5)',

  /** Toast notification shadow */
  toast: '0 10px 25px rgba(0, 0, 0, 0.3), 0 4px 10px rgba(0, 0, 0, 0.2)',

  /** Dropdown menu shadow */
  dropdown: shadows.md,

  /** Button hover shadow */
  buttonHover: '0 4px 8px rgba(0, 0, 0, 0.2)',

  /** Focus ring shadow (for accessibility) */
  focus: '0 0 0 4px rgba(0, 230, 118, 0.2)',

  /** Error focus ring */
  focusError: '0 0 0 4px rgba(255, 82, 82, 0.2)',

  /** Inner shadow (for inset elements) */
  inset: 'inset 0 2px 4px rgba(0, 0, 0, 0.2)',
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type ShadowToken = keyof typeof shadows;
export type ShadowSemantic = keyof typeof shadowSemantics;
