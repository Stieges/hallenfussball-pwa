import { SportId } from '../config/sports/types';
import type { MatchSlot, SlotSource } from '../core/models/schemas/MatchSlotSchema';
import {
  CLOCK_MODES,
  DEFAULT_CLOCK_MODE,
  DEFAULT_FINAL_PHASE_MINUTES,
  FINAL_PHASE_MINUTES_MAX,
  FINAL_PHASE_MINUTES_MIN,
  type ClockMode,
} from '../core/match/clockDisplay';

// Core Tournament Types
export type Sport = 'football' | 'other';
export type TournamentType = 'classic' | 'bambini';
export type TournamentMode = 'classic' | 'miniFussball';
export type GroupSystem = 'roundRobin' | 'groupsAndFinals';
export type RoundLogic = 'fixed' | 'promotion';
export type ResultMode = 'goals' | 'winLossOnly';
export type TournamentStatus = 'draft' | 'published';
/**
 * Eröffnung bei zwei Mannschaften des Veranstalters (@W4-033): Veranstalter gegen einen Gast, Vereinsduell
 * in Runde 2 (Voreinstellung) oder Vereinsduell als Spiel 1. Wirkt nur im Runden-Spielplan (@W4-041).
 */
export type OpeningMode = 'guest-opening' | 'club-derby';
export const OPENING_MODES: readonly OpeningMode[] = ['guest-opening', 'club-derby'];
export const DEFAULT_OPENING_MODE: OpeningMode = 'guest-opening';

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
  /**
   * Historische Beschriftung, wie sie zur Anlagezeit persistiert wurde.
   *
   * Neu erzeugte Kriterien setzen dieses Feld nicht mehr — die Anzeige löst
   * über `id` gegen den i18n-Namespace `wizard` (`placementLogic.criteria.<id>`)
   * auf. `label` bleibt als Rückfall erhalten, damit bereits gespeicherte
   * Turniere (deren `id` z.B. durch einen Import nicht zu einem i18n-Schlüssel
   * passt) weiterhin lesbar sind — Entfernen würde bestehende Produktionsdaten
   * brechen.
   */
  label?: string;
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
  | 'top-4'          // Halbfinale + Spiel um Platz 3 + Finale
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

/** K.-o.-Runde, in der nach Unentschieden entschieden wird (B-04c, @W2A-007) */
export type KnockoutRound = 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';

/** Runden-Schlüssel der Entscheidungsregel inkl. Platzierungsspiele (B-04c Fixrunde 2, @W2A-039) */
export type TiebreakerRoundKey = KnockoutRound | 'placement';

/**
 * Finals Configuration
 * Replaces the old Finals boolean structure with preset-based system
 */
export interface FinalsConfig {
  preset: FinalsPreset;
  parallelSemifinals?: boolean;      // Halbfinale gleichzeitig?
  parallelQuarterfinals?: boolean;   // Viertelfinale gleichzeitig?
  parallelRoundOf16?: boolean;       // Achtelfinale gleichzeitig?
  tiebreaker?: TiebreakerMode;       // Entscheidung bei Unentschieden (Vorgabe je Runde)
  tiebreakerDuration?: number;       // Dauer in Minuten (für Verlängerung/Golden Goal)
  tiebreakerByRound?: Partial<Record<TiebreakerRoundKey, TiebreakerMode>>; // Entscheidung je Runde (überschreibt `tiebreaker`); `placement` = Platzierungsspiele (@W2A-039)
  /**
   * A-12a (@TM-004): ausgespielte Plätze außer dem Finale, je Platz wählbar (3, 5, 7). Fehlt der Wert, belegt die Vorlage
   * vor (`defaultPlacements`: „Top 4“ → [3], „Alle Plätze“ → [3, 5, 7]); `[]` = kein Platzierungsspiel.
   */
  placements?: number[];
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
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy type still in use
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
 * How a finals match was decided (for display purposes). 'forfeit' = Nichtantritts-Wertung (A-25, E-A4; in der Spalte
 * `decided_by` ab Migration `20261110_005`), wer fehlte steht in `Match.forfeitAbsent`.
 */
export type MatchDecidedBy = 'regular' | 'overtime' | 'goldenGoal' | 'penalty' | 'forfeit';

/** Nichtantritts-Wertung: welche Seite nicht angetreten ist (`matches.forfeit_absent`, ab Migration `20261110_005`). */
export type ForfeitAbsent = 'A' | 'B' | 'both';

/**
 * Wertung bei Nichtantritt (@W2A-022, @W2A-025): Tore der angetretenen (`winner`) und der fehlenden Seite (`loser`),
 * im `tournaments.config`-JSONB; ohne Einstellung 2:0 (`DEFAULT_FORFEIT_SCORE`, `core/models/forfeit.ts`).
 */
export interface ForfeitScore {
  winner: number;
  loser: number;
}

export interface Match {
  id: string;
  round: number;
  field: number;
  slot?: number; // Time slot index for fair scheduling
  /** Heimseite als Slot: Team-ID oder strukturierte Herkunft (@TM-015). Pflicht – die einzige Quelle der Seiten. */
  slotA: MatchSlot;
  /** Gastseite als Slot, siehe `slotA`. */
  slotB: MatchSlot;
  /** A-36a: Herkunft des Heim-PLATZES, beim Anlegen gesetzt, danach unveränderlich (@DR-005, @SA-011); Gruppenspiel: fehlt. */
  originA?: SlotSource;
  /** A-36a: Herkunft des Gast-Platzes, siehe `originA`. */
  originB?: SlotSource;
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
  liveState?: unknown;                 // matches.live_state (Feinstatus für Abzeichen, R-SA8); nur lesen, Form: badgeDetailFromLiveState
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
  forfeitAbsent?: ForfeitAbsent; // A-25c: wer bei einer Wertung fehlte (nur lesen, gilt nur mit decidedBy 'forfeit')

  // US-SCHEDULE-EDITOR: Skipped match support
  skippedReason?: string;        // Grund für Überspringen (z.B. "Team zurückgezogen")
  skippedAt?: string;            // ISO timestamp when match was skipped
  kit?: import('../core/models/kit').MatchKit; // A-30a: beim Anpfiff getragene Farben (nur Server schreibt, @W3-028)

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
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Legacy type still in Tournament interface
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
  rulebook?: string; // Regelwerk-Text für den Ausdruck, höchstens 80 Zeichen (@DR-016)
  bibColor?: string; // A-30a @W3-029: Leibchenfarbe des Turniers (#RRGGBB), ohne Einstellung Gelb
  spectatorDisplay?: import('../core/models/spectatorDisplay').SpectatorDisplaySettings; // Spielanzeige 2.1 @ZM-152: „Anzeige für Zuschauer“ (config-JSONB), ohne Eintrag Vorbelegung
  contactInfo?: ContactInfo; // Kontaktinformationen (optional)

  // Step 4: Teams
  teams: Team[];
  /**
   * Mannschaften des Veranstalters (@W4-027, @W4-034): Team-IDs, im `config`-JSONB gespeichert. Verwaiste IDs
   * (Team gelöscht) gelten nicht und werden beim Speichern entfernt (@W4-044); Reihenfolge = Teamliste.
   */
  hostTeamIds?: string[];
  /**
   * Paket TB (Plan v2 § 3.2): Entscheidungen der Turnierleitung über Gleichstände nach allen Kriterien, im
   * `config`-JSONB (keine Migration). Gültig ist eine nur, solange Block und Grundlage gleich sind (reine Rechnung).
   */
  standingDecisions?: StandingDecision[];
  /**
   * Paket TB-B (TB-3', Daniel 2026-10-20): Plätze, die bei Gleichstand ausgespielt werden müssen (Gruppenplätze), im
   * `config`-JSONB. Gelesen über `effectivePlacementsToPlayOut` (`core/standings/playOutPlaces.ts`): fehlt der Wert,
   * gilt nur Platz 1 (Daniel K10); `[]` = kein Platz.
   */
  placementsToPlayOut?: number[];
  /** GA4 A-13a: Abschlüsse der Gruppen (`group_completions`); fehlt vor G1 – dann ist keine Gruppe abgeschlossen. */
  groupCompletions?: GroupCompletion[];
  /**
   * GA4 A-13b-C: Verlauf der Besetzung und der Gleichstands-Entscheidungen (`bracket_log` über `bracket_log_read`) mit
   * Person und Zeit. Nur die Turnierleitung bekommt Zeilen (Server), im öffentlich lesbaren Datensatz steht er nie
   * (@W2A-072); fehlt vor G1 oder ohne Recht.
   */
  decisionLog?: BracketLogEntry[];
  /** A-25c (@W2A-025): Wertung bei Nichtantritt, im `config`-JSONB; fehlt sie oder ist sie unbrauchbar, gilt 2:0. */
  forfeitScore?: ForfeitScore;
  /** Wahl der Eröffnung bei zwei Mannschaften des Veranstalters (@W4-033); ohne Wahl `DEFAULT_OPENING_MODE`. */
  openingMode?: OpeningMode;

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
  /**
   * ISO timestamp der ersten Freigabe. Monotoner Freigabe-Marker: gesetzt bleibt gesetzt.
   *
   * Bewusst NICHT `status`: `status: 'draft'` ist ein Wizard-Marker für noch nicht
   * festgelegte Turniere. Bearbeiten über „Im Wizard bearbeiten" (SettingsTab) setzt ein
   * festgelegtes Turnier NICHT mehr auf 'draft' zurück (@W5-004/@LZ-004); nach dem
   * ersten Anpfiff wird dieser Weg gar nicht angeboten (@LZ-003). `publishedAt` bleibt
   * als monotoner Freigabe-Marker bestehen, damit auch ein Reload mitten im Bearbeiten
   * ein laufendes Turnier nicht vom Netz nimmt.
   *
   * Reist im `config`-JSONB mit (keine eigene DB-Spalte), siehe supabaseMappers.
   */
  publishedAt?: string;
  /** Ob das Turnier öffentlich über Share-Link zugänglich ist */
  isPublic?: boolean;
  /** 6-stelliger Share-Code für öffentlichen Zugang (z.B. "ABC123") */
  shareCode?: string;
  /** ISO timestamp wann der Share-Code erstellt wurde */
  shareCodeCreatedAt?: string;

  // Optimistic Locking
  version?: number;
  /**
   * C-VERSION-MEHRDEUTIG (@FU-106, Regel „nichts still überschreiben“): zuletzt vom Server bestätigte Version, auf der der
   * Inhalt beruht. Gesetzt nur bei der Übernahme aus der Cloud oder nach einem bestätigten Upload; ein lokales Speichern
   * trägt den Wert der Nutzlast weiter (nie „Nutzlast + 1“). Voll-Speichern und Metadaten prüfen am Server gegen ihn.
   * Nie in die Cloud geschrieben.
   */
  serverVersion?: number;
  /**
   * Befund C-ZWEITES-SPEICHERN-EIGENE-VORVERSION (@FU-110): erste Basis einer ununterbrochenen Kette eigener, bestätigter
   * Uploads dieses Geräts bis `serverVersion`. Eine Nutzlast mit Basis in dieser Kette beruht auf dem eigenen Stand und wird
   * gegen `serverVersion` geprüft. Endet bei jeder Übernahme aus der Cloud. Nur lokal, nie in die Cloud geschrieben.
   */
  ownUploadsFrom?: number;
  /**
   * A-10 (@TM-027, Befund C-SLOT-UPDATE-OHNE-VERSION): Änderungszählung des Servers (`tournaments.change_revision`),
   * zählt Spielplan-Änderungen ohne Versions-CAS. Nur aus der Cloud gelesen; lokale Schreibwege ändern sie nie.
   * Höherer Cloud-Wert → ganze Kopie übernehmen (Regel Q gilt). Fehlt die Spalte: 0.
   */
  changeRevision?: number;

  // Multi-User / Cloud Sync
  /** User ID of the tournament owner (for cloud sync) */
  ownerId?: string;
  /**
   * CA-5 (@HE-085, Befund C-LISTE-NUR-EIGENTUEMER): eigene Rolle des Kontos in diesem Turnier, nur im Listenobjekt der
   * Startseite (`listForCurrentUser`). Nie in die Cloud geschrieben. Fehlt sie, ist es ein eigenes Turnier (Gast, lokal).
   */
  myRole?: TournamentListRole;
}

/**
 * CA-5: Rollen im Listenobjekt der Startseite (hier für core/). Teilmenge von `TournamentRole` ohne die Geräte-Rollen
 * helper/screen (A-27): unbekannte Rollen einer Mitgliedszeile verwirft die Liste (`accountTournamentList.ts`).
 */
export type TournamentListRole = 'owner' | 'co-admin' | 'trainer' | 'collaborator' | 'viewer';

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

/** Kartenarten, die das Cockpit je Turnier anbietet (@SL-024). */
export interface EnabledCards {
  yellow: boolean;
  yellowRed: boolean;
  red: boolean;
  timePenalty: boolean;
}

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

  // Spielregel Zeitstrafe (@W2A-029)
  /**
   * Dauer einer Zeitstrafe in Sekunden (Spielregel, Default: 120 = 2 Minuten).
   * Gilt ab dem nächsten Anpfiff: das Cockpit übernimmt den Wert beim Anpfiff
   * in den Spielstand (startMatch), ein laufendes Spiel rechnet weiter mit
   * seinem Stand.
   */
  timePenaltyDurationSeconds: number;

  // Spielregeln „Spiel leiten“ (@SL-002, @SL-024, @SL-101, @W2A-013, @W2A-017, @W2A-035, @W2A-037)
  /** Uhr-Art. Default: 'durchlaufend-letzte-minute-angehalten' */
  clockMode: ClockMode;
  /** Foul-Grenze je Halbzeit (5. Foul = Grenze). null = ausgeschaltet. Default: 5 */
  foulLimit: number | null;
  /** Welche Kartenarten das Cockpit anbietet. Default: alle an */
  enabledCards: EnabledCards;
  /** Zeitstrafe endet bei Gegentor (bzw. Eigentor des bestraften Teams). Default: true */
  penaltyEndsOnGoal: boolean;
  /** Unterzahl-Dauer nach Gelb-Rot oder Rot in Sekunden. Default: 120 */
  shortHandedSeconds: number;
  /** Länge der angehaltenen Schlussphase in Minuten, ganzzahlig 1–5 (@W2A-040, @SL-136). Default: 1 */
  finalPhaseMinutes: number;

  // Sound Settings
  /** Enable end-of-match horn sound. Default: true (@W2A-038, Vorbelegung des Turniers) */
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

  // Spielregel Zeitstrafe (@W2A-029)
  timePenaltyDurationSeconds: 120,

  // Spielregeln „Spiel leiten“ (Vorgaben aus den Gherkin-Szenarien)
  clockMode: DEFAULT_CLOCK_MODE,
  foulLimit: 5,
  enabledCards: { yellow: true, yellowRed: true, red: true, timePenalty: true },
  penaltyEndsOnGoal: true,
  shortHandedSeconds: 120,
  finalPhaseMinutes: DEFAULT_FINAL_PHASE_MINUTES,

  // Sound
  soundEnabled: true,
  soundId: 'horn-1',
  soundVolume: 80,
  hasCustomSound: false,

  // Feedback
  hapticEnabled: true,
  wakeLockEnabled: true,
};

/** Ganzzahl im Bereich [min, max] (max optional) -- Prüfung je Regel-Feld (H3). */
function isIntInRange(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Wert behalten, wenn er gültig ist, sonst Vorgabe (H3, wie der SQL-Zwilling bei ungültigen Werten). */
function validOr<T>(value: unknown, isValid: (candidate: unknown) => boolean, fallback: T): T {
  return isValid(value) ? (value as T) : fallback;
}

const isBoolean = (value: unknown): boolean => typeof value === 'boolean';

/** `enabledCards`: jede Kartenart einzeln; ein ungültiger Schalter fällt auf die Vorgabe zurück. */
function completeEnabledCards(value: unknown): EnabledCards {
  const defaults = DEFAULT_MATCH_COCKPIT_SETTINGS.enabledCards;
  const stored = typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  return {
    ...stored,
    yellow: validOr(stored.yellow, isBoolean, defaults.yellow),
    yellowRed: validOr(stored.yellowRed, isBoolean, defaults.yellowRed),
    red: validOr(stored.red, isBoolean, defaults.red),
    timePenalty: validOr(stored.timePenalty, isBoolean, defaults.timePenalty),
  };
}

/**
 * Ergänzt eine gespeicherte Cockpit-Konfiguration um die Vorgaben für fehlende Felder
 * (alte Turniere ohne Spielregel-Felder). Fehlt die Konfiguration oder ist sie kein
 * Objekt, bleibt sie `undefined`; die Verbraucher nehmen dann die Vorgaben selbst.
 * ZA-3 (H3): ungültige Einzelwerte der Spielregel-Felder fallen ebenfalls auf die Vorgabe zurück;
 * `foulLimit: null` (ausgeschaltet) bleibt erhalten.
 */
export function completeMatchCockpitSettings(value: unknown): MatchCockpitSettings | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined;
  }
  const gespeichert = value as Partial<MatchCockpitSettings>;
  const vorgabe = DEFAULT_MATCH_COCKPIT_SETTINGS;
  return {
    ...vorgabe,
    ...gespeichert,
    clockMode: validOr(gespeichert.clockMode, (v) => CLOCK_MODES.some((mode) => mode === v), vorgabe.clockMode),
    foulLimit: gespeichert.foulLimit === null ? null : validOr(gespeichert.foulLimit, (v) => isIntInRange(v, 1), vorgabe.foulLimit),
    enabledCards: completeEnabledCards(gespeichert.enabledCards),
    penaltyEndsOnGoal: validOr(gespeichert.penaltyEndsOnGoal, isBoolean, vorgabe.penaltyEndsOnGoal),
    shortHandedSeconds: validOr(gespeichert.shortHandedSeconds, (v) => isIntInRange(v, 0), vorgabe.shortHandedSeconds),
    finalPhaseMinutes: validOr(
      gespeichert.finalPhaseMinutes,
      (v) => isIntInRange(v, FINAL_PHASE_MINUTES_MIN, FINAL_PHASE_MINUTES_MAX),
      vorgabe.finalPhaseMinutes,
    ),
  };
}

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
  /** Paket TB: Platzziffer; ein offener Block teilt sie, danach springt sie (2, 2, 4) – @W2A-047. */
  place?: number;
  /** Paket TB: Team-IDs des offenen Blocks (nach allen Kriterien gleich), nur bei mehr als einem Team. */
  tieBlock?: string[];
  /** Paket TB: „gleichauf – Entscheidung nötig“ – nur je Gruppe und erst, wenn alle Gruppenspiele entschieden sind. */
  decisionNeeded?: boolean;
  /** Paket TB (TB-3): angewendete Entscheidung der Turnierleitung. */
  decision?: StandingDecision;
}

/**
 * Paket TB (Plan v2 § 3.2, TB-3'): Entscheidung der Turnierleitung über einen Gleichstand nach allen Kriterien.
 * Gültigkeit und Anwendung: `core/standings/decisions.ts`; Speichern und Zurücknehmen: `StandingDecisionService`.
 * Steht im öffentlich lesbaren `config` – deshalb ohne Person, Zeitpunkt und Grund (@W2A-072, Daniel B4d); „wer wann“
 * und der Grund einer Reihenfolge stehen im Verlauf der Turnierleitung (`Tournament.decisionLog`, GA4 A-13b-C).
 */
export interface StandingDecision {
  id: string;
  /** `OVERALL_GROUP` ('') bei Jeder gegen jeden. */
  groupId: string;
  /** Block als Menge (sortiert). */
  teamIds: string[];
  /** Vorn = besser. */
  order: string[];
  /** 2 Teams: Strafstoßschießen, 3+: Reihenfolge; 'shared' = „Ergebnis so akzeptieren“ (Teams teilen den Platz). */
  kind: 'shootout' | 'order' | 'shared';
  shootout?: { winner: number; loser: number };
  /** Fingerabdruck der Grundlage. */
  basis: string;
}

/**
 * GA4 A-13a (R-GA4v2-4, @TM-046, @TM-059): Abschluss einer Gruppe durch die Turnierleitung („Gruppe abschließen“), Zeile
 * aus `group_completions` (Server ab Migration `20261110_006`, Mapper GA4 A-13b-C). Vor G1 fehlt das Feld am Turnier –
 * dann gilt jede Gruppe als nie abgeschlossen. Ohne Person und Grund (Verlauf `bracket_log`, @W2A-072).
 */
export interface GroupCompletion {
  /** Gruppe wie `groupKeyOf` (`OVERALL_GROUP` '' bei Jeder gegen jeden). */
  groupId: string;
  /** Rangfolge der Gruppe beim Abschluss (Team-IDs, Platz 1 zuerst). */
  ranking: string[];
  /** Plätze, die nach einer Korrektur offen auf ihre Herkunft zurückgingen (@TM-145); sonst leer. */
  openRanks: number[];
  /** Nach dem Abschluss wurde ein Gruppenspiel geändert („Besetzung prüfen“, @TM-071). */
  stale: boolean;
  completedAt?: string;
  /** Gesetzt, solange die Gruppe wieder geöffnet ist (@TM-099); dann gilt der Abschluss nicht. */
  reopenedAt?: string;
}

/** Art eines Verlaufseintrags (`bracket_log.kind`, Migration `20261110_006`). */
export type BracketLogKind =
  | 'complete_group' | 'reopen_group' | 'standing_decision' | 'standing_withdraw'
  | 'auto_advance' | 'auto_reassign' | 'release'
  | 'set_slot' | 'swap_sides' | 'set_advancement' | 'set_slot_source'
  | 'notice_kept' | 'clarification_resolved';

/**
 * GA4 A-13b-C (@TM-113, @W2A-071): ein Eintrag des Verlaufs, wie `bracket_log_read` ihn liefert. Name nie die E-Mail
 * (`actorName` fehlt, wenn die Person keinen Namen hat). Gleichstands-Entscheidungen tragen die Kennung der Entscheidung in
 * `detail.id`; der Grund einer Reihenfolge steht nur hier.
 */
export interface BracketLogEntry {
  id: number;
  kind: BracketLogKind;
  matchId?: string;
  groupId?: string;
  detail: Record<string, unknown>;
  reason?: string;
  actorName?: string;
  actorRole?: string;
  /** ISO-Zeitpunkt. */
  at: string;
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
 * Card type for YELLOW_CARD and RED_CARD events. 'YELLOW_RED' (Gelb-Rot, F3b1 30.09.) is its
 * own value, nicht mit 'RED' zusammengefasst -- der Ereignistyp bleibt dafuer RED_CARD (gleiche
 * Behandlung/Icon), nur payload.cardType unterscheidet sie.
 */
export type CardType = 'YELLOW' | 'YELLOW_RED' | 'RED';

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
  cardType?: CardType;

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
    /** L2 (@SL-022): Eigentor -- `teamId` ist das begünstigte Team, `ownGoalTeamId` das schießende */
    ownGoal?: boolean;
    ownGoalTeamId?: string;
    /** Dauer der Zeitstrafe in Sekunden (default: 120) */
    penaltyDuration?: number;
    /** Rückennummern der ausgewechselten Spieler */
    playersOut?: number[];
    /** Rückennummern der eingewechselten Spieler */
    playersIn?: number[];
    cardType?: CardType;

    // -------------------------------------------------------------------------
    // Draht-Format (wire shape) — so schrieb der frühere Altweg in den
    // Speicher (`core/models/LiveMatch.ts#MatchEvent.payload`). Die UI liest
    // dagegen `teamId` / `teamName` / `direction` / `penaltyDuration` (oben).
    //
    // Dass diese drei Felder hier BISHER FEHLTEN, ist genau der Grund, warum
    // `tsc` zu einem Bug mit vier sichtbaren Symptomen geschwiegen hat: beide
    // Seiten deklarierten nur optionale Felder, also war jedes `payload.teamId`
    // auf einem Draht-Event typkorrekt — und zur Laufzeit immer `undefined`
    // (Foulzähler nach Reload 0, jede Log-Zeile nannte das Gastteam, jede
    // Zeitstrafe "2 Min"). Deklariert gehören sie, damit die Umrechnung in
    // `utils/matchEvents.ts#toRuntimeMatchEvent` typgeprüft ist und beide
    // Formen als das sichtbar sind, was sie sind: zwei Schreibweisen desselben
    // Ereignisses.
    // -------------------------------------------------------------------------

    /** Draht-Format: Mannschaftsseite, wird zu `teamId`/`teamName` normalisiert */
    team?: 'home' | 'away';
    /** Draht-Format: +1 / −1, wird zu `direction` ('INC' | 'DEC') normalisiert */
    delta?: number;
    /** Draht-Format: Strafdauer in Sekunden, wird zu `penaltyDuration` normalisiert */
    durationSeconds?: number;
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
    /** F3b2 (Ruling PC30): 'YELLOW_RED' unterscheidet Gelb-Rot (Ereignistyp RED_CARD) von Rot. */
    cardType?: CardType;
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
  /** Häkchen „Ansprechpartner öffentlich zeigen“ (@W1-031): nur dann liefert der Server den Kontakt an Zuschauer aus
   *  (B-14) und das Spielplan-PDF druckt ihn (@W1-032). Fehlt es, bleibt der Kontakt intern (@W1-030). */
  showPublic?: boolean;
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
