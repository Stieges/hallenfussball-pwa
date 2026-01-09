import { SportId } from '../config/sports/types';

// Core Tournament Types
export type Sport = 'football' | 'other';
export type TournamentType = 'classic' | 'bambini';
export type TournamentMode = 'classic' | 'miniFussball';
export type GroupSystem = 'roundRobin' | 'groupsAndFinals';
export type RoundLogic = 'fixed' | 'promotion';
export type ResultMode = 'goals' | 'winLossOnly';
export type TournamentStatus = 'draft' | 'published';

/**
 * Dashboard-Status für erweiterte Kategorisierung
 * Unterscheidet zwischen verschiedenen Turnier-Zuständen für Dashboard-Tabs
 */
export type DashboardTournamentStatus = 'draft' | 'upcoming' | 'running' | 'finished' | 'cancelled';

/**
 * Turnier-System-Typ für Filterung und Anzeige
 */
export type TournamentSystemType = 'groups' | 'knockout' | 'groups_knockout' | 'league';

/**
 * Stats-Snapshot für archivierte Turniere (Performance-Optimierung)
 * Wird beim Abschließen eines Turniers erstellt
 */
export interface TournamentStatsSnapshot {
  teamCount: number;
  totalMatches: number;
  completedMatches: number;
  winnerName?: string;
  winnerTeamId?: string;
  secondPlaceName?: string;
  thirdPlaceName?: string;
  totalGoals?: number;
  createdAt: string;
}

/** Retention period for soft-deleted tournaments in days */
export const TRASH_RETENTION_DAYS = 30;

// ============================================================================
// TEAM-MANAGEMENT TYPES (US Team-Logo & Trikotfarben)
// ============================================================================

/**
 * Team Logo configuration
 * Supports URL, Base64, or auto-generated initials
 */
export interface TeamLogo {
  type: 'url' | 'base64' | 'initials';
  value: string;                  // URL, Base64-String, or initials
  backgroundColor?: string;       // Background color for initials fallback
  uploadedAt?: string;            // ISO timestamp
  uploadedBy?: 'organizer' | 'trainer';
}

/**
 * Team jersey/kit colors
 */
export interface TeamColors {
  primary: string;                // Main jersey color (Hex)
  secondary?: string;             // Secondary color (Hex)
}

/**
 * Team trainer/coach information
 */
export interface TeamTrainer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  inviteStatus: 'pending' | 'sent' | 'accepted';
  inviteToken?: string;           // Reference to Invitation
  inviteSentAt?: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  group?: string;
  isRemoved?: boolean;  // TOUR-EDIT-TEAMS: Team wurde entfernt (aber hat noch historische Ergebnisse)
  removedAt?: string;   // ISO timestamp wann das Team entfernt wurde

  // Team-Management: Visual Identity
  logo?: TeamLogo;
  colors?: TeamColors;

  // Team-Management: Trainers
  trainers?: TeamTrainer[];
}

/**
 * US-GROUPS-AND-FIELDS: Strukturierte Gruppenkonfiguration
 * Ermöglicht benutzerdefinierte Gruppennamen und Feld-Zuordnungen
 */
export interface TournamentGroup {
  id: string;                    // 'A', 'B', 'C' (von generateGroupLabels)
  customName?: string;           // z.B. "Löwen" statt "Gruppe A"
  shortCode?: string;            // z.B. "LÖ" (max 3 Zeichen, für kompakte Anzeigen)
  allowedFieldIds?: string[];    // z.B. ['field-1', 'field-2'] - welche Felder diese Gruppe nutzen darf
}

/**
 * US-GROUPS-AND-FIELDS: Strukturierte Feldkonfiguration
 * Ermöglicht benutzerdefinierte Feldnamen
 */
export interface TournamentField {
  id: string;              // 'field-1', 'field-2', etc.
  defaultName: string;     // "Feld 1" (unveränderlich, als Fallback)
  customName?: string;     // z.B. "Halle Nord"
  shortCode?: string;      // z.B. "HN" (max 3 Zeichen)
}

/**
 * Structured location data for tournaments
 * Prepared for international scaling and backend migration
 */
export interface LocationDetails {
  name: string;           // "Sporthalle Waging"
  street?: string;        // "Mozartstraße 9"
  postalCode?: string;    // "83329"
  city?: string;          // "Waging am See"
  country?: string;       // "Deutschland" (für internationale Skalierung)
  coordinates?: {         // Für spätere Maps-Integration
    latitude: number;
    longitude: number;
  };
}

export interface PlacementCriterion {
  id: string;
  label: string;
  enabled: boolean;
}

export interface PointSystem {
  win: number;
  draw: number;
  loss: number;
}

/**
 * Finals Preset Types
 * Defines the structure of the playoff/finals phase
 */
export type FinalsPreset =
  | 'none'           // Keine Finalrunde (nur Gruppenphase)
  | 'final-only'     // Nur Finale (direkt, ohne Halbfinale)
  | 'top-4'          // Halbfinale + Finale + Platz 3
  | 'top-8'          // Viertelfinale + alles darüber + Platzierungen 5-8
  | 'top-16'         // Achtelfinale + Viertelfinale + Halbfinale + Finale (8+ Gruppen)
  | 'all-places';    // Alle Plätze ausspielen

/**
 * Tiebreaker Mode for Finals
 * How to resolve draws in knockout/finals matches
 */
export type TiebreakerMode =
  | 'shootout'              // Direkt Strafstoßschießen
  | 'overtime-then-shootout' // Verlängerung, dann Strafstoßschießen
  | 'goldenGoal';           // Golden Goal (erstes Tor in Verlängerung gewinnt)

/**
 * Finals Configuration
 * Replaces the old Finals boolean structure with preset-based system
 */
export interface FinalsConfig {
  preset: FinalsPreset;
  parallelSemifinals?: boolean;      // Halbfinale gleichzeitig?
  parallelQuarterfinals?: boolean;   // Viertelfinale gleichzeitig?
  parallelRoundOf16?: boolean;       // Achtelfinale gleichzeitig?
  tiebreaker?: TiebreakerMode;       // Entscheidung bei Unentschieden
  tiebreakerDuration?: number;       // Dauer in Minuten (für Verlängerung/Golden Goal)
}

/**
 * Referee System Types
 */
export type RefereeMode = 'none' | 'organizer' | 'teams';

export type FinalsRefereeMode =
  | 'none'                    // Keine Schiedsrichter in Finalphase
  | 'neutralTeams'            // Nur ausgeschiedene/neutrale Teams
  | 'nonParticipatingTeams';  // Nur nicht-beteiligte Teams des jeweiligen Spiels

export interface RefereeConfig {
  mode: RefereeMode;

  // Veranstalter-Modus
  numberOfReferees?: number;          // Anzahl Schiedsrichter (z.B. 3 → SR1, SR2, SR3)
  maxConsecutiveMatches?: number;     // Max. zusammenhängende Partien (z.B. 1 = keine aufeinanderfolgenden Spiele)
  refereeNames?: Record<number, string>; // Zuordnung: 1 → "Max Mustermann", 2 → "Anna Schmidt"

  // Finalphase (beide Modi)
  finalsRefereeMode?: FinalsRefereeMode;

  // Manuelle Zuweisungen (überschreibt automatische Verteilung)
  manualAssignments?: Record<string, number>; // matchId → refereeNumber
}

/**
 * @deprecated Legacy Finals structure - will be migrated to FinalsConfig
 * Kept for backwards compatibility
 */
export interface Finals {
  final: boolean;
  thirdPlace: boolean;
  fifthSixth: boolean;
  seventhEighth: boolean;
}

/**
 * @deprecated Legacy Playoff Config - replaced by FinalsConfig
 */
export type PlayoffParallelMode = 'sequentialOnly' | 'parallelAllowed';

export interface PlayoffMatchConfig {
  id: string;
  label: string;
  parallelMode: PlayoffParallelMode;
  enabled: boolean;
}

export interface PlayoffConfig {
  enabled: boolean;
  allowParallelMatches: boolean;
  matches: PlayoffMatchConfig[];
}

/**
 * Match Status for TL-RESULT-LOCK-01 (extended for US-SCHEDULE-EDITOR)
 * - scheduled: Match not yet started
 * - waiting: Waiting for previous match to complete (dependency)
 * - running: Match currently in progress
 * - finished: Match completed, results locked
 * - skipped: Match skipped (e.g., team withdrew)
 */
export type MatchStatus = 'scheduled' | 'waiting' | 'running' | 'finished' | 'skipped';

/**
 * How a finals match was decided (for display purposes)
 */
export type MatchDecidedBy = 'regular' | 'overtime' | 'goldenGoal' | 'penalty';

export interface Match {
  id: string;
  round: number;
  field: number;
  slot?: number; // Time slot index for fair scheduling
  teamA: string;
  teamB: string;
  scoreA?: number;
  scoreB?: number;
  group?: string;
  isFinal?: boolean;
  finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
  label?: string; // Label for playoff matches (e.g., '1. Halbfinale', '2. Halbfinale')
  scheduledTime?: Date; // Actual scheduled time
  matchNumber?: number; // Spiel-Nummer (1-basiert)
  phase?: string; // Phase: 'groupStage', 'semifinal', etc.
  referee?: number; // Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.)

  // TL-RESULT-LOCK-01: Match Status & Correction Mode
  matchStatus?: MatchStatus;           // Current match status (default: 'scheduled')
  finishedAt?: string;                 // ISO timestamp when match was finished
  correctionHistory?: CorrectionEntry[]; // History of result corrections

  // Timer persistence for DEF-005 fix
  timerStartTime?: string;       // ISO timestamp when timer was started
  timerPausedAt?: string;        // ISO timestamp when timer was paused (undefined = running)
  timerElapsedSeconds?: number;  // Elapsed seconds before current run/pause

  // Finals tiebreaker results (only for isFinal matches)
  overtimeScoreA?: number;       // Ergebnis nach Verlängerung (Heim)
  overtimeScoreB?: number;       // Ergebnis nach Verlängerung (Gast)
  penaltyScoreA?: number;        // Strafstoß-Ergebnis (Heim, z.B. 4)
  penaltyScoreB?: number;        // Strafstoß-Ergebnis (Gast, z.B. 3)
  decidedBy?: MatchDecidedBy;    // Wie wurde das Spiel entschieden

  // US-SCHEDULE-EDITOR: Skipped match support
  skippedReason?: string;        // Grund für Überspringen (z.B. "Team zurückgezogen")
  skippedAt?: string;            // ISO timestamp when match was skipped

  // DB-PERSISTENCE: Events for detailed match summary (scorers, cards)
  events?: RuntimeMatchEvent[]; // Full event history persisted with the match
}

/**
 * TL-RESULT-LOCK-01: Correction history entry
 */
export type CorrectionReasonType =
  | 'input_error'       // Eingabefehler
  | 'referee_decision'  // Schiedsrichterentscheidung
  | 'protest_accepted'  // Protestentscheidung
  | 'technical_error'   // Technischer Fehler
  | 'other';            // Sonstiges

export interface CorrectionEntry {
  timestamp: string;             // When correction was made
  previousScoreA: number;
  previousScoreB: number;
  newScoreA: number;
  newScoreB: number;
  reasonType?: CorrectionReasonType; // Correction reason type (optional for legacy entries)
  reason?: string;               // Legacy: Old reason field for backward compatibility
  note?: string;                 // Optional additional note
  userName?: string;             // Name of user who made correction (from profile)
}

export interface Tournament {
  id: string;
  status: TournamentStatus; // 'draft' oder 'published'

  // External Import Marker
  isExternal?: boolean;      // true wenn aus JSON/CSV importiert
  externalSource?: string;   // z.B. "JSON Import", "CSV Import"

  // Step 1: Sport & Tournament Type
  sport: Sport;
  sportId?: SportId; // New: Specific sport configuration ID (e.g., 'football-indoor', 'handball')
  tournamentType: TournamentType;

  // Step 2: Mode & System
  mode: TournamentMode;
  numberOfFields: number;
  numberOfTeams: number; // Anzahl teilnehmender Teams (Pflichtfeld)
  groupSystem?: GroupSystem;
  numberOfGroups?: number;

  // DFB Schlüsselzahlen-System
  useDFBKeys?: boolean; // Ob DFB-Schlüsselsystem verwendet werden soll
  dfbKeyPattern?: string; // z.B. "1T06M" für 6 Teams

  // Gruppenphase Zeiten
  groupPhaseGameDuration: number; // Spieldauer in Gruppenphase (in Minuten)
  groupPhaseBreakDuration?: number; // Pause zwischen Spielen in Gruppenphase (in Minuten)

  // Finalrunde Zeiten (nur wenn groupSystem === 'groupsAndFinals')
  finalRoundGameDuration?: number; // Spieldauer in Finalrunde (in Minuten)
  finalRoundBreakDuration?: number; // Pause zwischen Spielen in Finalrunde (in Minuten)
  breakBetweenPhases?: number; // Pause zwischen Gruppenphase und Finalrunde (in Minuten)

  // Spielabschnitte (gelten für beide Phasen)
  gamePeriods?: number; // Anzahl Spielabschnitte (1 = durchgehend, 2 = zwei Halbzeiten, etc.)
  halftimeBreak?: number; // Pause zwischen Spielabschnitten (nur wenn gamePeriods > 1)

  // Legacy fields (deprecated, werden zu groupPhase* migriert)
  gameDuration?: number;
  breakDuration?: number;

  roundLogic?: RoundLogic;
  numberOfRounds?: number;
  placementLogic: PlacementCriterion[];

  // Finals configuration (new preset-based system)
  finalsConfig?: FinalsConfig;

  // Referee configuration
  refereeConfig?: RefereeConfig;

  // Field assignments (manual overrides for automatic field distribution)
  fieldAssignments?: Record<string, number>; // matchId → fieldNumber

  // US-GROUPS-AND-FIELDS: Strukturierte Gruppen- und Feldkonfiguration
  groups?: TournamentGroup[];    // Gruppenkonfiguration mit Namen und Feld-Zuordnung
  fields?: TournamentField[];    // Feldkonfiguration mit benutzerdefinierten Namen

  // MON-KONF-01: Monitor-Konfigurator
  /** Monitor-Konfigurationen für Display-Setups */
  monitors?: import('./monitor').TournamentMonitor[];
  /** Zentral verwaltete Sponsoren (Single Source of Truth) */
  sponsors?: import('./sponsor').Sponsor[];
  /** Monitor-Vorlagen (Phase 2) */
  monitorTemplates?: import('./monitor').MonitorTemplate[];

  // Legacy fields (will be migrated)
  finals: Finals;
  playoffConfig?: PlayoffConfig;
  minRestSlots?: number; // Minimum rest slots between matches for a team (default: 1)

  // Bambini Settings
  isKidsTournament: boolean;
  hideScoresForPublic: boolean;
  hideRankingsForPublic: boolean;
  resultMode: ResultMode;

  // Point System
  pointSystem: PointSystem;

  // Step 3: Metadata
  title: string;
  ageClass: string;
  date: string; // Legacy: Will be replaced by startDate
  timeSlot: string; // Legacy: Will be replaced by startTime
  startDate?: string; // New: YYYY-MM-DD format
  startTime?: string; // New: HH:mm format (24h)
  location: LocationDetails;
  organizer?: string; // Veranstalter-Name (optional)
  contactInfo?: ContactInfo; // Kontaktinformationen (optional)

  // Step 4: Teams
  teams: Team[];

  // Generated data
  matches: Match[];
  createdAt: string;
  updatedAt: string;

  // Wizard navigation state (for draft restoration)
  lastVisitedStep?: number; // Last visited step in tournament creation wizard (1-5)

  // Manual completion override
  manuallyCompleted?: boolean; // Turnier manuell als beendet markiert (z.B. Abbruch)
  completedAt?: string;        // ISO timestamp wann Turnier beendet wurde

  // Dashboard Soft Delete (Papierkorb)
  /** ISO Date when moved to trash. Undefined = not deleted */
  deletedAt?: string;

  // Dashboard Status (derived, für erweiterte Kategorisierung)
  /** Detaillierter Status für Dashboard-Anzeige */
  dashboardStatus?: DashboardTournamentStatus;

  // Turnier-System für Filterung
  /** Art des Turniersystems (groups, knockout, etc.) */
  tournamentSystem?: TournamentSystemType;

  // Stats Snapshot für archivierte Turniere
  /** Gespeicherte Statistiken beim Abschluss für Performance */
  statsSnapshot?: TournamentStatsSnapshot;

  // Abbruch-Grund
  /** Grund für Turnierabbruch (wenn cancelled) */
  cancelledReason?: string;
  /** ISO timestamp wann Turnier abgebrochen wurde */
  cancelledAt?: string;

  // Admin Center
  /** Private Notizen für Turnierleitung (nur im Admin Center sichtbar) */
  adminNotes?: string;

  // Match Cockpit Pro Settings
  /** Zentrale Match Cockpit Einstellungen für alle Spiele */
  matchCockpitSettings?: MatchCockpitSettings;

  // Public View / Sharing (Phase 1)
  /** Ob das Turnier öffentlich über Share-Link zugänglich ist */
  isPublic?: boolean;
  /** 6-stelliger Share-Code für öffentlichen Zugang (z.B. "ABC123") */
  shareCode?: string;
  /** ISO timestamp wann der Share-Code erstellt wurde */
  shareCodeCreatedAt?: string;
}

// ============================================================================
// MATCH COCKPIT PRO TYPES
// ============================================================================

/**
 * Sound preset IDs for match end horn
 */
export type MatchSoundPreset = 'horn-1' | 'horn-2' | 'horn-3' | 'custom';

/**
 * Timer direction for match cockpit display
 */
export type TimerDirection = 'countdown' | 'elapsed';

/**
 * How finals tiebreakers are resolved by default
 */
export type FinalDeciderType = 'penalty' | 'goldenGoal';

/**
 * Match Cockpit Settings - Tournament-wide defaults for live match management
 *
 * These settings apply to all matches in a tournament and can be
 * overridden per-match via MatchCockpitOverrides.
 *
 * @see docs/concepts/MATCH-COCKPIT-PRO-KONZEPT.md
 */
export interface MatchCockpitSettings {
  // Timer Settings
  /** Timer direction: countdown (10:00→00:00) or elapsed (00:00→10:00). Default: 'countdown' */
  timerDirection: TimerDirection;
  /** Enable netto-time warning animation. Default: true */
  nettoWarningEnabled: boolean;
  /** Seconds remaining when netto warning triggers (e.g., 120 = 2:00 remaining). Default: 120 */
  nettoWarningSeconds: number;

  // Automation Settings
  /** Auto-finish match when timer reaches 00:00. Ignored for finals with draw. Default: true */
  autoFinishEnabled: boolean;
  /** Seconds to wait before auto-advancing to next match (0 = disabled). Default: 10 */
  autoAdvanceSeconds: number;

  // Final Match Rules
  /** Default tiebreaker for finals with draw. Default: 'penalty' */
  finalDecider: FinalDeciderType;
  /** Number of penalty shooters per team. Default: 5 */
  penaltyShootersPerTeam: number;
  /** Round after which sudden death begins. Default: 6 */
  penaltySuddenDeathAfter: number;

  // Sound Settings
  /** Enable end-of-match horn sound. Default: false */
  soundEnabled: boolean;
  /** Sound preset ID or 'custom' for uploaded sound. Default: 'horn-1' */
  soundId: MatchSoundPreset | null;
  /** Sound volume (0-100). Default: 80 */
  soundVolume: number;
  /** Whether a custom sound has been uploaded. Default: false */
  hasCustomSound: boolean;

  // Feedback Settings
  /** Enable haptic feedback (vibration) on events. Default: true */
  hapticEnabled: boolean;
  /** Keep screen awake during active match. Default: true */
  wakeLockEnabled: boolean;
}

/**
 * Default values for MatchCockpitSettings
 * Used when creating new tournaments or when settings are undefined
 */
export const DEFAULT_MATCH_COCKPIT_SETTINGS: MatchCockpitSettings = {
  // Timer
  timerDirection: 'countdown',
  nettoWarningEnabled: true,
  nettoWarningSeconds: 120, // 2 minutes

  // Automation
  autoFinishEnabled: true,
  autoAdvanceSeconds: 10,

  // Final Rules
  finalDecider: 'penalty',
  penaltyShootersPerTeam: 5,
  penaltySuddenDeathAfter: 6,

  // Sound
  soundEnabled: false,
  soundId: 'horn-1',
  soundVolume: 80,
  hasCustomSound: false,

  // Feedback
  hapticEnabled: true,
  wakeLockEnabled: true,
};

/**
 * Per-match overrides for cockpit settings
 * Only includes settings that can be changed during a match
 *
 * These overrides are stored on the LiveMatch (not Match) since they
 * are runtime settings that don't persist to tournament state.
 */
export interface MatchCockpitOverrides {
  /** Override netto warning for this match */
  nettoWarningEnabled?: boolean;
  /** Override auto-finish for this match */
  autoFinishEnabled?: boolean;
  /** Override sound enabled for this match */
  soundEnabled?: boolean;
  /** Override sound preset for this match */
  soundId?: MatchSoundPreset | null;
  /** Override volume for this match */
  soundVolume?: number;
  /** Enable golden goal for this final (overrides tournament default) */
  goldenGoalEnabled?: boolean;
}

export interface Standing {
  team: Team;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
}

// ============================================================================
// LIVE-COCKPIT TYPES (Konzept Abschnitt 8)
// ============================================================================

/**
 * Match Event Types for Live-Cockpit
 * Used to track all events during a match
 */
export type MatchEventType =
  | 'GOAL'
  | 'YELLOW_CARD'
  | 'RED_CARD'
  | 'TIME_PENALTY'
  | 'SUBSTITUTION'
  | 'PAUSE'
  | 'RESUME'
  | 'HALF_TIME'
  | 'MATCH_END';

/**
 * Card type for YELLOW_CARD and RED_CARD events
 */
export type CardType = 'YELLOW' | 'RED';

/**
 * Match Event - represents a single event during a match
 * Used for event log, undo functionality, and statistics
 */
export interface MatchEvent {
  id: string;
  type: MatchEventType;
  timestamp: Date;
  matchMinute: number;        // Spielminute (0-20)
  teamId?: string;
  playerNumber?: number;

  // GOAL specific - Vorlagengeber (max 2)
  assists?: number[];

  // TIME_PENALTY specific
  penaltyDuration?: number;   // Duration in seconds
  penaltyEndTime?: Date;      // When the penalty ends

  // SUBSTITUTION specific - Arrays für mehrere Wechsel
  playersOut?: number[];
  playersIn?: number[];

  // Card type (for YELLOW_CARD and RED_CARD events)
  cardType?: 'YELLOW' | 'RED';

  /**
   * Incomplete entry tracking
   * True if event was created with "Ohne Details" button
   * Events with incomplete=true should be shown with ⚠️ in the event log
   * and can be edited later to add missing details
   */
  incomplete?: boolean;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Runtime Match Event - used in useLiveMatches hook and match-cockpit
 * This is the payload-based format used during live matches.
 *
 * Different from MatchEvent (above) which uses flat properties.
 * Use EditableMatchEvent for components that need to work with both formats.
 */
export interface RuntimeMatchEvent {
  id: string;
  matchId?: string;
  timestampSeconds: number;
  type: 'GOAL' | 'RESULT_EDIT' | 'STATUS_CHANGE' | 'YELLOW_CARD' | 'RED_CARD' | 'TIME_PENALTY' | 'SUBSTITUTION' | 'FOUL';
  payload: {
    teamId?: string;
    teamName?: string;
    direction?: 'INC' | 'DEC';
    newHomeScore?: number;
    newAwayScore?: number;
    /** For STATUS_CHANGE events */
    toStatus?: 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';
    /** Spieler-Rückennummer (Torschütze, Karte, Strafe) */
    playerNumber?: number;
    /** Rückennummern der Vorlagengeber (max 2) */
    assists?: number[];
    /** Dauer der Zeitstrafe in Sekunden (default: 120) */
    penaltyDuration?: number;
    /** Rückennummern der ausgewechselten Spieler */
    playersOut?: number[];
    /** Rückennummern der eingewechselten Spieler */
    playersIn?: number[];
    cardType?: 'YELLOW' | 'RED';
  };
  scoreAfter: {
    home: number;
    away: number;
  };
  /** Event was recorded without details - needs completion */
  incomplete?: boolean;
}

/**
 * Editable Match Event - adapter interface for components that work with both formats.
 * Used by EventEditDialog and other editing components.
 */
export interface EditableMatchEvent {
  id: string;
  type: string;
  // Support both runtime (timestampSeconds) and storage (matchMinute) formats
  timestampSeconds?: number;
  matchMinute?: number;
  // Direct properties (storage format)
  teamId?: string;
  playerNumber?: number;
  incomplete?: boolean;
  // Payload properties (runtime format)
  payload?: {
    teamId?: string;
    teamName?: string;
    playerNumber?: number;
  };
}

/**
 * Type guard to check if event is in runtime format
 */
export function isRuntimeMatchEvent(event: MatchEvent | RuntimeMatchEvent): event is RuntimeMatchEvent {
  return 'payload' in event && 'timestampSeconds' in event;
}

/**
 * Live Match Status for Live-Cockpit
 * More granular than MatchStatus for real-time display
 */
export type LiveMatchStatus =
  | 'NOT_STARTED'
  | 'RUNNING'
  | 'PAUSED'
  | 'HALF_TIME'
  | 'FINISHED';

/**
 * How a match result was determined
 */
export type MatchResultType = 'REGULAR' | 'OVERTIME' | 'GOLDEN_GOAL' | 'PENALTY';

/**
 * Active Penalty - represents a running time penalty
 * Multiple penalties can run simultaneously
 */
export interface ActivePenalty {
  eventId: string;            // Reference to the MatchEvent
  teamId: string;
  playerNumber?: number;
  remainingSeconds: number;   // Countdown
  startedAt: Date;
  endsAt: Date;
}

/**
 * Match State - complete state of a live match
 * Used by useLiveCockpit hook
 */
export interface MatchState {
  matchId: string;
  status: LiveMatchStatus;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  elapsedSeconds: number;
  halfDurationSeconds: number;
  currentHalf: 1 | 2;
  events: MatchEvent[];
  activePenalties: ActivePenalty[];
  openEntriesCount: number;

  // Penalty shootout (optional, only for finals)
  penaltyShootout?: PenaltyShootout;
  resultType: MatchResultType;
}

/**
 * Individual penalty kick in a shootout
 */
export interface PenaltyKick {
  order: number;              // 1-10+ (Sudden Death)
  teamId: string;
  playerNumber?: number;
  scored: boolean;
  timestamp: Date;
}

/**
 * Penalty Shootout state
 * Tracks the entire shootout including sudden death
 */
export interface PenaltyShootout {
  id: string;
  matchId: string;
  kicks: PenaltyKick[];
  homeScore: number;          // Goals scored in shootout
  awayScore: number;          // Goals scored in shootout
  winnerId?: string;          // Team ID of winner (set when decided)
  isDetailedTracking: boolean; // true = track each kick, false = only final score
  currentRound: number;       // Current round (1-5, then sudden death)
  currentTeamId?: string;     // Which team is shooting next
  isComplete: boolean;        // true when shootout is decided
}

/**
 * Knockout/Finals Configuration
 * Extends FinalsConfig with additional settings for tiebreakers
 */
export interface KnockoutConfig {
  tiebreaker: TiebreakerMode;
  extraTimeDuration?: number;   // Duration of overtime in seconds (if applicable)
  penaltyKicksPerTeam: number;  // Standard: 5
}

/**
 * Kontaktinformationen für Turniere
 * Wird später aus dem User-Bereich befüllt
 */
export interface ContactInfo {
  name?: string;        // Ansprechpartner
  email?: string;       // E-Mail
  phone?: string;       // Telefon
  website?: string;     // Website
}

/**
 * Import Types for External Tournament Data (US-005)
 */
export type ImportFormat = 'json' | 'csv';

export interface ImportValidationWarning {
  code: string;
  field?: string;
  message: string;
  severity: 'info' | 'warning';
}

export interface ImportValidationError {
  code: string;
  field: string;
  message: string;
}

export interface ImportValidationResult {
  isValid: boolean;
  errors: ImportValidationError[];
  warnings: ImportValidationWarning[];
  tournament?: Tournament;
}
