/**
 * Monitor Types - Monitor-Konfigurator
 *
 * MON-KONF-01: Ermöglicht die Konfiguration beliebig vieler Display-Setups
 * mit individuellen Diashows aus verschiedenen Slide-Typen.
 *
 * @see MONITOR-KONFIGURATOR-KONZEPT-v2.md Kapitel 3
 */

// =============================================================================
// PERFORMANCE TYPES
// =============================================================================

/**
 * Performance Mode für Monitor-Displays
 *
 * - 'auto': Erkennt automatisch (prefers-reduced-motion, Smart-TV User-Agent)
 * - 'high': Alle Transitions und Animationen aktiv
 * - 'low': Energiesparmodus für ältere Smart-TVs (keine Animationen)
 */
export type PerformanceMode = 'auto' | 'high' | 'low';

/**
 * Performance Settings - Wird aus PerformanceMode abgeleitet
 */
export interface PerformanceSettings {
  enableTransitions: boolean;
  enableAnimations: boolean;
  enableGlow: boolean;
  enableBackgroundEffects: boolean;
  pollingInterval: number;       // Milliseconds
}

/**
 * Vordefinierte Performance-Profile
 */
export const PERFORMANCE_PROFILES: Record<Exclude<PerformanceMode, 'auto'>, PerformanceSettings> = {
  high: {
    enableTransitions: true,
    enableAnimations: true,
    enableGlow: true,
    enableBackgroundEffects: true,
    pollingInterval: 5000,        // 5 Sekunden
  },
  low: {
    enableTransitions: false,     // Harte Schnitte
    enableAnimations: false,      // Keine Animationen
    enableGlow: false,            // Kein Glow-Effekt
    enableBackgroundEffects: false,
    pollingInterval: 10000,       // 10 Sekunden (weniger CPU)
  },
};

// =============================================================================
// TRANSITION TYPES
// =============================================================================

/**
 * Übergangstyp zwischen Slides
 */
export type TransitionType = 'fade' | 'slide' | 'none';

// =============================================================================
// SLIDE TYPES
// =============================================================================

/**
 * Slide-Typen für Monitor-Diashows
 *
 * Phase 1: live, standings, schedule-field, sponsor, custom-text
 * Phase 2: all-standings, schedule-group, next-matches, top-scorers
 */
export type SlideType =
  | 'live'               // Live-Spiel eines Feldes
  | 'standings'          // Tabelle einer Gruppe
  | 'all-standings'      // Alle Gruppentabellen (Phase 2)
  | 'schedule-group'     // Spielplan einer Gruppe (Phase 2)
  | 'schedule-field'     // Spielplan eines Feldes
  | 'next-matches'       // Nächste X Spiele (Phase 2)
  | 'top-scorers'        // Torschützenliste (Phase 2)
  | 'sponsor'            // Sponsor mit QR-Code
  | 'custom-text'        // Eigener Text / Ankündigung
  | 'qr-code';           // Zuschauer-QR-Folie (interner Rückfall, @OB-011)

/**
 * Slide-Type Metadaten für UI
 */
export interface SlideTypeMetadata {
  type: SlideType;
  label: string;
  icon: string;
  category: 'live' | 'standings' | 'schedule' | 'other';
  phase: 1 | 2;
  description: string;
}

/**
 * Alle verfügbaren Slide-Typen mit Metadaten
 */
export const SLIDE_TYPES: SlideTypeMetadata[] = [
  // Phase 1
  { type: 'live', label: 'Live-Spiel', icon: '🔴', category: 'live', phase: 1, description: 'Aktuelles Spiel auf einem Feld' },
  { type: 'standings', label: 'Tabelle', icon: '📊', category: 'standings', phase: 1, description: 'Tabelle einer Gruppe' },
  { type: 'schedule-field', label: 'Spielplan (Feld)', icon: '📋', category: 'schedule', phase: 1, description: 'Spielplan eines Feldes' },
  { type: 'sponsor', label: 'Sponsor', icon: '📢', category: 'other', phase: 1, description: 'Sponsor mit Logo und QR-Code' },
  { type: 'custom-text', label: 'Eigener Text', icon: '📝', category: 'other', phase: 1, description: 'Individuelle Ankündigung' },

  // Phase 2
  { type: 'all-standings', label: 'Alle Tabellen', icon: '📊📊', category: 'standings', phase: 2, description: 'Alle Gruppentabellen' },
  { type: 'schedule-group', label: 'Spielplan (Gruppe)', icon: '📋', category: 'schedule', phase: 2, description: 'Spielplan einer Gruppe' },
  { type: 'next-matches', label: 'Nächste Spiele', icon: '⏭️', category: 'schedule', phase: 2, description: 'Kommende Spiele' },
  { type: 'top-scorers', label: 'Torschützen', icon: '⚽', category: 'standings', phase: 2, description: 'Torschützenliste' },
];

// =============================================================================
// WHEN IDLE CONFIGURATION (Phase 2)
// =============================================================================

/**
 * Was angezeigt werden soll, wenn kein Live-Spiel läuft
 */
export type WhenIdleType =
  | 'next-match'      // Nächstes Spiel auf diesem Feld + Countdown
  | 'last-result'     // Letztes Ergebnis + Statistik
  | 'top-scorers'     // Top-Torschützen
  | 'sponsor'         // Sponsor-Screen
  | 'skip';           // Direkt zum nächsten Slide

/**
 * When Idle Konfiguration für Live-Slides
 */
export interface WhenIdleConfig {
  type: WhenIdleType;
  timeoutSeconds?: number;  // Nach X Sek. zum nächsten Slide (optional)
}

// =============================================================================
// QR-CODE CONFIGURATION
// =============================================================================

/**
 * QR-Code Ziel-Typ für Sponsor-Slides
 */
export type QrTargetType =
  | 'tournament'       // Public View des Turniers
  | 'sponsor-website'  // Website des Sponsors (aus Sponsor-Objekt)
  | 'custom';          // Frei definierbare URL

// =============================================================================
// COLOR SCHEME (Custom-Text Slides)
// =============================================================================

/**
 * Vordefinierte Farbschemata für Custom-Text Slides
 */
export type ColorScheme = 'default' | 'highlight' | 'urgent' | 'celebration';

/**
 * Farbschema-Definitionen
 */
export const COLOR_SCHEMES: Record<ColorScheme, { background: string; text: string; description: string }> = {
  default: { background: '#1A1A2E', text: '#FFFFFF', description: 'Normale Infos' },
  highlight: { background: '#00E676', text: '#000000', description: 'Wichtige Infos' },
  urgent: { background: '#FF4444', text: '#FFFFFF', description: 'Warnungen' },
  celebration: { background: '#FFD700', text: '#000000', description: 'Sieger, Gratulation' },
};

// =============================================================================
// LIVE COLOR SCHEME (Positions-Farben für Live-Score)
// =============================================================================

/**
 * Preset-Namen für Live-Score Farbschemata
 */
export type LiveColorPreset = 'classic' | 'nature' | 'contrast' | 'modern' | 'alternative' | 'custom';

/**
 * Farbschema für Live-Score-Anzeige auf Monitoren
 *
 * Positions-Farben (Heim/Gast) als Default, optional Team-Farben.
 */
export interface LiveColorScheme {
  preset: LiveColorPreset;
  homeColor: string;
  awayColor: string;
  useTeamColors: boolean;
}

/**
 * Default: Klassisch Blau/Rot
 */
export const DEFAULT_LIVE_COLOR_SCHEME: LiveColorScheme = {
  preset: 'classic',
  homeColor: '#1E40AF',
  awayColor: '#DC2626',
  useTeamColors: false,
};

// =============================================================================
// SLIDE CONFIGURATION
// =============================================================================

/**
 * Slide-Konfiguration - abhängig vom SlideType
 */
export interface SlideConfig {
  // Für: standings, schedule-group
  groupId?: string;

  // Für: live, schedule-field
  // Kann auch Template-Variable sein: '{{field_id}}'
  fieldId?: string;

  // Für: live (Verhalten wenn kein Spiel läuft) - Phase 2
  whenIdle?: WhenIdleConfig;
  pauseRotationDuringMatch?: boolean;  // Default: true

  // Für: next-matches
  matchCount?: number;  // Default: 3, Max: 10

  // Für: top-scorers
  numberOfPlayers?: number;  // Default: 10, Max: 20

  // Für: sponsor
  // WICHTIG: Nur Referenz, keine Inline-Daten!
  sponsorId?: string;
  showQrCode?: boolean;           // Default: true
  qrTarget?: QrTargetType;        // Was der QR-Code öffnet
  customQrUrl?: string;           // Nur wenn qrTarget === 'custom'

  // Für: custom-text
  headline?: string;
  body?: string;
  textAlign?: 'left' | 'center' | 'right';
  colorScheme?: ColorScheme;

  // Für: live (Positions-Farben)
  liveColorScheme?: LiveColorScheme;
}

/**
 * Default Slide-Konfiguration
 */
export const DEFAULT_SLIDE_CONFIG: Partial<SlideConfig> = {
  whenIdle: {
    type: 'next-match',
    timeoutSeconds: 60,
  },
  pauseRotationDuringMatch: true,
  matchCount: 3,
  showQrCode: true,
  qrTarget: 'tournament',
  textAlign: 'center',
  colorScheme: 'default',
};

// =============================================================================
// MONITOR SLIDE
// =============================================================================

/**
 * Einzelner Slide in einer Monitor-Diashow
 */
export interface MonitorSlide {
  id: string;
  type: SlideType;
  config: SlideConfig;
  duration: number | null;  // null = Monitor-Default verwenden
  order: number;
}

// =============================================================================
// MONITOR CONFIGURATION
// =============================================================================

/**
 * Theme für Monitor-Display
 */
export type MonitorTheme = 'light' | 'dark' | 'auto';

/**
 * Monitor-Konfiguration - eine Display-Einrichtung
 */
export interface TournamentMonitor {
  id: string;
  name: string;                           // "Haupthalle Eingang"

  // Timing
  defaultSlideDuration: number;           // Sekunden (Default: 15)
  transition: TransitionType;
  transitionDuration: number;             // Millisekunden (Default: 500)

  // Darstellung
  theme: MonitorTheme;                    // 'light' | 'dark' | 'auto'

  // Template-System (Phase 2)
  templateId?: string;                    // Referenz zu MonitorTemplate
  templateVariables?: Record<string, string>;  // z.B. { field_id: 'field-1' }

  // Stabilität (Phase 1)
  performanceMode: PerformanceMode;       // 'auto' | 'high' | 'low'

  // TV-Kalibrierung
  overscanPx?: number;                    // 0-80, Default: 48

  // Slides
  slides: MonitorSlide[];

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * Default Monitor-Konfiguration
 */
export const DEFAULT_MONITOR: Omit<TournamentMonitor, 'id' | 'name' | 'createdAt' | 'updatedAt'> = {
  defaultSlideDuration: 15,
  transition: 'fade',
  transitionDuration: 500,
  theme: 'dark',
  performanceMode: 'auto',
  overscanPx: 48,
  slides: [],
};

// =============================================================================
// MONITOR TEMPLATE (Phase 2)
// =============================================================================

/**
 * Template-Variable für Monitor-Vorlagen
 */
export interface TemplateVariable {
  name: string;           // 'field_id'
  type: 'field' | 'group' | 'sponsor' | 'text';
  label: string;          // 'Spielfeld auswählen'
  required: boolean;
}

/**
 * Monitor-Vorlage für schnelles Setup
 */
export interface MonitorTemplate {
  id: string;
  name: string;                           // "Spielfeld-Monitor"
  description?: string;

  // Welche Variablen werden benötigt?
  variables: TemplateVariable[];

  // Slide-Definitionen mit Variablen
  slides: MonitorSlide[];                 // fieldId kann '{{field_id}}' sein

  // Default-Einstellungen
  defaultSlideDuration: number;
  transition: TransitionType;
  transitionDuration: number;
  performanceMode: PerformanceMode;

  // System vs. Custom
  isSystemTemplate: boolean;              // Vordefinierte Templates

  // Metadata
  createdAt: string;
  updatedAt: string;
}

/**
 * System-Templates (vordefiniert)
 */
export const SYSTEM_TEMPLATES: Omit<MonitorTemplate, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'system-field-monitor',
    name: 'Spielfeld-Monitor',
    description: 'Zeigt Live-Score, Spielplan und Sponsor für ein Feld',
    isSystemTemplate: true,
    variables: [
      { name: 'field_id', type: 'field', label: 'Spielfeld', required: true },
      { name: 'sponsor_id', type: 'sponsor', label: 'Sponsor', required: false },
    ],
    slides: [
      { id: 'tpl-1', type: 'live', config: { fieldId: '{{field_id}}' }, duration: null, order: 0 },
      { id: 'tpl-2', type: 'schedule-field', config: { fieldId: '{{field_id}}' }, duration: null, order: 1 },
      { id: 'tpl-3', type: 'sponsor', config: { sponsorId: '{{sponsor_id}}' }, duration: null, order: 2 },
    ],
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    performanceMode: 'auto',
  },
  {
    id: 'system-overview-monitor',
    name: 'Übersichts-Monitor',
    description: 'Alle Tabellen und nächste Spiele',
    isSystemTemplate: true,
    variables: [],
    slides: [
      { id: 'tpl-4', type: 'all-standings', config: {}, duration: null, order: 0 },
      { id: 'tpl-5', type: 'next-matches', config: { matchCount: 5 }, duration: null, order: 1 },
      { id: 'tpl-6', type: 'top-scorers', config: {}, duration: null, order: 2 },
    ],
    defaultSlideDuration: 15,
    transition: 'fade',
    transitionDuration: 500,
    performanceMode: 'auto',
  },
  {
    id: 'system-sponsor-rotation',
    name: 'Sponsor-Rotation',
    description: 'Alle Sponsoren im Wechsel anzeigen',
    isSystemTemplate: true,
    variables: [],
    slides: [], // Wird dynamisch aus allen Sponsoren generiert
    defaultSlideDuration: 10,
    transition: 'fade',
    transitionDuration: 500,
    performanceMode: 'auto',
  },
];

// =============================================================================
// CACHE STATUS (Phase 1 - Admin-Only)
// =============================================================================

/**
 * Cache-Status für Admin-Indikator
 *
 * Zeigt dem Admin auf dem Display:
 * - fresh (grün): 0-10 Sekunden
 * - stale (gelb): 10-30 Sekunden
 * - critical (rot): 30+ Sekunden
 */
export type CacheStatusLevel = 'fresh' | 'stale' | 'critical';

/**
 * Cache-Status Interface
 */
export interface CacheStatus {
  lastFetchTimestamp: number;      // Unix timestamp in ms
  lastSuccessfulFetch: number;     // Letzter erfolgreicher Fetch
  ageSeconds: number;              // Berechnet: wie alt sind die Daten?
  status: CacheStatusLevel;        // Berechnet: fresh | stale | critical
  connectionStatus: 'online' | 'offline' | 'degraded';
}

/**
 * Cache-Status Schwellenwerte (in Sekunden)
 */
export const CACHE_STATUS_THRESHOLDS = {
  fresh: 10,    // 0-10s = grün
  stale: 30,    // 10-30s = gelb
  // >30s = rot (critical)
} as const;

/**
 * Berechnet den Cache-Status aus dem letzten Fetch-Zeitstempel
 */
export function calculateCacheStatus(lastFetchTimestamp: number): CacheStatus {
  const now = Date.now();
  const ageSeconds = Math.floor((now - lastFetchTimestamp) / 1000);

  let status: CacheStatusLevel;
  if (ageSeconds < CACHE_STATUS_THRESHOLDS.fresh) {
    status = 'fresh';
  } else if (ageSeconds < CACHE_STATUS_THRESHOLDS.stale) {
    status = 'stale';
  } else {
    status = 'critical';
  }

  return {
    lastFetchTimestamp,
    lastSuccessfulFetch: lastFetchTimestamp,
    ageSeconds,
    status,
    connectionStatus: navigator.onLine ? 'online' : 'offline',
  };
}

// =============================================================================
// BROADCAST TYPES (Phase 4)
// =============================================================================

/**
 * Broadcast-Typ für Emergency/Announcement
 */
export type BroadcastType = 'emergency' | 'announcement' | 'celebration';

/**
 * Broadcast-Priorität
 */
export type BroadcastPriority = 'normal' | 'high' | 'urgent';

/**
 * Broadcast-Farbschema
 */
export type BroadcastColorScheme = 'info' | 'warning' | 'urgent' | 'celebration';

/**
 * Broadcast-Style
 */
export interface BroadcastStyle {
  colorScheme: BroadcastColorScheme;
  icon?: string;                   // Emoji oder Icon-Name
  fullscreen: boolean;             // Überschreibt komplett oder Overlay
}

/**
 * Tournament Broadcast - Durchsage an alle Monitore
 */
export interface TournamentBroadcast {
  id: string;
  type: BroadcastType;
  message: string;
  subMessage?: string;
  priority: BroadcastPriority;
  displayUntil: string;            // ISO Date
  style: BroadcastStyle;
  createdAt: string;
  createdBy?: string;              // User ID (Phase 3+)
}
