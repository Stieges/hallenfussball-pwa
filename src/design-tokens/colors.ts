/**
 * Color Design Tokens
 *
 * Single source of truth for all color values in the application.
 * Uses semantic naming for maintainability and consistency.
 *
 * WCAG AA Compliance: All text colors have been validated for 4.5:1 contrast ratio.
 *
 * @see https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html
 */

// =============================================================================
// Primitive Color Palette (do not use directly in components)
// =============================================================================

const primitives = {
  green: {
    50: '#E8FFF0',
    100: '#C6FFD9',
    200: '#8FFDB8',
    300: '#4DF997',
    400: '#00E676', // Primary
    500: '#00B862',
    600: '#008F4C',
    700: '#006637',
    800: '#003D21',
    900: '#00140B',
  },
  blue: {
    50: '#E6F7FF',
    100: '#BAE7FF',
    200: '#91D5FF',
    300: '#69C0FF',
    400: '#40A9FF',
    500: '#00B0FF', // Secondary/Accent
    600: '#0096E6',
    700: '#007ACC',
    800: '#005EB3',
    900: '#004299',
  },
  neutral: {
    0: '#FFFFFF',
    50: '#F8FAFC',
    100: '#F1F5F9',
    200: '#E2E8F0',
    300: '#CBD5E1',
    400: '#94A3B8',
    500: '#64748B',
    600: '#475569',
    700: '#334155', // Border
    800: '#1E293B', // Surface (solid fallback)
    900: '#0F172A',
    950: '#0A1628', // Background
  },
  red: {
    300: '#FCA5A5',
    400: '#FF5252', // Error
    500: '#EF4444',
    600: '#DC2626',
  },
  orange: {
    300: '#FDBA74',
    400: '#FF9100', // Warning
    500: '#F97316',
    600: '#EA580C',
  },
  yellow: {
    400: '#FACC15',
    500: '#EAB308',
    600: '#CA8A04', // Gold
  },
  purple: {
    400: '#A78BFA',
    500: '#8B5CF6',
    600: '#7C3AED',
  },
} as const;

// =============================================================================
// Semantic Colors (use these in components)
// =============================================================================

export const colors = {
  // ---------------------------------------------------------------------------
  // Brand Colors
  // ---------------------------------------------------------------------------
  primary: primitives.green[400],
  primaryDark: '#00C853',
  primaryHover: primitives.green[500],
  primaryActive: primitives.green[600],
  primaryLight: 'rgba(0, 230, 118, 0.15)',

  secondary: primitives.blue[500],
  secondaryHover: primitives.blue[600],
  secondaryLight: 'rgba(0, 176, 255, 0.15)',

  accent: '#FFD700',

  // ---------------------------------------------------------------------------
  // Background Colors
  // ---------------------------------------------------------------------------
  background: primitives.neutral[950],
  surface: 'rgba(255, 255, 255, 0.05)',
  surfaceLight: 'rgba(255, 255, 255, 0.1)',
  surfaceSolid: primitives.neutral[800], // Solid fallback for surface
  surfaceHover: 'rgba(255, 255, 255, 0.08)',
  surfaceDark: 'rgba(0, 0, 0, 0.3)', // For score containers, input backgrounds
  surfaceVariant: primitives.neutral[700],

  // ---------------------------------------------------------------------------
  // Text Colors (WCAG AA validated)
  // ---------------------------------------------------------------------------
  textPrimary: primitives.neutral[0], // 15:1 on background
  textSecondary: '#A3B8D4', // 5.1:1 on surface (was #8BA3C7)
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textPlaceholder: '#9DB2CC', // 4.7:1 on surface
  textDisabled: primitives.neutral[600],

  // ---------------------------------------------------------------------------
  // Border Colors
  // ---------------------------------------------------------------------------
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: primitives.neutral[600],
  borderActive: 'rgba(0, 230, 118, 0.3)',
  borderSolid: primitives.neutral[700],

  // ---------------------------------------------------------------------------
  // Semantic/Status Colors
  // ---------------------------------------------------------------------------
  error: primitives.red[400],
  errorHover: primitives.red[500],
  errorLight: 'rgba(255, 82, 82, 0.15)',

  warning: primitives.orange[400],
  warningHover: primitives.orange[500],
  warningLight: 'rgba(255, 145, 0, 0.15)',

  success: '#4CAF50',
  successHover: '#43A047',
  successLight: 'rgba(76, 175, 80, 0.15)',

  info: primitives.blue[500],
  infoLight: 'rgba(0, 176, 255, 0.15)',

  // ---------------------------------------------------------------------------
  // On-Colors (text on colored backgrounds)
  // ---------------------------------------------------------------------------
  onPrimary: '#0A1628', // Dark on green
  onSecondary: '#0A1628', // Dark on blue
  onError: primitives.neutral[0],
  onWarning: '#000000', // Black on orange
  onSuccess: primitives.neutral[0],

  // ---------------------------------------------------------------------------
  // Status Colors (for tournament states)
  // ---------------------------------------------------------------------------
  statusLive: primitives.blue[500],
  statusLiveBg: 'rgba(0, 176, 255, 0.15)',
  statusLiveRowBg: 'rgba(0, 176, 255, 0.08)',

  statusUpcoming: '#4CAF50',
  statusUpcomingBg: 'rgba(76, 175, 80, 0.15)',

  statusFinished: '#9E9E9E',
  statusFinishedBg: 'rgba(158, 158, 158, 0.15)',

  statusDraft: primitives.orange[400],
  statusDraftBg: 'rgba(255, 145, 0, 0.15)',

  statusExternal: '#9575CD',
  statusExternalBg: 'rgba(149, 117, 205, 0.15)',

  // ---------------------------------------------------------------------------
  // Correction/Warning Banner
  // ---------------------------------------------------------------------------
  correctionBg: 'rgba(255, 145, 0, 0.12)',
  correctionBorder: 'rgba(255, 145, 0, 0.4)',
  correctionText: '#FFB74D',
  correctionIcon: primitives.orange[400],

  // ---------------------------------------------------------------------------
  // Medal Colors (for rankings)
  // ---------------------------------------------------------------------------
  medalGold: '#FFD700',
  medalSilver: '#C0C0C0',
  medalBronze: '#CD7F32',

  // ---------------------------------------------------------------------------
  // Special Colors
  // ---------------------------------------------------------------------------
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayStrong: 'rgba(0, 0, 0, 0.7)',
  focus: primitives.green[400],
  focusRing: 'rgba(0, 230, 118, 0.2)',

  // Input backgrounds
  inputBg: 'rgba(0, 0, 0, 0.3)',

  // Background variants (for gradients)
  backgroundDark: '#0d1d35',
  backgroundDeep: '#020617',
  backgroundGradientDark: 'radial-gradient(circle at top, #111827 0%, #020617 55%, #000 100%)',

  // Animation/Effect Colors
  confettiColors: ['#00e676', '#76ff03', '#ffeb3b', '#ffffff'] as readonly string[],

  // Gradient color stops (for gradient construction)
  gradientErrorLight: '#ff6b6b',
  gradientPrimaryLight: '#4ade80',

  // QR Code
  qrBackground: '#FFFFFF',

  // ---------------------------------------------------------------------------
  // Schedule Editor Colors
  // ---------------------------------------------------------------------------
  // Edit Mode (green tints for active editing state)
  editorEditModeBg: 'rgba(76, 175, 80, 0.1)',
  editorEditModeHover: 'rgba(76, 175, 80, 0.2)',
  editorEditModeRowBg: 'rgba(76, 175, 80, 0.08)',
  editorEditModeBorder: 'rgba(76, 175, 80, 0.4)',

  // Dirty/Changed indicator (amber/yellow for unsaved changes)
  editorDirtyBg: 'rgba(255, 193, 7, 0.15)',
  editorDirtyRowBg: 'rgba(255, 193, 7, 0.08)',
  editorDirtyRowBgLight: 'rgba(255, 193, 7, 0.05)',
  editorDirtyBorder: 'rgba(255, 193, 7, 0.4)',

  // Swap/Move indicators (amber for drag targets)
  editorSwapBg: 'rgba(245, 158, 11, 0.15)',
  editorSwapActive: 'rgba(245, 158, 11, 0.25)',

  // Error rows (red tints for conflicts)
  editorErrorRowBg: 'rgba(239, 83, 80, 0.1)',
  editorErrorRowBgLight: 'rgba(239, 83, 80, 0.05)',

  // Drag & Drop
  editorDragActiveBg: 'rgba(0, 176, 255, 0.1)',
  editorDropTargetBg: 'rgba(0, 176, 255, 0.05)',

  // Locked/Disabled matches
  editorLockedBg: 'rgba(0, 0, 0, 0.08)',
  editorLockedText: 'rgba(255, 255, 255, 0.5)',

  // ---------------------------------------------------------------------------
  // Management & Ranking Colors
  // ---------------------------------------------------------------------------
  // Ranking highlights (green tints for active placement criteria)
  rankingHighlightBg: 'rgba(34, 197, 94, 0.15)',
  rankingPlacementBg: 'rgba(0, 230, 118, 0.08)',
  rankingExpandedBg: 'rgba(0, 230, 118, 0.05)',

  // Info banners (blue tints for informational content)
  infoBannerBg: 'rgba(33, 150, 243, 0.08)',
  infoBadgeBg: 'rgba(33, 150, 243, 0.15)',

  // Warning banners (orange tints for caution/dirty state)
  warningBannerBg: 'rgba(255, 152, 0, 0.08)',
  warningBannerBgStrong: 'rgba(255, 152, 0, 0.1)',
  warningBannerBorder: 'rgba(255, 152, 0, 0.3)',
  dirtyIndicatorBg: 'rgba(255, 152, 0, 0.15)',

  // Delete/Danger action backgrounds
  dangerActionBg: 'rgba(244, 67, 54, 0.1)',

  // Neutral badges and rows
  neutralBadgeBg: 'rgba(0, 0, 0, 0.08)',
  neutralRowBg: 'rgba(0, 0, 0, 0.02)',
  neutralStatusBg: 'rgba(100, 100, 100, 0.1)',

  // Monitor/TV display
  monitorSectionBg: 'rgba(15, 23, 42, 0.9)',

  // Gradients (stored as full gradient strings)
  gradientNextMatch: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 176, 255, 0.1))',
} as const;

// =============================================================================
// Type Exports
// =============================================================================

export type ColorToken = keyof typeof colors;
export type PrimitiveColors = typeof primitives;
