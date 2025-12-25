/**
 * Gradient Design Tokens
 *
 * CSS gradient definitions for backgrounds and overlays.
 */

import { colors } from './colors';

// =============================================================================
// Background Gradients
// =============================================================================

export const gradients = {
  /** Primary brand gradient (green to blue) */
  primary: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,

  /** Surface gradient (subtle brand tint) */
  surface: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 176, 255, 0.1))',

  /** Card gradient (subtle white overlay) */
  card: 'linear-gradient(135deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.05))',

  /** Hero gradient (for large headers) */
  hero: `linear-gradient(180deg, ${colors.background} 0%, rgba(10, 22, 40, 0.95) 100%)`,

  /** Overlay gradient (for image overlays) */
  overlay: 'linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.7) 100%)',

  /** Success gradient (for success states) */
  success: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',

  /** Error gradient (for error states) */
  error: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',

  /** Warning gradient (for warning states) */
  warning: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',

  /** Info gradient (for info states) */
  info: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type GradientToken = keyof typeof gradients;
