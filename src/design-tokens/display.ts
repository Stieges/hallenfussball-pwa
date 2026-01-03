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
} as const;

export type DisplayTokens = typeof displayTokens;
export default displayTokens;
