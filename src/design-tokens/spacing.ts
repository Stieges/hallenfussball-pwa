/**
 * Spacing Design Tokens
 *
 * 8pt Grid System for consistent spacing throughout the application.
 * All values are multiples of 8px (with 4px half-unit for fine-tuning).
 *
 * @see https://m3.material.io/foundations/layout/understanding-layout/spacing
 */

// =============================================================================
// Base Spacing Scale (8pt Grid)
// =============================================================================

export const spacing = {
  /** 0 - No spacing */
  '0': '0',
  /** 0.5x (4px) - Half unit for fine-tuning */
  '0.5': '4px',
  /** 1x (8px) - Base unit */
  '1': '8px',
  /** 1.5x (12px) - DEPRECATED: Only for migration, prefer 8px or 16px */
  '1.5': '12px',
  /** 2x (16px) - Standard spacing */
  '2': '16px',
  /** 3x (24px) - Section spacing */
  '3': '24px',
  /** 4x (32px) - Large spacing */
  '4': '32px',
  /** 5x (40px) - Extra large */
  '5': '40px',
  /** 6x (48px) - Huge spacing */
  '6': '48px',
  /** 8x (64px) - Section gaps */
  '8': '64px',
  /** 10x (80px) - Page margins */
  '10': '80px',
  /** 12x (96px) - Hero sections */
  '12': '96px',
} as const;

// =============================================================================
// Semantic Spacing Aliases
// =============================================================================

export const spacingSemantics = {
  // ---------------------------------------------------------------------------
  // Component Internal Spacing (padding)
  // ---------------------------------------------------------------------------
  /** 4px - Icon padding, tight spacing */
  insetXs: spacing['0.5'],
  /** 8px - Small padding (buttons, badges) */
  insetSm: spacing['1'],
  /** 16px - Standard padding (cards, inputs) */
  insetMd: spacing['2'],
  /** 24px - Large padding (dialogs, sections) */
  insetLg: spacing['3'],
  /** 32px - Extra large padding */
  insetXl: spacing['4'],

  // ---------------------------------------------------------------------------
  // Stack Spacing (vertical gaps)
  // ---------------------------------------------------------------------------
  /** 4px - Tight vertical spacing */
  stackXs: spacing['0.5'],
  /** 8px - Small vertical spacing */
  stackSm: spacing['1'],
  /** 16px - Standard vertical spacing */
  stackMd: spacing['2'],
  /** 24px - Section spacing */
  stackLg: spacing['3'],
  /** 32px - Large section spacing */
  stackXl: spacing['4'],

  // ---------------------------------------------------------------------------
  // Inline Spacing (horizontal gaps)
  // ---------------------------------------------------------------------------
  /** 4px - Tight horizontal spacing */
  inlineXs: spacing['0.5'],
  /** 8px - Small horizontal spacing */
  inlineSm: spacing['1'],
  /** 16px - Standard horizontal spacing */
  inlineMd: spacing['2'],
  /** 24px - Large horizontal spacing */
  inlineLg: spacing['3'],

  // ---------------------------------------------------------------------------
  // Accessibility
  // ---------------------------------------------------------------------------
  /** 44px - Minimum touch target (WCAG) */
  touchTarget: '44px',
  /** 48px - Comfortable touch target */
  touchTargetLg: '48px',

  // ---------------------------------------------------------------------------
  // Layout
  // ---------------------------------------------------------------------------
  /** 32px - Gap between page sections */
  sectionGap: spacing['4'],
  /** 16px - Page margin on mobile */
  pageMargin: spacing['2'],
  /** 24px - Page margin on desktop */
  pageMarginDesktop: spacing['3'],
  /** 32px - Container max-width padding */
  containerPadding: spacing['4'],
} as const;

// =============================================================================
// Legacy Semantic Aliases (for backwards compatibility with theme.ts)
// =============================================================================

export const spacingLegacy = {
  xs: spacing['0.5'], // 4px
  sm: spacing['1'],   // 8px
  md: spacing['2'],   // 16px (was 12px)
  lg: spacing['3'],   // 24px (was 16px)
  xl: spacing['4'],   // 32px (was 24px)
  xxl: spacing['6'],  // 48px (was 32px)
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type SpacingToken = keyof typeof spacing;
export type SpacingSemantic = keyof typeof spacingSemantics;
export type SpacingLegacy = keyof typeof spacingLegacy;
