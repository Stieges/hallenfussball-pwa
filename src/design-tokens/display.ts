/**
 * Display Design Tokens - TV-optimierte Darstellung
 *
 * MON-KONF-01: Tokens für Monitor-Konfigurator Display-Ansicht
 *
 * Diese Tokens sind für große Displays (TVs, Beamer) optimiert:
 * - Große Schriftgrößen für Lesbarkeit aus der Distanz
 * - Hoher Kontrast für helle Sporthallen
 * - Overscan-Padding für ältere TVs
 *
 * @see MONITOR-KONFIGURATOR-UMSETZUNGSPLAN-v2.md P0-04
 */

// =============================================================================
// DISPLAY FONT SIZES
// =============================================================================

/**
 * TV-optimierte Schriftgrößen (in px, nicht rem - TVs haben keine User-Preferences)
 */
export const displayFontSizes = {
  // Score Display (sehr groß, Hauptfokus)
  scoreXXL: 'clamp(200px, 25vw, 350px)', // Stadium-Grade Score (Score-Blöcke)
  scoreXL: '120px',      // Hauptscore bei Live-Spielen
  scoreLG: '96px',       // Score in Zusammenfassungen
  scoreMD: '72px',       // Score in Listen

  // Timer Display
  timerXL: '64px',       // Haupttimer
  timerLG: '48px',       // Sekundär-Timer

  // Headings
  headingXL: '56px',     // Slide-Titel
  headingLG: '42px',     // Abschnitts-Titel
  headingMD: '32px',     // Unter-Titel

  // Body Text
  bodyXL: '28px',        // Team-Namen, wichtige Infos
  bodyLG: '24px',        // Standard-Text
  bodyMD: '20px',        // Sekundär-Text
  bodySM: '16px',        // Kleine Infos, Labels

  // Team Names (Stadium-Grade)
  teamName: 'clamp(48px, 5vw, 72px)',   // Team-Name unter Score-Block

  // Meta/Badge
  meta: '14px',          // Gruppe, Feld-Label
  badge: '12px',         // Status-Badges
} as const;

export type DisplayFontSizeKey = keyof typeof displayFontSizes;

// =============================================================================
// DISPLAY COLORS
// =============================================================================

/**
 * Display-spezifische Farben (hoher Kontrast für Sporthallen)
 */
export const displayColors = {
  // Backgrounds
  background: '#0A0A14',           // Sehr dunkler Hintergrund
  backgroundAlt: '#12121F',        // Alternative Hintergrund
  surface: '#1A1A2E',              // Card/Surface
  surfaceAlt: '#252540',           // Alternative Surface

  // Text
  textPrimary: '#FFFFFF',          // Primärer Text
  textSecondary: '#A0A0B0',        // Sekundärer Text
  textMuted: '#606070',            // Gedämpfter Text

  // Accent Colors
  primary: '#3B82F6',              // Primärfarbe (Blau)
  primaryGlow: 'rgba(59, 130, 246, 0.3)', // Glow-Effekt
  success: '#22C55E',              // Erfolg/Gewonnen
  warning: '#F59E0B',              // Warnung
  error: '#EF4444',                // Fehler/Verloren
  live: '#EF4444',                 // Live-Indikator

  // Live Match Specific
  liveIndicator: '#FF4444',        // Blinkender Punkt
  liveBadgeBg: 'rgba(239, 68, 68, 0.2)',
  timerBg: 'rgba(0, 0, 0, 0.4)',

  // Team Colors Fallback
  teamHome: '#3B82F6',             // Heimteam Fallback
  teamAway: '#8B5CF6',             // Auswärtsteam Fallback
} as const;

export type DisplayColorKey = keyof typeof displayColors;

// =============================================================================
// DISPLAY SPACING
// =============================================================================

/**
 * Display-Spacing mit Overscan-Berücksichtigung
 * TVs können an den Rändern abschneiden
 */
export const displaySpacing = {
  // Overscan-Safe Area (für alte TVs)
  overscan: '48px',

  // Section Spacing
  sectionXL: '64px',
  sectionLG: '48px',
  sectionMD: '32px',
  sectionSM: '24px',

  // Content Spacing
  contentXL: '32px',
  contentLG: '24px',
  contentMD: '16px',
  contentSM: '12px',

  // Inline Spacing
  inlineXL: '24px',
  inlineLG: '16px',
  inlineMD: '12px',
  inlineSM: '8px',
} as const;

export type DisplaySpacingKey = keyof typeof displaySpacing;

// =============================================================================
// DISPLAY TRANSITIONS
// =============================================================================

/**
 * Slide-Übergänge
 */
export const displayTransitions = {
  // Slide Transitions
  slideChange: {
    duration: '500ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  slideFade: {
    duration: '400ms',
    easing: 'ease-in-out',
  },
  slideSlide: {
    duration: '500ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // UI Transitions
  hover: {
    duration: '200ms',
    easing: 'ease-out',
  },
  expand: {
    duration: '300ms',
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Live Indicator Pulse
  pulse: {
    duration: '2s',
    easing: 'ease-in-out',
  },
} as const;

// =============================================================================
// DISPLAY LAYOUT
// =============================================================================

/**
 * Display-Layout Konfigurationen
 */
export const displayLayout = {
  // Max Content Width
  maxContentWidth: '1600px',

  // Slide Aspect Ratios
  aspectRatio: {
    standard: '16 / 9',
    ultrawide: '21 / 9',
  },

  // Header/Footer Heights
  headerHeight: '80px',
  footerHeight: '60px',

  // Controls (versteckte Steuerungsleiste)
  controlsHeight: '56px',
  controlsTransition: '300ms ease-in-out',

  // Stadium-Grade Score Layout (prozentuale Bildschirmaufteilung)
  scoreArea: {
    header: '8%',
    score: '55%',
    teamNames: '12%',
    timer: '17%',
    footer: '8%',
    blockWidth: '35%',
    blockGap: '10%',
  },
} as const;

// =============================================================================
// DISPLAY EFFECTS
// =============================================================================

/**
 * Display-Effekte (können bei Low-Performance deaktiviert werden)
 */
export const displayEffects = {
  // Glow Effects
  scoreGlow: `0 0 40px ${displayColors.primaryGlow}`,
  liveGlow: `0 0 20px ${displayColors.liveBadgeBg}`,

  // Shadow Effects
  cardShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
  surfaceShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',

  // Gradient Overlays
  fadeToBlack: 'linear-gradient(to bottom, transparent, rgba(0, 0, 0, 0.8))',
  fadeFromBlack: 'linear-gradient(to top, transparent, rgba(0, 0, 0, 0.8))',
} as const;

// =============================================================================
// MONITOR THEME COLOR SCHEMES
// =============================================================================

/**
 * Theme-spezifische Farben für Monitor-Display
 * WCAG AA Kontraste validiert
 */
export const monitorThemes = {
  dark: {
    // Backgrounds
    background: '#0f172a',
    backgroundGradient: 'linear-gradient(180deg, #1e293b 0%, #0f172a 100%)',
    surface: '#1e293b',
    surfaceHover: '#334155',

    // Text (WCAG AAA auf dark: 15:1)
    text: '#ffffff',
    textSecondary: '#94a3b8',
    textMuted: '#64748b',

    // Score (WCAG AA auf dark: 8.5:1)
    score: '#00E676',
    scoreGlow: 'rgba(0, 230, 118, 0.4)',
    scoreShadow: '0 0 60px rgba(0, 230, 118, 0.3)',

    // Timer
    timerNormal: '#e2e8f0',
    timerOvertime: '#ff5252',
    timerWarning: '#ffb300',
    timerPaused: '#fbbf24',

    // Status Badges
    liveBadgeBg: 'rgba(0, 230, 118, 0.2)',
    liveBadgeText: '#00E676',
    liveDot: '#00E676',
    pauseBadgeBg: 'rgba(251, 191, 36, 0.2)',
    pauseBadgeText: '#fbbf24',
    overtimeBadgeBg: 'rgba(255, 82, 82, 0.2)',

    // Progress Bar
    progressBar: '#00E676',
    progressBarWarning: '#ff5252',
    progressTrack: 'rgba(255, 255, 255, 0.15)',
    progressGlow: 'rgba(0, 230, 118, 0.25)',
    progressGlowWarning: 'rgba(255, 145, 0, 0.25)',
    progressShadow: '0 0 15px rgba(0, 230, 118, 0.3)',
    progressShadowWarning: '0 0 15px rgba(255, 145, 0, 0.3)',
    progressInsetShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',

    // Timer specific
    timerSeparator: 'rgba(255, 255, 255, 0.6)',
    timerSecondary: 'rgba(255, 255, 255, 0.5)',

    // Borders & Effects
    border: 'rgba(255, 255, 255, 0.1)',
    borderActive: 'rgba(0, 230, 118, 0.4)',
    glow: '0 0 40px rgba(0, 230, 118, 0.2)',
    glowActive: '0 0 60px rgba(0, 230, 118, 0.4)',

    // Text Shadows
    textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
    textShadowLight: '0 2px 8px rgba(0, 0, 0, 0.4)',
    textShadowScore: '0 2px 10px rgba(0, 0, 0, 0.3)',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.7)',
    overlayLight: 'rgba(0, 0, 0, 0.4)',
    overlayGradient: 'linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 100%)',
    controlsGradient: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.6) 0%, transparent 100%)',

    // Interactive States
    buttonHover: 'rgba(0, 230, 118, 0.3)',
    buttonDefault: 'rgba(0, 230, 118, 0.15)',
    fieldSelected: 'rgba(0, 230, 118, 0.2)',
    fieldDefault: 'rgba(255, 255, 255, 0.05)',
    fieldHover: 'rgba(0, 230, 118, 0.1)',
  },
  light: {
    // Backgrounds
    background: '#f1f5f9',
    backgroundGradient: 'linear-gradient(180deg, #ffffff 0%, #e2e8f0 100%)',
    surface: '#ffffff',
    surfaceHover: '#f8fafc',

    // Text (WCAG AAA auf light: 12:1)
    text: '#1e293b',
    textSecondary: '#64748b',
    textMuted: '#94a3b8',

    // Score (WCAG AA auf light: 5.2:1) - dunkleres Grün
    score: '#047857',
    scoreGlow: 'rgba(4, 120, 87, 0.3)',
    scoreShadow: '0 0 40px rgba(4, 120, 87, 0.2)',

    // Timer
    timerNormal: '#334155',
    timerOvertime: '#dc2626',
    timerWarning: '#d97706',
    timerPaused: '#d97706',

    // Status Badges
    liveBadgeBg: 'rgba(4, 120, 87, 0.15)',
    liveBadgeText: '#047857',
    liveDot: '#047857',
    pauseBadgeBg: 'rgba(217, 119, 6, 0.15)',
    pauseBadgeText: '#d97706',
    overtimeBadgeBg: 'rgba(220, 38, 38, 0.15)',

    // Progress Bar
    progressBar: '#10b981',
    progressBarWarning: '#dc2626',
    progressTrack: 'rgba(0, 0, 0, 0.1)',
    progressGlow: 'rgba(16, 185, 129, 0.2)',
    progressGlowWarning: 'rgba(217, 119, 6, 0.2)',
    progressShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
    progressShadowWarning: '0 0 12px rgba(217, 119, 6, 0.25)',
    progressInsetShadow: 'inset 0 2px 4px rgba(0, 0, 0, 0.15)',

    // Timer specific
    timerSeparator: 'rgba(0, 0, 0, 0.5)',
    timerSecondary: 'rgba(0, 0, 0, 0.4)',

    // Borders & Effects
    border: 'rgba(0, 0, 0, 0.1)',
    borderActive: 'rgba(4, 120, 87, 0.4)',
    glow: '0 0 30px rgba(4, 120, 87, 0.15)',
    glowActive: '0 0 50px rgba(4, 120, 87, 0.25)',

    // Text Shadows
    textShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
    textShadowLight: '0 1px 3px rgba(0, 0, 0, 0.1)',
    textShadowScore: '0 1px 5px rgba(0, 0, 0, 0.1)',

    // Overlays
    overlay: 'rgba(0, 0, 0, 0.6)',
    overlayLight: 'rgba(0, 0, 0, 0.3)',
    overlayGradient: 'linear-gradient(to top, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.5) 100%)',
    controlsGradient: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.4) 0%, transparent 100%)',

    // Interactive States
    buttonHover: 'rgba(4, 120, 87, 0.25)',
    buttonDefault: 'rgba(4, 120, 87, 0.1)',
    fieldSelected: 'rgba(4, 120, 87, 0.15)',
    fieldDefault: 'rgba(0, 0, 0, 0.03)',
    fieldHover: 'rgba(4, 120, 87, 0.08)',
  },
} as const;

export type MonitorThemeKey = keyof typeof monitorThemes;
export type MonitorThemeColors = typeof monitorThemes[MonitorThemeKey];

// =============================================================================
// COLOR SCHEMES (für Custom-Text Slides)
// =============================================================================

/**
 * Vordefinierte Farbschemata für Custom-Text Slides
 */
export const displayColorSchemes = {
  default: {
    background: displayColors.background,
    text: displayColors.textPrimary,
    accent: displayColors.primary,
  },
  highlight: {
    background: '#00E676',
    text: '#000000',
    accent: '#00C853',
  },
  urgent: {
    background: '#FF4444',
    text: '#FFFFFF',
    accent: '#FF0000',
  },
  celebration: {
    background: '#FFD700',
    text: '#000000',
    accent: '#FFA000',
  },
} as const;

export type DisplayColorSchemeKey = keyof typeof displayColorSchemes;

// =============================================================================
// MONITOR COLOR SCHEMES (Positions-Farben für Live-Score)
// =============================================================================

/**
 * Farb-Presets für Heim/Gast Positions-Farben auf Monitor-Scoreboards.
 *
 * Diese Farben werden als Hintergrund der Score-Blöcke verwendet.
 * Text-Farbe wird automatisch per Luminance berechnet.
 */
export const monitorColorSchemes = {
  presets: {
    classic:     { home: '#1E40AF', away: '#DC2626' },
    nature:      { home: '#059669', away: '#EA580C' },
    contrast:    { home: '#171717', away: '#FAFAFA' },
    modern:      { home: '#7C3AED', away: '#EAB308' },
    alternative: { home: '#F97316', away: '#0891B2' },
  },
  defaults: { home: '#1E40AF', away: '#DC2626' },
} as const;

export type MonitorColorPresetKey = keyof typeof monitorColorSchemes.presets;

/**
 * Calculate relative luminance of a hex color (sRGB).
 * Returns a value between 0 (black) and 1 (white).
 */
function calculateLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Auto text color for score numbers on colored backgrounds.
 * Returns white text on dark backgrounds, dark text on light backgrounds.
 */
export function getScoreTextColor(backgroundHex: string): string {
  return calculateLuminance(backgroundHex) > 0.4 ? '#171717' : '#FFFFFF';
}

// =============================================================================
// CRITICAL PHASE (Last Minute Modus)
// =============================================================================

/**
 * Farben für die Last-Minute-Eskalation im Timer.
 *
 * Stufen: warning (< 5 min) → danger (< 2 min) → critical (< 60s)
 *       → final (< 30s, pulsierender Rahmen) → countdown (< 10s, Millisekunden)
 */
export const criticalPhaseColors = {
  warning: '#F97316',      // Orange (< 5 min)
  danger: '#EF4444',       // Rot (< 2 min)
  critical: '#FDE047',     // Signal-Gelb (< 60s)
  criticalText: '#171717', // Schwarz auf Signal-Gelb
  pulseGlow: 'rgba(253, 224, 71, 0.6)',  // Gelber Glow für Rahmen-Pulse
} as const;

/**
 * Schwellenwerte in Sekunden für Eskalationsstufen.
 */
export const criticalPhaseThresholds = {
  warning: 300,   // 5 min — Progress-Bar orange
  danger: 120,    // 2 min — Timer-Text orange
  critical: 60,   // 1 min — Signal-Gelb Hintergrund
  final: 30,      // 30s  — Pulsierender Rahmen
  countdown: 10,  // 10s  — Millisekunden-Anzeige
} as const;

export type CriticalPhase = 'normal' | 'warning' | 'danger' | 'critical' | 'final' | 'countdown';

/**
 * Determine the current escalation phase based on remaining seconds.
 */
export function getCriticalPhase(remainingSeconds: number, isOvertime: boolean): CriticalPhase {
  if (isOvertime || remainingSeconds <= 0) {
    return 'normal';
  }
  if (remainingSeconds <= criticalPhaseThresholds.countdown) {
    return 'countdown';
  }
  if (remainingSeconds <= criticalPhaseThresholds.final) {
    return 'final';
  }
  if (remainingSeconds <= criticalPhaseThresholds.critical) {
    return 'critical';
  }
  if (remainingSeconds <= criticalPhaseThresholds.danger) {
    return 'danger';
  }
  if (remainingSeconds <= criticalPhaseThresholds.warning) {
    return 'warning';
  }
  return 'normal';
}

// =============================================================================
// COMBINED EXPORT
// =============================================================================

/**
 * Alle Display-Tokens als einzelnes Objekt
 */
export const displayTokens = {
  fontSizes: displayFontSizes,
  colors: displayColors,
  spacing: displaySpacing,
  transitions: displayTransitions,
  layout: displayLayout,
  effects: displayEffects,
  colorSchemes: displayColorSchemes,
  themes: monitorThemes,
  monitorColorSchemes,
  criticalPhaseColors,
  criticalPhaseThresholds,
} as const;

export type DisplayTokens = typeof displayTokens;
export default displayTokens;
