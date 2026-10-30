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
  // @ZM-125: Uhr deutlich größer als die Teamnamen (mindestens 1,5 ×)
  // B-44a3 (B2): Live-Folie ohne feste Pixel-Deckel, alles wächst mit der Bildhöhe (Auflösung egal, Anteil gleich)
  // B-44a4 (@ME-020): Größen der Live-Folie in Container-Einheiten der Folienfläche (innerhalb des Bildrands);
  // außerhalb eines Containers rechnet der Browser cqh wie die Bildhöhe (svh)
  clockXL: '11cqh',
  // Fixrunde 3 (Mockup K5g, Entscheidung Daniel 18.10.): Siegerzeile nach dem Strafstoßschießen
  monitorWinner: '4.3cqh',
  teamName: '6.2cqh',   // Team-Name unter Score-Block
  // B-44a2 (@ZM-137, @ZM-125): Hinweistexte unter der Uhr, mindestens 3 % der Bildhöhe (lesbar aus 10 m)
  // B-44a4: an der Folienfläche, aber nie unter 3 % der Bildschirmhöhe (@ZM-125 gilt an der Bildschirmhöhe)
  clockHint: 'max(3.2cqh, 3vh)',
  // B-44a2: Namen im Kindermodus stehen in der Kastenreihe und sind größer (kein Stand)
  teamNameKids: '11cqh',
  // B-44a3 (B2): Kopfzeile (Feld/Spiel, Gruppe), Statusmarke und Doppelpunkt, je mindestens 3 % der Bildhöhe
  liveInfo: 'max(3.4cqh, 3vh)',
  liveBadge: 'max(3.2cqh, 3vh)',
  liveSeparator: '14cqh',

  // B-48a: Hinweis oben rechts, nie unter 3 % der Bildhöhe (@ZM-125, HART)
  notice: '3vh',
  noticeIcon: '3vh',

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

/** Maße der Hinweis-Ecke (B-48a); die Höhe daraus ist ein Token, damit die Folie genau so weit nach unten rückt. */
const NOTICE_PAD_Y = '0.4cqh';
const NOTICE_BORDER = '0.3cqh';
const NOTICE_LINE_HEIGHT = 1.2;

/**
 * Display-Layout Konfigurationen
 */
export const displayLayout = {
  // Max Content Width
  maxContentWidth: '1600px',


  // Hinweis als Ecke oben rechts im sicheren Bereich (B-48a, @ME-006): eine Zeile, feste Höhe.
  // Die Folie rückt um genau diese Höhe nach unten, solange der Hinweis steht (er verdeckt nichts).
  noticeHeight: `calc(${displayFontSizes.notice} * ${NOTICE_LINE_HEIGHT} + 2 * (${NOTICE_PAD_Y} + ${NOTICE_BORDER}))`,

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
    header: '6%',
    // B-44a2: Abstand zwischen Kopfzeile (LIVE, Feld, Gruppe) und Kästen
    headerGap: '1.5cqh',
    // B-44a2: Marke gleich breit für LIVE, PAUSE, BEENDET
    badgeWidth: '11em',
    // B-44a2: Kindermodus: Namen oben bündig in der Kastenreihe, mit Abstand von oben
    kidsNamesOffset: '8cqh',
    // H3 @ZM-125: Kasten = 70 % einer Spalte; zwei Spalten teilen die Breite abzüglich seitlichem Polster (paddingX) = ca. 33 % Bildbreite
    blockWidth: '70%',
    blockGap: '0%',
    // B-17 Fixrunde: Teamnamen bekommen eine breitere Box, damit 50 Zeichen auf zwei Zeilen passen (@ZM-087)
    // B-44a2: Namensspalte = Kastenbreite; B-44a4 (Ruling 16.10.): wieder breiter als der Kasten, damit 50 Zeichen bei
    // 800×600 und 1024×768 voll und zweizeilig über 3 % der Bildschirmhöhe stehen (@ZM-087, @ZM-125)
    teamNameWidth: '92%',
    teamNamesGap: '1cqh',
    // @ZM-140 Raster: Mittelspalte zwischen den Kästen (Trenner, im Kindermodus leer)
    separatorWidth: '0%',
    // B-44a2 (@ZM-125): Kasten hoch, annähernd quadratisch (Breite 33 % der Bildbreite); der Stand ist das Größte
    blockHeight: '42cqh',
    // B-44a2: Namen bis zu zwei Zeilen
    nameLines: 2,
    // B-44a2: Platz unter den Namen für Uhr, Balken und Hinweise; bleibt in jedem Zustand reserviert (gleiche Lage)
    // B-44a3: fasst Uhr, Balken, Hinweiszeile und Schiedsrichter-Zeile
    lowerHeight: '30cqh',
    // B-44a2: Abstand zwischen Namen und Uhr (liegt innerhalb von lowerHeight)
    lowerPaddingTop: '2cqh',
    // B-44a2: Abstand zwischen Uhr und Hinweisen sowie zwischen Hinweisen
    hintGap: '1cqh',
    hintGapAbove: '1.6cqh',
    // B-44a2: senkrechter Innenabstand der Folie (Höhe ist knapp, vorher clamp(24px, 3vw, 48px) auch senkrecht)
    paddingY: '1.5cqh',
    // B-44a3: seitliches Polster der Folie
    paddingX: '3cqw',
    // B-48a (@ME-006): Hinweis-Ecke oben rechts auf dem Feld ohne laufendes Spiel (Mockup v8)
    noticePadY: NOTICE_PAD_Y,
    noticePadX: '0.8cqh',
    noticeBorderWidth: NOTICE_BORDER,
    noticeRadius: '1cqh',
    noticeLineHeight: NOTICE_LINE_HEIGHT,
    noticeGap: '0.6cqh',
    // B-44a3: Uhr und unterer Bereich (vorher Literale in MatchTimer)
    // R5 PR 2 (@ZM-165, Plan F5 „gilt nach Vorschlag“): Zeitbalken etwa 3 % der Bildhöhe (vorher 1,2cqh, C-MONITOR-ZEITBALKEN-DUENN)
    progressHeight: '3cqh',
    clockGap: '1.2cqh',
    // R5 PR 2: Zeichenabstand der Uhr-Ziffern (vorher Literal in MatchTimer)
    clockLetterSpacing: '0.02em',
    clockPadY: '0.8cqh',
    clockPadX: '2cqh',
    clockInnerGap: '1cqh',
    clockLineHeight: 1,
    hintLineHeight: 1.2,
    hintColumnGap: '3cqh',
    // B-44a3: Statusmarke (vorher feste Pixel)
    badgePadY: '0.8cqh',
    badgePadX: '2cqh',
    badgeGap: '1cqh',
    badgeDot: '1.4cqh',
    // Kompakte Kopfzeile (Größe nicht xl): Punkt der Statusmarke
    badgeDotCompact: '14px',
    // B-44a2: Balkenbreite (vorher 700px fest)
    progressWidth: '36cqw',
    // B-44a2: Rahmen der Kästen, einheitlich in beiden: dezent, bei Kontrast unter 3 : 1 kräftig
    frameWidthSubtle: '2px',
    frameWidthStrong: '4px',
    frameSubtleMix: '45%',
    // Fixrunde 3 (Mockup K5g): Pokal-Kreis am Sieger-Kasten
    monitorCup: '8.4cqh',
    // Fixrunde 4: Verlierer-Kasten nur mit dezentem Schleier (Anteil der Hintergrundfarbe), Teamfarbe bleibt erkennbar
    loserDimShare: '30%',
    // Spielanzeige 2.2 (Spec § 8, Mockup --vest: 14 %): Breite je Streifen der Weste als Anteil der Kastenbreite
    vestStripeShare: 0.14,
  },
} as const;

/**
 * B-44a3: Anzeige ohne laufendes Spiel (NoMatchDisplay), vorher feste Werte im Bauteil.
 * xl für den Monitor, lg für die Vorschau im Turnier-Management.
 */
export const displayNoMatch = {
  xl: { icon: '10vh', title: '5vh', text: '2.6vh', padding: '6vh' },
  lg: { icon: '72px', title: '28px', text: '18px', padding: '32px' },
  minHeightXl: '50vh',
  minHeightLg: '35vh',
  maxWidth: '1200px',
  borderWidth: '3px',
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
// DISPLAY MONITOR (B-16d2: Literale der Monitor-Folien als Tokens)
// =============================================================================

/**
 * Feste Werte der Monitor-Folien. Die Werte entsprechen den früheren Literalen (keine Sichtänderung),
 * benannt nach Verwendung. Theme-abhängige Farben bleiben in monitorThemes.
 */
export const displayMonitor = {
  /** Abdunkelung hinter Hinweisen (Pause-Badge, Cache-Anzeige); bewusst theme-unabhängig */
  overlay: 'rgba(0, 0, 0, 0.7)',

  /** QR-Codes: SVG-Attributwerte (QRCodeSVG löst keine CSS-Variablen auf) */
  qr: {
    foreground: '#000000',
    background: '#ffffff',
    sizeLarge: 220,
    sizeSmall: 150,
  },

  /** Text */
  text: {
    /** Zeilenabstand ungeteilter Fließtexte (unitlos, wie bisher 1.5) */
    lineHeight: 1.5,
  },

  /** Bildrand in % je Seite (@ME-067): links/rechts von der Breite, oben/unten von der Höhe der Folie; `?rand=` gilt je Sitzung */
  overscan: { defaultPercent: 5, minPercent: 0, maxPercent: 10, stepPercent: 0.5, urlParam: 'rand' },

  /** Ecken */
  radius: {
    card: '12px',
  },

  /** Punkte und Markierungen */
  marker: {
    /** Positions-Punkt unten und Cache-Status-Punkt */
    indicatorSize: '10px',
    /** Rahmen einer laufenden Spielzeile */
    liveBorderWidth: '2px',
  },

  /** Maße einzelner Folien */
  size: {
    sponsorLogoMaxWidth: '400px',
    sponsorLogoMaxHeight: '300px',
    textMaxWidth: '800px',
  },
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
    // B-48a (@ME-006): Warnsymbol des Wachhalten-Hinweises, Kontrast mindestens 3 : 1 zum Thema
    warningSymbol: '#ffb300',

    // Status Badges
    liveBadgeBg: 'rgba(0, 230, 118, 0.2)',
    liveBadgeText: '#00E676', // Endfarbe des Fortschrittsbalkens (MatchTimer): bleibt grün, Live-Rot gehört nur dem Abzeichen
    // Aufgabe 1.1: Live-Rot des Abzeichens (Rose 400, Schrift dunkel) – eigene Tokens, damit der Balken unverändert bleibt
    liveBadgeFill: '#FB7185',
    liveBadgeOn: '#000000', // Schwarz: 7,8 : 1 auf Rose 400 (die Messung verlangt am Monitor ≥ 7 : 1, kontrast.monitor)
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
    // B-48a (@ME-006): Warnsymbol des Wachhalten-Hinweises, Kontrast mindestens 3 : 1 zum Thema (Freigabe Daniel)
    warningSymbol: '#B45309',

    // Status Badges
    liveBadgeBg: 'rgba(4, 120, 87, 0.15)',
    liveBadgeText: '#047857', // Endfarbe des Fortschrittsbalkens (MatchTimer): bleibt grün
    // Aufgabe 1.1: Live-Rot des Abzeichens (Rose 700, Schrift weiß)
    liveBadgeFill: '#BE123C',
    liveBadgeOn: '#FFFFFF',
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
  // @ZM-140: die Ziffernfarbe mit dem höheren Kontrast (mindestens 4,5 : 1 bei Schwarz oder Weiß)
  return getContrastRatio(backgroundHex, '#171717') >= getContrastRatio(backgroundHex, '#FFFFFF')
    ? '#171717'
    : '#FFFFFF';
}

/** Kontrastverhältnis nach WCAG (1 bis 21) zweier Hex-Farben. */
export function getContrastRatio(colorHex: string, otherHex: string): number {
  const a = calculateLuminance(colorHex);
  const b = calculateLuminance(otherHex);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

/**
 * @ZM-140: Der Kasten braucht einen hellen Rahmen, wenn er sich mit weniger als 3 : 1 vom Hintergrund abhebt.
 */
export function needsContrastFrame(blockHex: string, backgroundHex: string): boolean {
  return getContrastRatio(blockHex, backgroundHex) < 3;
}

// =============================================================================
// CRITICAL PHASE (Last Minute Modus)
// =============================================================================

/**
 * Hervorhebung der Uhr in der angehaltenen Schlussphase (@ZM-137).
 * Keine Teamfarbe, keine Eskalation (keine Stufen, kein Pulsieren, keine Hundertstel).
 */
export const criticalPhaseColors = {
  critical: '#FDE047',     // Signal-Gelb: Hervorhebung der Uhr
  criticalText: '#171717', // Schwarz auf Signal-Gelb
} as const;

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
  monitor: displayMonitor,
  colorSchemes: displayColorSchemes,
  themes: monitorThemes,
  criticalPhaseColors,
} as const;

export type DisplayTokens = typeof displayTokens;
export default displayTokens;
