/**
 * CSS Variable Wrapper for Theme Support
 *
 * USAGE:
 * import { cssVars } from '@/design-tokens';
 * style={{ background: cssVars.colors.background }}
 *
 * DO NOT USE (legacy - no theme support):
 * import { colors } from '@/design-tokens';
 * style={{ background: colors.background }}
 *
 * These values reference CSS Custom Properties defined in global.css,
 * which are updated automatically when the theme changes.
 * This enables theme-switching without React re-renders.
 */

// =============================================================================
// Colors
// =============================================================================

export const cssColors = {
  // ---------------------------------------------------------------------------
  // Brand Colors - Primary
  // ---------------------------------------------------------------------------
  primary: 'var(--color-primary)',
  primaryDark: 'var(--color-primary-dark)',
  primaryHover: 'var(--color-primary-hover)',
  primaryActive: 'var(--color-primary-active)',
  primaryLight: 'var(--color-primary-light)',
  primaryMedium: 'var(--color-primary-medium)',
  primarySubtle: 'var(--color-primary-subtle)',
  primarySelected: 'var(--color-primary-selected)',
  primaryBorder: 'var(--color-primary-border)',
  primaryBorderActive: 'var(--color-primary-border-active)',
  primaryBorderStrong: 'var(--color-primary-border-strong)',
  primaryGlow: 'var(--color-primary-glow)',
  primaryGlowLight: 'var(--color-primary-glow-light)',

  // ---------------------------------------------------------------------------
  // Brand Colors - Secondary
  // ---------------------------------------------------------------------------
  secondary: 'var(--color-secondary)',
  secondaryHover: 'var(--color-secondary-hover)',
  secondarySubtle: 'var(--color-secondary-subtle)',
  secondaryLight: 'var(--color-secondary-light)',
  secondaryMedium: 'var(--color-secondary-medium)',
  secondarySelected: 'var(--color-secondary-selected)',
  secondaryBadge: 'var(--color-secondary-badge)',
  secondaryBorder: 'var(--color-secondary-border)',
  secondaryBorderActive: 'var(--color-secondary-border-active)',
  secondaryBorderStrong: 'var(--color-secondary-border-strong)',

  // ---------------------------------------------------------------------------
  // Brand Colors - Accent
  // ---------------------------------------------------------------------------
  accent: 'var(--color-accent)',
  accentLight: 'var(--color-accent-light)',
  accentMedium: 'var(--color-accent-medium)',
  accentSubtle: 'var(--color-accent-subtle)',
  accentBadge: 'var(--color-accent-badge)',
  accentBadgeSolid: 'var(--color-accent-badge-solid)',
  accentBorder: 'var(--color-accent-border)',
  accentBorderActive: 'var(--color-accent-border-active)',

  // ---------------------------------------------------------------------------
  // Background Colors
  // ---------------------------------------------------------------------------
  background: 'var(--color-background)',
  backgroundDark: 'var(--color-background-dark)',
  backgroundDeep: 'var(--color-background-deep)',
  surfaceSubtle: 'var(--color-surface-subtle)',
  surface: 'var(--color-surface)',
  surfaceLight: 'var(--color-surface-light)',
  surfaceSolid: 'var(--color-surface-solid)',
  surfaceHover: 'var(--color-surface-hover)',
  surfaceDark: 'var(--color-surface-dark)',
  surfaceDarkLight: 'var(--color-surface-dark-light)',
  surfaceDarkSubtle: 'var(--color-surface-dark-subtle)',
  surfaceDarkMedium: 'var(--color-surface-dark-medium)',
  surfaceVariant: 'var(--color-surface-variant)',
  surfaceElevated: 'var(--color-surface-elevated)',
  surfaceHighlight: 'var(--color-surface-highlight)',

  // ---------------------------------------------------------------------------
  // Text Colors
  // ---------------------------------------------------------------------------
  textPrimary: 'var(--color-text-primary)',
  textSecondary: 'var(--color-text-secondary)',
  textMuted: 'var(--color-text-muted)',
  textPlaceholder: 'var(--color-text-placeholder)',
  textDisabled: 'var(--color-text-disabled)',
  textTertiary: 'var(--color-text-tertiary)',
  textOnDark: 'var(--color-text-on-dark)',

  // ---------------------------------------------------------------------------
  // On-Colors (text on colored backgrounds)
  // ---------------------------------------------------------------------------
  onPrimary: 'var(--color-on-primary)',
  onSecondary: 'var(--color-on-secondary)',
  onError: 'var(--color-on-error)',
  onWarning: 'var(--color-on-warning)',
  onSuccess: 'var(--color-on-success)',

  // ---------------------------------------------------------------------------
  // Border Colors
  // ---------------------------------------------------------------------------
  border: 'var(--color-border)',
  borderLight: 'var(--color-border-light)',
  borderMedium: 'var(--color-border-medium)',
  borderActive: 'var(--color-border-active)',
  borderSolid: 'var(--color-border-solid)',
  borderSubtle: 'var(--color-border-subtle)',
  borderDefault: 'var(--color-border-default)',
  borderStrong: 'var(--color-border-strong)',

  // ---------------------------------------------------------------------------
  // Semantic: Error
  // ---------------------------------------------------------------------------
  error: 'var(--color-error)',
  errorHover: 'var(--color-error-hover)',
  errorSubtle: 'var(--color-error-subtle)',
  errorLight: 'var(--color-error-light)',
  errorMedium: 'var(--color-error-medium)',
  errorBorder: 'var(--color-error-border)',
  errorGlow: 'var(--color-error-glow)',

  // ---------------------------------------------------------------------------
  // Semantic: Warning
  // ---------------------------------------------------------------------------
  warning: 'var(--color-warning)',
  warningHover: 'var(--color-warning-hover)',
  warningSubtle: 'var(--color-warning-subtle)',
  warningLight: 'var(--color-warning-light)',
  warningMedium: 'var(--color-warning-medium)',
  warningSelected: 'var(--color-warning-selected)',
  warningBorder: 'var(--color-warning-border)',
  warningBorderActive: 'var(--color-warning-border-active)',
  warningBorderStrong: 'var(--color-warning-border-strong)',
  warningShadow: 'var(--color-warning-shadow)',
  warningHighlight: 'var(--color-warning-highlight)',

  // ---------------------------------------------------------------------------
  // Semantic: Success
  // ---------------------------------------------------------------------------
  success: 'var(--color-success)',
  successHover: 'var(--color-success-hover)',
  successLight: 'var(--color-success-light)',

  // ---------------------------------------------------------------------------
  // Semantic: Info
  // ---------------------------------------------------------------------------
  info: 'var(--color-info)',
  infoLight: 'var(--color-info-light)',
  infoBorder: 'var(--color-info-border)',

  // ---------------------------------------------------------------------------
  // Status Colors (for tournament states)
  // ---------------------------------------------------------------------------
  statusLive: 'var(--color-status-live)',
  statusLiveBg: 'var(--color-status-live-bg)',
  statusLiveRowBg: 'var(--color-status-live-row-bg)',

  statusUpcoming: 'var(--color-status-upcoming)',
  statusUpcomingBg: 'var(--color-status-upcoming-bg)',

  statusFinished: 'var(--color-status-finished)',
  statusFinishedBg: 'var(--color-status-finished-bg)',

  statusDraft: 'var(--color-status-draft)',
  statusDraftBg: 'var(--color-status-draft-bg)',

  statusExternal: 'var(--color-status-external)',
  statusExternalBg: 'var(--color-status-external-bg)',

  statusWarning: 'var(--color-status-warning)',
  statusWarningBg: 'var(--color-status-warning-bg)',

  // ---------------------------------------------------------------------------
  // Live Cockpit Specific
  // ---------------------------------------------------------------------------
  liveBadge: 'var(--color-live-badge)',
  liveBadgeBg: 'var(--color-live-badge-bg)',
  liveBadgePulse: 'var(--color-live-badge-pulse)',

  // ---------------------------------------------------------------------------
  // Correction/Warning Banner
  // ---------------------------------------------------------------------------
  correctionBg: 'var(--color-correction-bg)',
  correctionBorder: 'var(--color-correction-border)',
  correctionText: 'var(--color-correction-text)',
  correctionIcon: 'var(--color-correction-icon)',

  // ---------------------------------------------------------------------------
  // Medal Colors (for rankings)
  // ---------------------------------------------------------------------------
  medalGold: 'var(--color-medal-gold)',
  medalSilver: 'var(--color-medal-silver)',
  medalBronze: 'var(--color-medal-bronze)',

  // ---------------------------------------------------------------------------
  // Special Colors
  // ---------------------------------------------------------------------------
  overlay: 'var(--color-overlay)',
  overlayStrong: 'var(--color-overlay-strong)',
  overlayDialog: 'var(--color-overlay-dialog)',
  focus: 'var(--color-focus)',
  focusRing: 'var(--color-focus-ring)',
  inputBg: 'var(--color-input-bg)',
  qrBackground: 'var(--color-qr-background)',

  // ---------------------------------------------------------------------------
  // Shadows & Glows
  // ---------------------------------------------------------------------------
  shadowSoft: 'var(--color-shadow-soft)',
  shadowMedium: 'var(--color-shadow-medium)',

  // ---------------------------------------------------------------------------
  // Danger Colors
  // ---------------------------------------------------------------------------
  dangerSubtle: 'var(--color-danger-subtle)',
  dangerHighlight: 'var(--color-danger-highlight)',
  dangerGradientStart: 'var(--color-danger-gradient-start)',
  dangerGradientEnd: 'var(--color-danger-gradient-end)',
  dangerBorder: 'var(--color-danger-border)',
  dangerBorderStrong: 'var(--color-danger-border-strong)',
  dangerActionBg: 'var(--color-danger-action-bg)',

  // ---------------------------------------------------------------------------
  // Gradient Helpers
  // ---------------------------------------------------------------------------
  gradientErrorLight: 'var(--color-gradient-error-light)',
  gradientPrimaryLight: 'var(--color-gradient-primary-light)',
  gradientNextMatch: 'var(--gradient-next-match)',
  backgroundGradientDark: 'var(--gradient-background-dark)',

  // ---------------------------------------------------------------------------
  // Special (non-CSS-variable fallbacks for complex types)
  // ---------------------------------------------------------------------------
  // Note: confettiColors is an array and cannot be a CSS variable.
  // Use the original `colors.confettiColors` for this property.

  // ---------------------------------------------------------------------------
  // Schedule Editor Colors
  // ---------------------------------------------------------------------------
  editorEditModeBg: 'var(--color-editor-edit-mode-bg)',
  editorEditModeHover: 'var(--color-editor-edit-mode-hover)',
  editorEditModeRowBg: 'var(--color-editor-edit-mode-row-bg)',
  editorEditModeBorder: 'var(--color-editor-edit-mode-border)',

  editorDirtyBg: 'var(--color-editor-dirty-bg)',
  editorDirtyRowBg: 'var(--color-editor-dirty-row-bg)',
  editorDirtyRowBgLight: 'var(--color-editor-dirty-row-bg-light)',
  editorDirtyBorder: 'var(--color-editor-dirty-border)',

  editorSwapBg: 'var(--color-editor-swap-bg)',
  editorSwapActive: 'var(--color-editor-swap-active)',

  editorErrorRowBg: 'var(--color-editor-error-row-bg)',
  editorErrorRowBgLight: 'var(--color-editor-error-row-bg-light)',

  editorDragActiveBg: 'var(--color-editor-drag-active-bg)',
  editorDropTargetBg: 'var(--color-editor-drop-target-bg)',

  editorLockedBg: 'var(--color-editor-locked-bg)',
  editorLockedText: 'var(--color-editor-locked-text)',

  // ---------------------------------------------------------------------------
  // Management & Ranking Colors
  // ---------------------------------------------------------------------------
  rankingHighlightBg: 'var(--color-ranking-highlight-bg)',
  rankingPlacementBg: 'var(--color-ranking-placement-bg)',
  rankingExpandedBg: 'var(--color-ranking-expanded-bg)',

  infoBannerBg: 'var(--color-info-banner-bg)',
  infoBadgeBg: 'var(--color-info-badge-bg)',

  warningBannerBg: 'var(--color-warning-banner-bg)',
  warningBannerBgStrong: 'var(--color-warning-banner-bg-strong)',
  warningBannerBorder: 'var(--color-warning-banner-border)',
  dirtyIndicatorBg: 'var(--color-dirty-indicator-bg)',

  neutralBadgeBg: 'var(--color-neutral-badge-bg)',
  neutralRowBg: 'var(--color-neutral-row-bg)',
  neutralStatusBg: 'var(--color-neutral-status-bg)',

  monitorSectionBg: 'var(--color-monitor-section-bg)',
  monitorSectionBgStrong: 'var(--color-monitor-section-bg-strong)',
  monitorSectionBgLight: 'var(--color-monitor-section-bg-light)',

  panelGradientStart: 'var(--color-panel-gradient-start)',
  panelGradientEnd: 'var(--color-panel-gradient-end)',
  timerGradientBg: 'var(--color-timer-gradient-bg)',

  // ---------------------------------------------------------------------------
  // Match Event Colors (for EventsList)
  // ---------------------------------------------------------------------------
  eventGoalBg: 'var(--color-event-goal-bg)',
  eventGoalBorder: 'var(--color-event-goal-border)',

  eventStatusBg: 'var(--color-event-status-bg)',
  eventStatusBorder: 'var(--color-event-status-border)',

  eventEditBg: 'var(--color-event-edit-bg)',
  eventEditBorder: 'var(--color-event-edit-border)',
} as const;

// =============================================================================
// Gradients
// =============================================================================

export const cssGradients = {
  primary: 'var(--gradient-primary)',
  primarySecondary: 'var(--gradient-primary-secondary)',
  subtle: 'var(--gradient-subtle)',
  subtleHover: 'var(--gradient-subtle-hover)',
  nextMatch: 'var(--gradient-next-match)',
  backgroundDark: 'var(--gradient-background-dark)',
  card: 'var(--gradient-card)',
  surface: 'var(--gradient-surface)',
} as const;

// =============================================================================
// Spacing
// =============================================================================

export const cssSpacing = {
  xs: 'var(--spacing-xs)',
  sm: 'var(--spacing-sm)',
  md: 'var(--spacing-md)',
  lg: 'var(--spacing-lg)',
  xl: 'var(--spacing-xl)',
  xxl: 'var(--spacing-xxl)',
} as const;

// =============================================================================
// Border Radius
// =============================================================================

export const cssBorderRadius = {
  sm: 'var(--border-radius-sm)',
  md: 'var(--border-radius-md)',
  lg: 'var(--border-radius-lg)',
  xl: 'var(--border-radius-xl)',
  full: 'var(--border-radius-full)',
} as const;

// =============================================================================
// Shadows
// =============================================================================

export const cssShadows = {
  sm: 'var(--shadow-sm)',
  md: 'var(--shadow-md)',
  lg: 'var(--shadow-lg)',
  xl: 'var(--shadow-xl)',
} as const;

// =============================================================================
// Typography - Font Families
// =============================================================================

export const cssFontFamilies = {
  display: 'var(--font-display)',
  heading: 'var(--font-heading)',
  body: 'var(--font-body)',
  mono: 'var(--font-mono)',
} as const;

// =============================================================================
// Typography - Font Sizes
// =============================================================================

export const cssFontSizes = {
  // Display (px - FIXED, used with Bebas Neue)
  displayLg: 'var(--font-size-display-lg)',
  displayMd: 'var(--font-size-display-md)',
  displaySm: 'var(--font-size-display-sm)',

  // Headlines
  headlineLg: 'var(--font-size-headline-lg)',
  headlineMd: 'var(--font-size-headline-md)',
  headlineSm: 'var(--font-size-headline-sm)',

  // Titles
  titleLg: 'var(--font-size-title-lg)',
  titleMd: 'var(--font-size-title-md)',
  titleSm: 'var(--font-size-title-sm)',

  // Body
  bodyLg: 'var(--font-size-body-lg)',
  bodyMd: 'var(--font-size-body-md)',
  bodySm: 'var(--font-size-body-sm)',

  // Labels
  labelLg: 'var(--font-size-label-lg)',
  labelMd: 'var(--font-size-label-md)',
  labelSm: 'var(--font-size-label-sm)',

  // Special
  statLabel: 'var(--font-size-stat-label)',

  // Legacy aliases (rem - SCALABLE via html font-size)
  xs: 'var(--font-size-xs)',
  sm: 'var(--font-size-sm)',
  md: 'var(--font-size-md)',
  lg: 'var(--font-size-lg)',
  xl: 'var(--font-size-xl)',
  xxl: 'var(--font-size-xxl)',
  xxxl: 'var(--font-size-xxxl)',
} as const;

// =============================================================================
// Score Sizes (px - FIXED, do NOT scale)
// Used for match scores in live cockpit, scoreboards, monitors
// =============================================================================

export const cssScoreSizes = {
  sm: 'var(--font-size-score-sm)',
  md: 'var(--font-size-score-md)',
  lg: 'var(--font-size-score-lg)',
  xl: 'var(--font-size-score-xl)',
} as const;

// =============================================================================
// Timer Size (px - FIXED)
// =============================================================================

export const cssTimerSize = 'var(--font-size-timer)';

// =============================================================================
// Typography - Line Heights
// =============================================================================

export const cssLineHeights = {
  displayLg: 'var(--line-height-display-lg)',
  displayMd: 'var(--line-height-display-md)',
  displaySm: 'var(--line-height-display-sm)',
  headlineLg: 'var(--line-height-headline-lg)',
  headlineMd: 'var(--line-height-headline-md)',
  headlineSm: 'var(--line-height-headline-sm)',
  title: 'var(--line-height-title)',
  bodyLg: 'var(--line-height-body-lg)',
  bodyMd: 'var(--line-height-body-md)',
  bodySm: 'var(--line-height-body-sm)',
  label: 'var(--line-height-label)',
} as const;

// =============================================================================
// Typography - Font Weights
// =============================================================================

export const cssFontWeights = {
  normal: 'var(--font-weight-normal)',
  medium: 'var(--font-weight-medium)',
  semibold: 'var(--font-weight-semibold)',
  bold: 'var(--font-weight-bold)',
} as const;

// =============================================================================
// Touch Targets
// =============================================================================

export const cssTouchTargets = {
  minimum: 'var(--touch-target-minimum)',
  comfortable: 'var(--touch-target-comfortable)',
  primary: 'var(--touch-target-primary)',
} as const;

// =============================================================================
// Icon Sizes
// =============================================================================

export const cssIconSizes = {
  xs: 'var(--icon-size-xs)',
  sm: 'var(--icon-size-sm)',
  md: 'var(--icon-size-md)',
  lg: 'var(--icon-size-lg)',
  xl: 'var(--icon-size-xl)',
} as const;

// =============================================================================
// Input/Button Heights
// =============================================================================

export const cssInputHeights = {
  sm: 'var(--input-height-sm)',
  md: 'var(--input-height-md)',
  lg: 'var(--input-height-lg)',
} as const;

// =============================================================================
// Layout Heights
// =============================================================================

export const cssLayoutHeights = {
  bottomNav: 'var(--layout-height-bottom-nav)',
  bottomActionBar: 'var(--layout-height-bottom-action-bar)',
  header: 'var(--layout-height-header)',
} as const;

// =============================================================================
// Theme Variables (Corporate Colors)
// =============================================================================

export const cssTheme = {
  primary: 'var(--theme-primary)',
  primaryHover: 'var(--theme-primary-hover)',
  primaryActive: 'var(--theme-primary-active)',
  primaryLight: 'var(--theme-primary-light)',
  onPrimary: 'var(--theme-on-primary)',

  secondary: 'var(--theme-secondary)',
  secondaryHover: 'var(--theme-secondary-hover)',
  secondaryLight: 'var(--theme-secondary-light)',
  onSecondary: 'var(--theme-on-secondary)',

  gradient: 'var(--theme-gradient)',
} as const;

// =============================================================================
// Combined Export (recommended for most use cases)
// =============================================================================

export const cssVars = {
  colors: cssColors,
  gradients: cssGradients,
  spacing: cssSpacing,
  borderRadius: cssBorderRadius,
  shadows: cssShadows,
  fontFamilies: cssFontFamilies,
  fontSizes: cssFontSizes,
  // Fixed-size tokens (px - do NOT scale with font-size preference)
  scoreSizes: cssScoreSizes,
  timerSize: cssTimerSize,
  lineHeights: cssLineHeights,
  fontWeights: cssFontWeights,
  touchTargets: cssTouchTargets,
  iconSizes: cssIconSizes,
  inputHeights: cssInputHeights,
  layoutHeights: cssLayoutHeights,
  theme: cssTheme,
} as const;

// =============================================================================
// Type Exports for Autocomplete
// =============================================================================

export type CssVarColors = keyof typeof cssColors;
export type CssVarGradients = keyof typeof cssGradients;
export type CssVarSpacing = keyof typeof cssSpacing;
export type CssVarBorderRadius = keyof typeof cssBorderRadius;
export type CssVarShadows = keyof typeof cssShadows;
export type CssVarFontFamilies = keyof typeof cssFontFamilies;
export type CssVarFontSizes = keyof typeof cssFontSizes;
export type CssVarLineHeights = keyof typeof cssLineHeights;
export type CssVarFontWeights = keyof typeof cssFontWeights;
export type CssVarTouchTargets = keyof typeof cssTouchTargets;
export type CssVarIconSizes = keyof typeof cssIconSizes;
export type CssVarInputHeights = keyof typeof cssInputHeights;
export type CssVarTheme = keyof typeof cssTheme;
