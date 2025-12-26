/**
 * Spacing Design Tokens
 *
 * 8pt Grid System for consistent spacing throughout the application.
 * All values are multiples of 8px (with 4px half-unit for fine-tuning).
 *
 * @see https://m3.material.io/foundations/layout/understanding-layout/spacing
 */

// =============================================================================
// Spacing Scale (Legacy semantic names - xs, sm, md, lg, xl, xxl)
// =============================================================================

export const spacing = {
  /** 4px - Extra small (half unit for fine-tuning) */
  xs: '4px',
  /** 8px - Small (base unit) */
  sm: '8px',
  /** 16px - Medium (standard spacing) */
  md: '16px',
  /** 24px - Large (section spacing) */
  lg: '24px',
  /** 32px - Extra large */
  xl: '32px',
  /** 48px - Double extra large */
  xxl: '48px',
} as const;

// =============================================================================
// 8pt Grid Scale (numeric keys for precise control)
// =============================================================================

export const spacingScale = {
  '0': '0',
  '0.5': '4px',   // 0.5 × 8 = 4px
  '1': '8px',     // 1 × 8 = 8px
  '1.5': '12px',  // 1.5 × 8 = 12px (avoid if possible)
  '2': '16px',    // 2 × 8 = 16px
  '3': '24px',    // 3 × 8 = 24px
  '4': '32px',    // 4 × 8 = 32px
  '5': '40px',    // 5 × 8 = 40px
  '6': '48px',    // 6 × 8 = 48px
  '8': '64px',    // 8 × 8 = 64px
  '10': '80px',   // 10 × 8 = 80px
  '12': '96px',   // 12 × 8 = 96px
} as const;

// =============================================================================
// Semantic Spacing (for specific use cases)
// =============================================================================

export const spacingSemantics = {
  // Component Internal Spacing
  insetXs: spacing.xs,    // 4px
  insetSm: spacing.sm,    // 8px
  insetMd: spacing.md,    // 16px
  insetLg: spacing.lg,    // 24px
  insetXl: spacing.xl,    // 32px

  // Stack Spacing (vertical gaps)
  stackXs: spacing.xs,
  stackSm: spacing.sm,
  stackMd: spacing.md,
  stackLg: spacing.lg,

  // Inline Spacing (horizontal gaps)
  inlineXs: spacing.xs,
  inlineSm: spacing.sm,
  inlineMd: spacing.md,

  // Accessibility
  touchTarget: '44px',
  touchTargetLg: '48px',

  // Layout
  sectionGap: spacing.xl,
  pageMargin: spacing.md,
  pageMarginDesktop: spacing.lg,
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type SpacingKey = keyof typeof spacing;
export type SpacingScaleKey = keyof typeof spacingScale;
