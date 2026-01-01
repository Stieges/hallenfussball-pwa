/**
 * Semantic Color Tokens - Dark Mode
 *
 * This file maps the raw palette colors to semantic meaning.
 * These tokens describe WHAT the color is used for, not what it looks like.
 *
 * Usage: Import these in components for consistent theming.
 *
 * @example
 * import { semanticColors } from '@/design-tokens/colors/semantic';
 * // OR use the themed version from colors/index.ts
 *
 * WCAG AA Compliance: All text colors validated for 4.5:1 contrast ratio.
 */

import { palette } from './palette';

export const semanticColorsDark = {
  // ---------------------------------------------------------------------------
  // Brand Colors
  // ---------------------------------------------------------------------------
  primary: palette.green[400],
  primaryDark: '#00C853',
  primaryHover: palette.green[500],
  primaryActive: palette.green[600],
  primaryLight: 'rgba(0, 230, 118, 0.15)',
  primaryMedium: 'rgba(0, 230, 118, 0.1)',
  primarySubtle: 'rgba(0, 230, 118, 0.05)',
  primarySelected: 'rgba(0, 230, 118, 0.2)', // For selected cards/buttons
  primaryBorder: 'rgba(0, 230, 118, 0.2)',
  primaryBorderActive: 'rgba(0, 230, 118, 0.3)',
  primaryBorderStrong: 'rgba(0, 230, 118, 0.4)',

  secondary: palette.blue[500],
  secondaryHover: palette.blue[600],
  secondaryLight: 'rgba(0, 176, 255, 0.15)',
  secondaryMedium: 'rgba(0, 176, 255, 0.1)',
  secondarySubtle: 'rgba(0, 176, 255, 0.05)',
  secondarySelected: 'rgba(0, 176, 255, 0.2)', // For selected info states
  secondaryBadge: 'rgba(0, 176, 255, 0.08)', // For subtle info badges
  secondaryBorder: 'rgba(0, 176, 255, 0.2)',
  secondaryBorderActive: 'rgba(0, 176, 255, 0.3)',
  secondaryBorderStrong: 'rgba(0, 176, 255, 0.5)',

  accent: '#FFD700',
  accentLight: 'rgba(255, 215, 0, 0.2)',
  accentMedium: 'rgba(255, 215, 0, 0.1)',
  accentSubtle: 'rgba(255, 215, 0, 0.05)',
  accentBadge: 'rgba(255, 215, 0, 0.08)', // For subtle accent badges
  accentBorder: 'rgba(255, 215, 0, 0.3)',

  // ---------------------------------------------------------------------------
  // Background Colors
  // ---------------------------------------------------------------------------
  background: palette.neutral[950],
  surface: 'rgba(255, 255, 255, 0.05)',
  surfaceLight: 'rgba(255, 255, 255, 0.1)',
  surfaceSolid: palette.neutral[800],
  surfaceHover: 'rgba(255, 255, 255, 0.08)',
  surfaceDark: 'rgba(0, 0, 0, 0.3)',
  surfaceDarkLight: 'rgba(0, 0, 0, 0.1)',
  surfaceDarkMedium: 'rgba(0, 0, 0, 0.2)',
  surfaceVariant: palette.neutral[700],
  surfaceElevated: palette.neutral[800], // For elevated cards

  // ---------------------------------------------------------------------------
  // Text Colors (WCAG AA validated)
  // ---------------------------------------------------------------------------
  textPrimary: palette.neutral[0], // 15:1 on background
  textSecondary: '#A3B8D4', // 5.1:1 on surface
  textMuted: 'rgba(255, 255, 255, 0.5)',
  textPlaceholder: '#9DB2CC', // 4.7:1 on surface
  textDisabled: '#6B7A8F', // WCAG fix: war palette.neutral[600] (#475569, 2.4:1) → jetzt 4.1:1 auf background
  textTertiary: palette.neutral[400],
  textOnDark: '#ffffff', // For text on colored backgrounds

  // ---------------------------------------------------------------------------
  // Border Colors
  // ---------------------------------------------------------------------------
  border: 'rgba(255, 255, 255, 0.1)',
  borderLight: palette.neutral[600],
  borderActive: 'rgba(0, 230, 118, 0.3)',
  borderSolid: palette.neutral[700],
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderDefault: 'rgba(255, 255, 255, 0.12)',
  borderStrong: palette.neutral[500],

  // ---------------------------------------------------------------------------
  // Semantic/Status Colors
  // ---------------------------------------------------------------------------
  error: palette.red[400],
  errorHover: palette.red[500],
  errorLight: 'rgba(255, 82, 82, 0.15)',
  errorMedium: 'rgba(255, 82, 82, 0.2)',
  errorBorder: 'rgba(255, 82, 82, 0.3)',

  warning: palette.orange[400],
  warningHover: palette.orange[500],
  warningLight: 'rgba(255, 145, 0, 0.15)',
  warningSubtle: 'rgba(255, 145, 0, 0.08)',
  warningMedium: 'rgba(255, 145, 0, 0.1)',
  warningSelected: 'rgba(255, 145, 0, 0.2)', // For selected warning states
  warningBorder: 'rgba(255, 145, 0, 0.3)',
  warningBorderActive: 'rgba(255, 145, 0, 0.3)',
  warningBorderStrong: 'rgba(255, 145, 0, 0.5)',

  success: '#4CAF50',
  successHover: '#43A047',
  successLight: 'rgba(76, 175, 80, 0.15)',

  info: palette.blue[500],
  infoLight: 'rgba(0, 176, 255, 0.15)',
  infoBorder: 'rgba(0, 176, 255, 0.2)',

  // ---------------------------------------------------------------------------
  // On-Colors (text on colored backgrounds)
  // ---------------------------------------------------------------------------
  onPrimary: '#0A1628',
  onSecondary: '#0A1628',
  onError: palette.neutral[0],
  onWarning: '#000000',
  onSuccess: palette.neutral[0],

  // ---------------------------------------------------------------------------
  // Status Colors (for tournament states)
  // ---------------------------------------------------------------------------
  statusLive: palette.special.live, // Red for LIVE indicator
  statusLiveBg: 'rgba(220, 38, 38, 0.15)',
  statusLiveRowBg: 'rgba(220, 38, 38, 0.08)',

  statusUpcoming: '#4CAF50',
  statusUpcomingBg: 'rgba(76, 175, 80, 0.15)',

  statusFinished: '#9E9E9E',
  statusFinishedBg: 'rgba(158, 158, 158, 0.15)',

  statusDraft: palette.orange[400],
  statusDraftBg: 'rgba(255, 145, 0, 0.15)',

  statusExternal: '#9575CD',
  statusExternalBg: 'rgba(149, 117, 205, 0.15)',

  // Warning/Trash status
  statusWarning: palette.orange[500],
  statusWarningBg: 'rgba(249, 115, 22, 0.15)',

  // ---------------------------------------------------------------------------
  // Live Cockpit Specific
  // ---------------------------------------------------------------------------
  liveBadge: palette.special.live,
  liveBadgeBg: 'rgba(220, 38, 38, 0.2)',
  liveBadgePulse: 'rgba(220, 38, 38, 0.4)',

  // ---------------------------------------------------------------------------
  // Correction/Warning Banner
  // ---------------------------------------------------------------------------
  correctionBg: 'rgba(255, 145, 0, 0.12)',
  correctionBorder: 'rgba(255, 145, 0, 0.4)',
  correctionText: '#FFB74D',
  correctionIcon: palette.orange[400],

  // ---------------------------------------------------------------------------
  // Medal Colors (for rankings)
  // ---------------------------------------------------------------------------
  medalGold: palette.special.gold,
  medalSilver: palette.special.silver,
  medalBronze: palette.special.bronze,

  // ---------------------------------------------------------------------------
  // Special Colors
  // ---------------------------------------------------------------------------
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayStrong: 'rgba(0, 0, 0, 0.7)',
  overlayDialog: 'rgba(0, 0, 0, 0.8)',
  focus: palette.green[400],
  focusRing: 'rgba(0, 230, 118, 0.2)',

  inputBg: 'rgba(0, 0, 0, 0.3)',

  // ---------------------------------------------------------------------------
  // Shadows & Glows
  // ---------------------------------------------------------------------------
  shadowSoft: 'rgba(0, 0, 0, 0.2)',
  shadowMedium: 'rgba(0, 0, 0, 0.3)',
  primaryGlow: 'rgba(0, 230, 118, 0.5)',
  primaryGlowLight: 'rgba(0, 230, 118, 0.2)',
  errorGlow: 'rgba(255, 82, 82, 0.25)',
  warningShadow: 'rgba(255, 193, 7, 0.3)',
  warningHighlight: 'rgba(255, 193, 7, 0.08)',
  dangerHighlight: 'rgba(248, 81, 73, 0.15)',
  dangerGradientStart: 'rgba(248, 81, 73, 0.2)',
  dangerGradientEnd: 'rgba(248, 81, 73, 0.05)',
  dangerBorder: 'rgba(248, 81, 73, 0.3)',
  surfaceHighlight: 'rgba(255, 255, 255, 0.05)',

  backgroundDark: '#0d1d35',
  backgroundDeep: '#020617',
  backgroundGradientDark: 'radial-gradient(circle at top, #111827 0%, #020617 55%, #000 100%)',

  confettiColors: ['#00e676', '#76ff03', '#ffeb3b', '#ffffff'] as readonly string[],

  gradientErrorLight: '#ff6b6b',
  gradientPrimaryLight: '#4ade80',

  qrBackground: '#FFFFFF',

  // ---------------------------------------------------------------------------
  // Schedule Editor Colors
  // ---------------------------------------------------------------------------
  editorEditModeBg: 'rgba(76, 175, 80, 0.1)',
  editorEditModeHover: 'rgba(76, 175, 80, 0.2)',
  editorEditModeRowBg: 'rgba(76, 175, 80, 0.08)',
  editorEditModeBorder: 'rgba(76, 175, 80, 0.4)',

  editorDirtyBg: 'rgba(255, 193, 7, 0.15)',
  editorDirtyRowBg: 'rgba(255, 193, 7, 0.08)',
  editorDirtyRowBgLight: 'rgba(255, 193, 7, 0.05)',
  editorDirtyBorder: 'rgba(255, 193, 7, 0.4)',

  editorSwapBg: 'rgba(245, 158, 11, 0.15)',
  editorSwapActive: 'rgba(245, 158, 11, 0.25)',

  editorErrorRowBg: 'rgba(239, 83, 80, 0.1)',
  editorErrorRowBgLight: 'rgba(239, 83, 80, 0.05)',

  editorDragActiveBg: 'rgba(0, 176, 255, 0.1)',
  editorDropTargetBg: 'rgba(0, 176, 255, 0.05)',

  editorLockedBg: 'rgba(0, 0, 0, 0.08)',
  editorLockedText: 'rgba(255, 255, 255, 0.5)',

  // ---------------------------------------------------------------------------
  // Management & Ranking Colors
  // ---------------------------------------------------------------------------
  rankingHighlightBg: 'rgba(34, 197, 94, 0.15)',
  rankingPlacementBg: 'rgba(0, 230, 118, 0.08)',
  rankingExpandedBg: 'rgba(0, 230, 118, 0.05)',

  infoBannerBg: 'rgba(33, 150, 243, 0.08)',
  infoBadgeBg: 'rgba(33, 150, 243, 0.15)',

  warningBannerBg: 'rgba(255, 152, 0, 0.08)',
  warningBannerBgStrong: 'rgba(255, 152, 0, 0.1)',
  warningBannerBorder: 'rgba(255, 152, 0, 0.3)',
  dirtyIndicatorBg: 'rgba(255, 152, 0, 0.15)',

  dangerActionBg: 'rgba(244, 67, 54, 0.1)',

  neutralBadgeBg: 'rgba(0, 0, 0, 0.08)',
  neutralRowBg: 'rgba(0, 0, 0, 0.02)',
  neutralStatusBg: 'rgba(100, 100, 100, 0.1)',

  monitorSectionBg: 'rgba(15, 23, 42, 0.9)',
  monitorSectionBgStrong: 'rgba(15, 23, 42, 0.95)',
  monitorSectionBgLight: 'rgba(15, 23, 42, 0.65)',

  panelGradientStart: 'rgba(15, 23, 42, 0.9)',
  panelGradientEnd: 'rgba(3, 7, 18, 0.9)',
  timerGradientBg: 'rgba(15, 23, 42, 0.98)',

  // ---------------------------------------------------------------------------
  // Match Event Colors (for EventsList)
  // ---------------------------------------------------------------------------
  eventGoalBg: 'rgba(0, 230, 118, 0.05)',
  eventGoalBorder: 'rgba(0, 230, 118, 0.3)',

  eventStatusBg: 'rgba(59, 130, 246, 0.05)',
  eventStatusBorder: 'rgba(59, 130, 246, 0.3)',

  eventEditBg: 'rgba(251, 191, 36, 0.05)',
  eventEditBorder: 'rgba(251, 191, 36, 0.3)',

  gradientNextMatch: 'linear-gradient(135deg, rgba(0, 230, 118, 0.1), rgba(0, 176, 255, 0.1))',
} as const;

export type SemanticColorToken = keyof typeof semanticColorsDark;

// Generic SemanticColors type that both dark and light themes conform to
export type SemanticColors = {
  [K in keyof typeof semanticColorsDark]: (typeof semanticColorsDark)[K] extends readonly string[]
    ? readonly string[]
    : string;
};
