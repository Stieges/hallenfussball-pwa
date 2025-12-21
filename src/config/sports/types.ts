/**
 * Sport Configuration Types
 *
 * Defines the structure for sport-specific configurations including
 * terminology, defaults, rules, and features.
 */

/**
 * Available Sport IDs
 */
export type SportId =
  | 'football-indoor'   // Hallenfußball
  | 'football-outdoor'  // Feldfußball
  | 'handball'          // Handball
  | 'basketball'        // Basketball
  | 'volleyball'        // Volleyball
  | 'floorball'         // Floorball/Unihockey
  | 'hockey-indoor'     // Hallenhockey
  | 'hockey-outdoor'    // Feldhockey
  | 'custom';           // Benutzerdefiniert

/**
 * Sport Terminology
 * Defines sport-specific labels for UI elements
 */
export interface SportTerminology {
  /** Singular: "Feld" | "Court" | "Spielfläche" */
  field: string;
  /** Plural: "Felder" | "Courts" */
  fieldPlural: string;

  /** Singular: "Tor" | "Korb" | "Punkt" */
  goal: string;
  /** Plural: "Tore" | "Körbe" | "Punkte" */
  goalPlural: string;

  /** Singular: "Halbzeit" | "Viertel" | "Satz" | "Drittel" */
  period: string;
  /** Plural: "Halbzeiten" | "Viertel" | "Sätze" */
  periodPlural: string;

  /** Singular: "Spiel" | "Match" | "Partie" */
  match: string;
  /** Plural: "Spiele" | "Matches" */
  matchPlural: string;

  /** Singular: "Mannschaft" | "Team" */
  team: string;
  /** Plural: "Mannschaften" | "Teams" */
  teamPlural: string;

  /** Singular: "Schiedsrichter" | "Referee" */
  referee: string;
  /** Plural: "Schiedsrichter" | "Referees" */
  refereePlural: string;

  /** Score display format */
  scoreFormat: 'goals' | 'sets' | 'points';

  /** "Ergebnis" | "Spielstand" */
  scoreLabel: string;

  /** Result labels */
  win: string;
  loss: string;
  draw: string;

  /** Goal animation text: "TOR!" | "KORB!" | "PUNKT!" */
  goalAnimationText: string;
}

/**
 * Sport Default Values
 */
export interface SportDefaults {
  /** Default game duration in minutes */
  gameDuration: number;

  /** Default break between matches in minutes */
  breakDuration: number;

  /** Number of periods (1 = no periods, 2 = halves, 4 = quarters) */
  periods: number;

  /** Break between periods in minutes */
  periodBreak: number;

  /** Default point system */
  pointSystem: {
    win: number;
    draw: number;
    loss: number;
  };

  /** Whether draws are allowed in group phase */
  allowDraw: boolean;

  /** Typical team size (for info display) */
  typicalTeamSize: number;

  /** Typical number of fields */
  typicalFieldCount: number;

  /** Minimum rest slots between matches for a team */
  minRestSlots: number;
}

/**
 * Sport Rules
 */
export interface SportRules {
  /** Can matches end in draw during group phase? */
  canDrawInGroupPhase: boolean;

  /** Can matches end in draw during finals? */
  canDrawInFinals: boolean;

  /** Has overtime in finals? */
  hasOvertime: boolean;

  /** Overtime duration in minutes (if hasOvertime) */
  overtimeDuration?: number;

  /** Has penalty shootout / free throws? */
  hasShootout: boolean;

  /** Is set-based scoring? (e.g., Volleyball) */
  isSetBased: boolean;

  /** Sets needed to win (if isSetBased) */
  setsToWin?: number;

  /** Points per set (if isSetBased) */
  pointsPerSet?: number;

  /** Tiebreak points (if isSetBased, e.g., 15 for volleyball) */
  tiebreakPoints?: number;
}

/**
 * Sport Features
 * Flags for enabling/disabling sport-specific features
 */
export interface SportFeatures {
  /** DFB key patterns available (only football) */
  hasDFBKeys: boolean;

  /** Bambini mode makes sense for this sport */
  hasBambiniMode: boolean;

  /** Has referee assignment feature */
  hasRefereeAssignment: boolean;

  /** Has goal/score animation */
  hasGoalAnimation: boolean;

  /** Has real-time match timer */
  hasMatchTimer: boolean;

  /** Has halftime/period timer */
  hasPeriodTimer: boolean;

  /** Is set-based (needs different score input) */
  isSetBased: boolean;
}

/**
 * Age Class Option
 */
export interface AgeClassOption {
  value: string;
  label: string;
  minAge?: number;
  maxAge?: number;
}

/**
 * Sport Validation Rules
 */
export interface SportValidation {
  minTeams: number;
  maxTeams: number;
  minFields: number;
  maxFields: number;
  minGameDuration: number;
  maxGameDuration: number;
}

/**
 * Main Sport Configuration Interface
 */
export interface SportConfig {
  /** Unique sport identifier */
  id: SportId;

  /** Display name */
  name: string;

  /** Emoji icon */
  icon: string;

  /** Sport category for grouping */
  category: 'ball' | 'team' | 'individual' | 'other';

  /** Sport-specific terminology */
  terminology: SportTerminology;

  /** Default values */
  defaults: SportDefaults;

  /** Game rules */
  rules: SportRules;

  /** Feature flags */
  features: SportFeatures;

  /** Available age classes */
  ageClasses: AgeClassOption[];

  /** Validation constraints */
  validation: SportValidation;
}
