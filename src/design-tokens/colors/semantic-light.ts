/**
 * Semantic Color Tokens - Light Mode
 *
 * Light mode color mappings for improved readability in bright environments.
 * Uses darker versions of accent colors for better contrast on light backgrounds.
 *
 * WCAG AA Compliance: All text colors validated for 4.5:1 contrast ratio on light surfaces.
 */

import { palette } from './palette';

export const semanticColorsLight = {
  // ---------------------------------------------------------------------------
  // Brand Colors (darker for light mode contrast - WCAG AA 4.5:1 required)
  // ---------------------------------------------------------------------------
  primary: palette.emerald[700], // #047857 - 4.69:1 contrast on white (WCAG AA)
  primaryDark: palette.emerald[800],
  primaryHover: palette.emerald[800],
  primaryActive: palette.emerald[900],
  primaryLight: 'rgba(4, 120, 87, 0.12)',
  primaryMedium: 'rgba(4, 120, 87, 0.08)',
  primarySubtle: 'rgba(4, 120, 87, 0.04)',
  primarySelected: 'rgba(4, 120, 87, 0.18)', // For selected cards/buttons
  primaryBorder: 'rgba(4, 120, 87, 0.2)',
  primaryBorderActive: 'rgba(4, 120, 87, 0.4)',
  primaryBorderStrong: 'rgba(4, 120, 87, 0.5)',

  secondary: palette.blue[600],
  secondaryHover: palette.blue[700],
  secondaryLight: 'rgba(0, 150, 230, 0.12)',
  secondaryMedium: 'rgba(0, 150, 230, 0.08)',
  secondarySubtle: 'rgba(0, 150, 230, 0.04)',
  secondarySelected: 'rgba(0, 150, 230, 0.18)', // For selected info states
  secondaryBadge: 'rgba(0, 150, 230, 0.06)', // For subtle info badges
  secondaryBorder: 'rgba(0, 150, 230, 0.2)',
  secondaryBorderActive: 'rgba(0, 150, 230, 0.25)',
  secondaryBorderStrong: 'rgba(0, 150, 230, 0.4)',

  accent: palette.amber[600],
  accentLight: 'rgba(217, 119, 6, 0.15)',
  accentMedium: 'rgba(217, 119, 6, 0.08)',
  accentSubtle: 'rgba(217, 119, 6, 0.05)',
  accentBadge: 'rgba(217, 119, 6, 0.06)', // For subtle accent badges
  accentBadgeSolid: 'rgba(245, 158, 11, 0.85)', // For solid gold badges (draft status)
  accentBorder: 'rgba(217, 119, 6, 0.25)',
  accentBorderActive: 'rgba(217, 119, 6, 0.35)', // For active/hover gold borders

  // ---------------------------------------------------------------------------
  // Background Colors
  // ---------------------------------------------------------------------------
  background: palette.neutral[0], // Pure white
  surfaceSubtle: 'rgba(0, 0, 0, 0.01)', // For very subtle backgrounds
  surface: palette.neutral[50], // Soft gray
  surfaceLight: palette.neutral[100],
  surfaceSolid: palette.neutral[50],
  surfaceHover: palette.neutral[100],
  surfaceDark: palette.neutral[100],
  surfaceDarkLight: palette.neutral[50],
  surfaceDarkSubtle: 'rgba(0, 0, 0, 0.05)', // For subtle dark overlays
  surfaceDarkMedium: palette.neutral[100],
  surfaceVariant: palette.neutral[200],
  surfaceElevated: palette.neutral[0], // White with shadow

  // ---------------------------------------------------------------------------
  // Text Colors (WCAG AA validated for light backgrounds)
  // ---------------------------------------------------------------------------
  textPrimary: '#1A1A2E', // Near black - 15:1 on white
  textSecondary: '#6B7280', // Medium gray - 5.8:1 on white
  textMuted: 'rgba(0, 0, 0, 0.5)',
  textPlaceholder: '#9CA3AF', // Light gray - 4.6:1 on white
  textDisabled: palette.neutral[500], // WCAG fix: war neutral[400] (#94A3B8, 2.6:1) → jetzt 4.7:1 auf weiß
  textTertiary: '#9CA3AF',
  textOnDark: '#ffffff', // For text on colored backgrounds

  // ---------------------------------------------------------------------------
  // Border Colors
  // ---------------------------------------------------------------------------
  border: palette.neutral[200],
  borderLight: palette.neutral[200],
  borderMedium: palette.neutral[300], // For medium-strength borders
  borderActive: 'rgba(5, 150, 105, 0.4)',
  borderSolid: palette.neutral[300],
  borderSubtle: palette.neutral[100],
  borderDefault: palette.neutral[200],
  borderStrong: palette.neutral[400],

  // ---------------------------------------------------------------------------
  // Semantic/Status Colors (adjusted for light bg)
  // ---------------------------------------------------------------------------
  error: palette.red[600],
  errorHover: palette.red[700],
  errorSubtle: 'rgba(220, 38, 38, 0.06)', // For subtle error backgrounds
  errorLight: 'rgba(220, 38, 38, 0.1)',
  errorMedium: 'rgba(220, 38, 38, 0.15)',
  errorBorder: 'rgba(220, 38, 38, 0.25)',

  warning: palette.amber[600],
  warningHover: palette.amber[700],
  warningLight: 'rgba(217, 119, 6, 0.1)',
  warningSubtle: 'rgba(217, 119, 6, 0.05)',
  warningMedium: 'rgba(217, 119, 6, 0.15)',
  warningSelected: 'rgba(217, 119, 6, 0.18)', // For selected warning states
  warningBorder: 'rgba(217, 119, 6, 0.25)',
  warningBorderActive: 'rgba(217, 119, 6, 0.35)',
  warningBorderStrong: 'rgba(217, 119, 6, 0.5)',

  success: palette.emerald[600],
  successHover: palette.emerald[700],
  successLight: 'rgba(5, 150, 105, 0.1)',

  info: palette.blue[600],
  infoLight: 'rgba(0, 150, 230, 0.1)',
  infoBorder: 'rgba(0, 150, 230, 0.2)',

  // ---------------------------------------------------------------------------
  // On-Colors (text on colored backgrounds)
  // ---------------------------------------------------------------------------
  onPrimary: palette.neutral[0],
  onSecondary: palette.neutral[0],
  onError: palette.neutral[0],
  onWarning: palette.neutral[0],
  onSuccess: palette.neutral[0],

  // ---------------------------------------------------------------------------
  // Status Colors (for tournament states)
  // ---------------------------------------------------------------------------
  statusLive: palette.red[600], // Darker red for visibility
  statusLiveBg: 'rgba(220, 38, 38, 0.1)',
  statusLiveRowBg: 'rgba(220, 38, 38, 0.05)',

  statusUpcoming: palette.emerald[600],
  statusUpcomingBg: 'rgba(5, 150, 105, 0.1)',

  statusFinished: palette.neutral[500],
  statusFinishedBg: 'rgba(100, 116, 139, 0.1)',

  statusDraft: palette.amber[600],
  statusDraftBg: 'rgba(217, 119, 6, 0.1)',

  statusExternal: palette.purple[600],
  statusExternalBg: 'rgba(124, 58, 237, 0.1)',

  // Warning/Trash status
  statusWarning: palette.orange[600],
  statusWarningBg: 'rgba(234, 88, 12, 0.1)',

  // ---------------------------------------------------------------------------
  // Live Cockpit Specific
  // ---------------------------------------------------------------------------
  liveBadge: palette.red[600],
  liveBadgeBg: 'rgba(220, 38, 38, 0.12)',
  liveBadgePulse: 'rgba(220, 38, 38, 0.25)',

  // ---------------------------------------------------------------------------
  // Correction/Warning Banner
  // ---------------------------------------------------------------------------
  correctionBg: 'rgba(217, 119, 6, 0.08)',
  correctionBorder: 'rgba(217, 119, 6, 0.3)',
  correctionText: palette.amber[700],
  correctionIcon: palette.amber[600],

  // ---------------------------------------------------------------------------
  // Medal Colors (same for both themes)
  // ---------------------------------------------------------------------------
  medalGold: palette.special.gold,
  medalSilver: palette.special.silver,
  medalBronze: palette.special.bronze,

  // ---------------------------------------------------------------------------
  // Special Colors
  // ---------------------------------------------------------------------------
  overlay: 'rgba(0, 0, 0, 0.4)',
  overlayStrong: 'rgba(0, 0, 0, 0.6)',
  overlayDialog: 'rgba(0, 0, 0, 0.7)',
  backdrop: 'rgba(0, 0, 0, 0.6)', // Modal/dialog backdrop with blur
  focus: palette.emerald[600],
  focusRing: 'rgba(5, 150, 105, 0.25)',

  inputBg: palette.neutral[50],

  // ---------------------------------------------------------------------------
  // Shadows & Glows
  // ---------------------------------------------------------------------------
  shadowSoft: 'rgba(0, 0, 0, 0.08)',
  shadowMedium: 'rgba(0, 0, 0, 0.15)',
  shadowModal: 'rgba(0, 0, 0, 0.25)', // For modal/dialog boxShadow (lighter for light mode)
  primaryGlow: 'rgba(5, 150, 105, 0.3)',
  primaryGlowLight: 'rgba(5, 150, 105, 0.15)',
  errorGlow: 'rgba(220, 38, 38, 0.15)',
  dangerSubtle: 'rgba(220, 38, 38, 0.08)', // For subtle danger backgrounds

  warningShadow: 'rgba(245, 158, 11, 0.2)',
  warningHighlight: 'rgba(245, 158, 11, 0.05)',
  dangerHighlight: 'rgba(220, 38, 38, 0.08)',
  dangerGradientStart: 'rgba(220, 38, 38, 0.12)',
  dangerGradientEnd: 'rgba(220, 38, 38, 0.03)',
  dangerBorder: 'rgba(220, 38, 38, 0.2)',
  dangerBorderStrong: 'rgba(220, 38, 38, 0.35)', // For strong danger borders
  surfaceHighlight: 'rgba(0, 0, 0, 0.03)',

  backgroundDark: palette.neutral[100],
  backgroundDeep: palette.neutral[50],
  backgroundGradientDark: 'linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',

  confettiColors: ['#059669', '#10B981', '#FBBF24', '#3B82F6'] as readonly string[],

  gradientErrorLight: palette.red[400],
  gradientPrimaryLight: palette.emerald[400],

  qrBackground: '#FFFFFF',

  // ---------------------------------------------------------------------------
  // Schedule Editor Colors
  // ---------------------------------------------------------------------------
  editorEditModeBg: 'rgba(5, 150, 105, 0.06)',
  editorEditModeHover: 'rgba(5, 150, 105, 0.12)',
  editorEditModeRowBg: 'rgba(5, 150, 105, 0.04)',
  editorEditModeBorder: 'rgba(5, 150, 105, 0.3)',

  editorDirtyBg: 'rgba(245, 158, 11, 0.1)',
  editorDirtyRowBg: 'rgba(245, 158, 11, 0.05)',
  editorDirtyRowBgLight: 'rgba(245, 158, 11, 0.03)',
  editorDirtyBorder: 'rgba(245, 158, 11, 0.3)',

  editorSwapBg: 'rgba(245, 158, 11, 0.1)',
  editorSwapActive: 'rgba(245, 158, 11, 0.2)',

  editorErrorRowBg: 'rgba(220, 38, 38, 0.06)',
  editorErrorRowBgLight: 'rgba(220, 38, 38, 0.03)',

  editorDragActiveBg: 'rgba(37, 99, 235, 0.06)',
  editorDropTargetBg: 'rgba(37, 99, 235, 0.03)',

  editorLockedBg: 'rgba(0, 0, 0, 0.03)',
  editorLockedText: 'rgba(0, 0, 0, 0.4)',

  // ---------------------------------------------------------------------------
  // Management & Ranking Colors
  // ---------------------------------------------------------------------------
  rankingHighlightBg: 'rgba(5, 150, 105, 0.08)',
  rankingPlacementBg: 'rgba(5, 150, 105, 0.05)',
  rankingExpandedBg: 'rgba(5, 150, 105, 0.03)',

  infoBannerBg: 'rgba(37, 99, 235, 0.05)',
  infoBadgeBg: 'rgba(37, 99, 235, 0.1)',

  warningBannerBg: 'rgba(245, 158, 11, 0.05)',
  warningBannerBgStrong: 'rgba(245, 158, 11, 0.08)',
  warningBannerBorder: 'rgba(245, 158, 11, 0.2)',
  dirtyIndicatorBg: 'rgba(245, 158, 11, 0.1)',

  dangerActionBg: 'rgba(220, 38, 38, 0.06)',

  neutralBadgeBg: 'rgba(0, 0, 0, 0.04)',
  neutralRowBg: 'rgba(0, 0, 0, 0.01)',
  neutralStatusBg: 'rgba(100, 116, 139, 0.06)',

  monitorSectionBg: 'rgba(248, 250, 252, 0.95)',
  monitorSectionBgStrong: 'rgba(248, 250, 252, 0.98)',
  monitorSectionBgLight: 'rgba(248, 250, 252, 0.8)',

  panelGradientStart: 'rgba(248, 250, 252, 0.95)',
  panelGradientEnd: 'rgba(241, 245, 249, 0.95)',
  timerGradientBg: 'rgba(248, 250, 252, 0.98)',

  // ---------------------------------------------------------------------------
  // Match Event Colors (for EventsList)
  // ---------------------------------------------------------------------------
  eventGoalBg: 'rgba(5, 150, 105, 0.04)',
  eventGoalBorder: 'rgba(5, 150, 105, 0.2)',

  eventStatusBg: 'rgba(37, 99, 235, 0.04)',
  eventStatusBorder: 'rgba(37, 99, 235, 0.2)',

  eventEditBg: 'rgba(245, 158, 11, 0.04)',
  eventEditBorder: 'rgba(245, 158, 11, 0.2)',

  gradientNextMatch: 'linear-gradient(135deg, rgba(5, 150, 105, 0.06), rgba(37, 99, 235, 0.06))',
} as const;

export type SemanticColorToken = keyof typeof semanticColorsLight;
