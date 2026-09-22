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
 *
 * Strukturelle (nicht-sprachliche) Aussagen zur Sportart. Die sprachlichen
 * Bezeichnungen (Feld/Tor/Halbzeit/… inkl. Plural- und Sportart-Varianten)
 * leben ausschließlich in `src/i18n/locales/{de,en}/sport.json` und werden
 * über `useSportTerms`/`useSportConfig` aufgelöst — nicht hier, damit die
 * App ohne Code-Änderung übersetzbar bleibt.
 */
export interface SportTerminology {
  /**
   * Score display format.
   * Reserviert (Task 6, nirgends ausgewertet) — siehe UNIMPLEMENTED_CAPABILITIES in
   * capabilities.ts. Score-Anzeige ist überall hart auf 'goals' ausgelegt.
   */
  scoreFormat: 'goals' | 'sets' | 'points';
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

  /**
   * Whether draws are allowed in group phase.
   * Reserviert (Task 6, nirgends ausgewertet) — Duplikat von `rules.canDrawInGroupPhase`,
   * das seit Task 6 tatsächlich ausgewertet wird. Siehe UNIMPLEMENTED_CAPABILITIES in
   * capabilities.ts.
   */
  allowDraw: boolean;

  /** Typical team size (for info display) */
  typicalTeamSize: number;

  /** Typical number of fields */
  typicalFieldCount: number;

  /** Minimum rest slots between matches for a team */
  minRestSlots: number;

  /** Default finals preset when using groups + finals */
  defaultFinalsPreset: 'none' | 'final-only' | 'top-4' | 'top-8' | 'top-16' | 'all-places';
}

/**
 * Tiebreaker Mode for Finals (also exported from tournament.ts)
 * How to resolve draws in knockout/finals matches
 */
export type SportTiebreakerMode =
  | 'shootout'              // Direkt Strafstoßschießen
  | 'overtime-then-shootout' // Verlängerung, dann Strafstoßschießen
  | 'goldenGoal';           // Golden Goal (erstes Tor in Verlängerung gewinnt)

/**
 * Sport Rules
 */
export interface SportRules {
  /**
   * Can matches end in draw during group phase?
   * Wirksam seit Task 6: siehe MatchExecutionService.needsTiebreaker/initializeMatch
   * (LiveMatch.canEndInDraw). Für Fußball immer `true` — unverändertes Verhalten.
   */
  canDrawInGroupPhase: boolean;

  /**
   * Can matches end in draw during finals?
   * Wirksam seit Task 6: siehe MatchExecutionService.needsTiebreaker/initializeMatch
   * (LiveMatch.canEndInDraw). Für Fußball immer `false` — unverändertes Verhalten.
   */
  canDrawInFinals: boolean;

  /**
   * Has overtime in finals?
   * Reserviert (Task 6, nirgends ausgewertet) — siehe UNIMPLEMENTED_CAPABILITIES in
   * capabilities.ts. Das tatsächliche Verhalten kommt aus `defaultTiebreaker`.
   */
  hasOvertime: boolean;

  /** Overtime duration in minutes (if hasOvertime). Reserviert (Task 6) — siehe capabilities.ts. */
  overtimeDuration?: number;

  /** Has penalty shootout / free throws? Reserviert (Task 6) — siehe capabilities.ts. */
  hasShootout: boolean;

  /** Default tiebreaker mode for finals */
  defaultTiebreaker?: SportTiebreakerMode;

  /** Default duration for tiebreaker (overtime/golden goal) in minutes */
  defaultTiebreakerDuration?: number;

  /**
   * Is set-based scoring? (e.g., Volleyball)
   * Reserviert (Task 6, nirgends ausgewertet) — siehe UNIMPLEMENTED_CAPABILITIES in
   * capabilities.ts. LiveMatch kennt keine Satzverwaltung.
   */
  isSetBased: boolean;

  /** Sets needed to win (if isSetBased). Reserviert (Task 6) — siehe capabilities.ts. */
  setsToWin?: number;

  /** Points per set (if isSetBased). Reserviert (Task 6) — siehe capabilities.ts. */
  pointsPerSet?: number;

  /** Tiebreak points (if isSetBased, e.g., 15 for volleyball). Reserviert (Task 6) — siehe capabilities.ts. */
  tiebreakPoints?: number;
}

/**
 * Sport Features
 * Flags for enabling/disabling sport-specific features
 *
 * Alle Felder hier sind reserviert (Task 6, nirgends ausgewertet) — siehe
 * UNIMPLEMENTED_CAPABILITIES in capabilities.ts. Die zugehörigen Komponenten existieren,
 * werden aber unabhängig von diesen Flags immer angezeigt.
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
 *
 * `label` steht bewusst nicht hier — die Beschriftung ist eine deutsche
 * Zeichenkette und lebt in `sport.json` (`ageClasses.<value>`). `value` ist
 * der stabile, sprachneutrale Schlüssel dafür.
 */
export interface AgeClassOption {
  value: string;
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

  /**
   * Emoji icon
   *
   * Kein `name`-Feld hier — der Anzeigename ist eine deutsche Zeichenkette
   * und lebt in `sport.json` (`name`, kontextabhängig via `name_<sportId>`).
   * Auflösung über `useSportTerms(sport.id).term('name')`.
   */
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
