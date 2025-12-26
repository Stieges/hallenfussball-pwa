/**
 * Border Radius Design Tokens
 *
 * 8pt Grid aligned border radius values for consistent rounding.
 * Uses legacy semantic names (sm, md, lg, xl) as primary export.
 *
 * @see https://m3.material.io/styles/shape/overview
 */

// =============================================================================
// Border Radius (Legacy semantic names - sm, md, lg, xl)
// =============================================================================

export const radii = {
  /** No rounding */
  none: '0',
  /** 4px - Subtle rounding (badges, small elements) */
  sm: '4px',
  /** 8px - Standard rounding (buttons, inputs, cards) */
  md: '8px',
  /** 16px - Large rounding (dialogs, floating elements) */
  lg: '16px',
  /** 24px - Extra large rounding (hero cards) */
  xl: '24px',
  /** Full circle/pill shape */
  full: '9999px',
} as const;

// Alias for backwards compatibility
export const borderRadius = radii;

// =============================================================================
// Semantic Radius (for specific component types)
// =============================================================================

export const radiiSemantics = {
  button: radii.md,
  input: radii.md,
  card: radii.lg,
  dialog: radii.lg,
  badge: radii.sm,
  avatar: radii.full,
  toast: radii.md,
  tooltip: radii.sm,
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type RadiusKey = keyof typeof radii;
