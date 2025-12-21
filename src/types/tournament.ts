import { SportId } from '../config/sports/types';

// Core Tournament Types
export type Sport = 'football' | 'other';
export type TournamentType = 'classic' | 'bambini';
export type TournamentMode = 'classic' | 'miniFussball';
export type GroupSystem = 'roundRobin' | 'groupsAndFinals';
export type RoundLogic = 'fixed' | 'promotion';
export type ResultMode = 'goals' | 'winLossOnly';
export type TournamentStatus = 'draft' | 'published';

export interface Team {
  id: string;
  name: string;
  group?: string;
  isRemoved?: boolean;  // TOUR-EDIT-TEAMS: Team wurde entfernt (aber hat noch historische Ergebnisse)
  removedAt?: string;   // ISO timestamp wann das Team entfernt wurde
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
 * Finals Configuration
 * Replaces the old Finals boolean structure with preset-based system
 */
export interface FinalsConfig {
  preset: FinalsPreset;
  parallelSemifinals?: boolean;      // Halbfinale gleichzeitig?
  parallelQuarterfinals?: boolean;   // Viertelfinale gleichzeitig?
  parallelRoundOf16?: boolean;       // Achtelfinale gleichzeitig?
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
 * Match Status for TL-RESULT-LOCK-01
 * - scheduled: Match not yet started
 * - running: Match currently in progress
 * - finished: Match completed, results locked
 */
export type MatchStatus = 'scheduled' | 'running' | 'finished';

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
  referee?: number; // Schiedsrichter-Nummer (SR1 = 1, SR2 = 2, etc.)

  // TL-RESULT-LOCK-01: Match Status & Correction Mode
  matchStatus?: MatchStatus;           // Current match status (default: 'scheduled')
  finishedAt?: string;                 // ISO timestamp when match was finished
  correctionHistory?: CorrectionEntry[]; // History of result corrections

  // Timer persistence for DEF-005 fix
  timerStartTime?: string;       // ISO timestamp when timer was started
  timerPausedAt?: string;        // ISO timestamp when timer was paused (undefined = running)
  timerElapsedSeconds?: number;  // Elapsed seconds before current run/pause
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
