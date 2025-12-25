/**
 * Border Radius Design Tokens
 *
 * 8pt Grid aligned border radius values for consistent rounding.
 *
 * @see https://m3.material.io/styles/shape/overview
 */

// =============================================================================
// Border Radius Scale
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

// =============================================================================
// Semantic Radius Aliases
// =============================================================================

export const radiiSemantics = {
  /** Button border radius */
  button: radii.md,

  /** Input/textarea border radius */
  input: radii.md,

  /** Card border radius */
  card: radii.lg,

  /** Dialog/modal border radius */
  dialog: radii.lg,

  /** Badge/chip border radius */
  badge: radii.sm,

  /** Avatar border radius */
  avatar: radii.full,

  /** Toast notification border radius */
  toast: radii.md,

  /** Tooltip border radius */
  tooltip: radii.sm,
} as const;

// =============================================================================
// Legacy Aliases (for backwards compatibility with theme.ts)
// =============================================================================

export const radiiLegacy = {
  sm: radii.sm,   // 4px (was 8px)
  md: radii.md,   // 8px (was 12px)
  lg: radii.lg,   // 16px
  xl: radii.xl,   // 24px (was 20px)
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type RadiusToken = keyof typeof radii;
export type RadiusSemantic = keyof typeof radiiSemantics;
