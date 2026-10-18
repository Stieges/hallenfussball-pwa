/**
 * Live Cockpit Types
 *
 * Spiel-Typen (LiveMatch, MatchSummary, ...) und die Typen des Live-Cockpits.
 *
 */

import type { RuntimeMatchEvent } from '../../types/tournament';
import type { SperrHinweis } from '../../core/match';
import type { LeerGrund } from './model/cockpitPhase';
import type { MindestpauseHinweis } from './model/cockpitTypes';

// ---------------------------------------------------------------------------
// Spiel-Typen (B-06: aus dem gelöschten match-cockpit/MatchCockpit.tsx hierher umgezogen)
// ---------------------------------------------------------------------------

export type MatchStatus = 'NOT_STARTED' | 'RUNNING' | 'PAUSED' | 'FINISHED';

export interface Team {
  id: string;
  name: string;
  logo?: {
    type: 'url' | 'base64' | 'initials';
    value: string;
    backgroundColor?: string;
    uploadedAt?: string;
    uploadedBy?: 'organizer' | 'trainer';
  };
  colors?: {
    primary: string;
    secondary?: string;
  };
}

// Re-export RuntimeMatchEvent as MatchEvent for backwards compatibility
export type MatchEvent = RuntimeMatchEvent;

/** Current phase of play within a match */
export type MatchPlayPhase = 'regular' | 'overtime' | 'goldenGoal' | 'penalty';

export interface LiveMatch {
  id: string;
  number: number;
  phaseLabel: string;
  fieldId: string;
  scheduledKickoff: string;
  durationSeconds: number;
  refereeName?: string;
  homeTeam: Team;
  awayTeam: Team;
  homeScore: number;
  awayScore: number;
  status: MatchStatus;
  elapsedSeconds: number;
  events: MatchEvent[];
  /** C3b-1 (G6): zurückgenommene Einträge eines Engine-Spiels, nur für die Protokoll-Anzeige. */
  retractedEvents?: MatchEvent[];

  // DEF-005: Timer persistence fields
  timerStartTime?: string;
  timerPausedAt?: string;
  timerElapsedSeconds?: number;

  // Tournament phase (groupStage, semifinal, final, etc.)
  tournamentPhase?: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';

  // Tiebreaker fields for finals matches
  playPhase?: MatchPlayPhase;           // Current phase: regular, overtime, goldenGoal, penalty
  overtimeScoreA?: number;              // Goals in overtime (home)
  overtimeScoreB?: number;              // Goals in overtime (away)
  overtimeDurationSeconds?: number;     // Duration of overtime in seconds
  overtimeElapsedSeconds?: number;      // Elapsed time in overtime
  penaltyScoreA?: number;               // Penalty score (home)
  penaltyScoreB?: number;               // Penalty score (away)
  tiebreakerMode?: 'shootout' | 'overtime-then-shootout' | 'goldenGoal'; // From tournament config
  awaitingTiebreakerChoice?: boolean;   // True when match ended in draw, waiting for tiebreaker

  // Zeitstrafe-Dauer in Sekunden, beim Anpfiff aus der Spielregel übernommen (@W2A-029)
  timePenaltyDurationSeconds?: number;

  // Match Cockpit Pro: Per-match setting overrides
  cockpitOverrides?: import('../../types/tournament').MatchCockpitOverrides;
}

export interface MatchSummary {
  id: string;
  number: number;
  phaseLabel: string;
  scheduledKickoff: string;
  fieldId: string;
  homeTeam: Team;
  awayTeam: Team;
  /** Tournament phase for detecting phase changes (group → finals) */
  tournamentPhase?: 'groupStage' | 'roundOf16' | 'quarterfinal' | 'semifinal' | 'final';
}

// ---------------------------------------------------------------------------
// Mode System Types
// ---------------------------------------------------------------------------

/**
 * Live Cockpit display modes
 * - focus: Minimal UI - only score, timer, goal buttons
 * - standard: Default - score, timer, goal buttons, undo, event list
 * - extended: Full - adds time/score correction, cards, substitutions
 */
export type LiveCockpitMode = 'focus' | 'standard' | 'extended';

// ---------------------------------------------------------------------------
// Action Types
// ---------------------------------------------------------------------------

export type TeamSide = 'home' | 'away';

export interface GoalAction {
  side: TeamSide;
  direction: 'INC' | 'DEC';
}

// ---------------------------------------------------------------------------
// Component Props Types (matches MatchCockpitProps for drop-in replacement)
// ---------------------------------------------------------------------------

export interface LiveCockpitProps {
  /** Name of the field/court */
  fieldName: string;
  /** Tournament name for display */
  tournamentName: string;
  /** Tournament ID for custom sound lookup */
  tournamentId: string;
  /** Match Cockpit Pro settings from tournament */
  cockpitSettings?: import('../../types/tournament').MatchCockpitSettings;
  /** If true, actions are disabled (viewer mode) */
  readOnly?: boolean;

  /** The current match being played */
  currentMatch: LiveMatch | null;
  /** Kein Spiel dasteht: wartet auf die Herkunft bzw. kein Spiel mehr; die Tafel nennt den Grund (@SL-052, @SL-054). */
  leer?: LeerGrund | null;
  /** Mindestpause unterschritten (@SL-051); sperrt nichts. Quelle B-10a3, bis dahin leer. */
  mindestpause?: MindestpauseHinweis | null;
  /** Gesperrte Rückennummern nach Rot (@SL-089, L6). */
  sperrHinweise?: readonly SperrHinweis[];
  /** Name des Geräts, von dem das Spiel übernommen wurde (@SL-015, B-49). */
  uebernahmeVon?: string | null;
  /** Letztes Zurücksetzen durch die Turnierleitung (@SL-068, A-10); eine neue `id` meldet sich in der Meldezeile. */
  letzteZuruecksetzung?: { id: string; spielNummer: number } | null;
  /** Last finished match for reopening */
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;
  /** Upcoming matches for proactive hints */
  upcomingMatches: MatchSummary[];
  /** Minutes before next match to show warning */
  highlightNextMatchMinutesBefore?: number;

  // Event Handlers - Required (match MatchCockpit signature with matchId)
  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onResume(matchId: string): void;
  /** Liefert (optional, als `Promise<string | null>`) die ID des gesendeten Endes, damit Ton und Vibration genau einmal je Ende kommen (B-08c). */
  onFinish(matchId: string): unknown;
  onGoal(matchId: string, teamId: string, delta: 1 | -1, options?: {
    playerNumber?: number;
    assists?: number[];
    incomplete?: boolean;
  }): void;
  /** A-08c: ohne Handler blendet das Cockpit den zugehörigen Knopf aus (@FU-071). */
  onUndoLastEvent?(matchId: string): void;
  onManualEditResult?(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onAdjustTime?(matchId: string, newElapsedSeconds: number): void;

  /** Callback when an event is updated */
  onUpdateEvent?: (matchId: string, eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) => void;
  /** L9: Callback when an event is deleted — persists the deletion and corrects the score (if GOAL) in the service. */
  onDeleteEvent?: (matchId: string, eventId: string) => void;
  // Event tracking handlers (new)
  onTimePenalty?(matchId: string, teamId: string, options?: {
    playerNumber?: number;
    durationSeconds?: number;
  }): void;
  onCard?(matchId: string, teamId: string, cardType: 'YELLOW' | 'YELLOW_RED' | 'RED', options?: {
    playerNumber?: number;
  }): void;
  onSubstitution?(matchId: string, teamId: string, options?: {
    playersOut?: number[];
    playersIn?: number[];
  }): void;
  onFoul?(matchId: string, teamId: string): void;

  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch?(fieldId: string): void;

  // Tiebreaker Handlers
  onStartOvertime?(matchId: string): void;
  onStartGoldenGoal?(matchId: string): void;
  onStartPenaltyShootout?(matchId: string): void;
  onRecordPenaltyResult?(matchId: string, homeScore: number, awayScore: number): void;
  onForceFinish?(matchId: string): void;
  /** Fixwave-Fix (Critical): bricht ein begonnenes Strafstoßschießen ab und zeigt wieder das
   *  Tiebreaker-Banner — anders als das entfernte onCancelTiebreaker (siehe service.cancelTiebreaker)
   *  beendet das NICHT das Spiel als Unentschieden. Dafür ist onForceFinish da. */
  onAbortPenaltyShootout?(matchId: string): void;

  /** Update cockpit settings directly from the view */
  onUpdateSettings?(settings: import('../../types/tournament').MatchCockpitSettings): void;
}

// ---------------------------------------------------------------------------
// Internal Props (for sub-components that don't need matchId)
// ---------------------------------------------------------------------------

export interface InternalLiveCockpitProps {
  /** The current match being played */
  match: LiveMatch;
  /** Name of the field/court */
  fieldName?: string;
  /** Tournament name for display */
  tournamentName?: string;
  /** Upcoming matches for proactive hints */
  upcomingMatches?: MatchSummary[];
  /** Last finished match for reopening */
  lastFinishedMatch?: {
    match: MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;
  /** Minutes before next match to show warning */
  warningMinutesBefore?: number;

  // Simplified handlers (matchId handled by parent)
  onGoal: (side: TeamSide, direction: 'INC' | 'DEC') => void;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
  onUndoLastEvent?: () => void;
  onAdjustTime?: (newElapsedSeconds: number) => void;
  onEditScore?: (homeScore: number, awayScore: number) => void;
  onRestart?: () => void;
  onLoadNextMatch?: () => void;
  onReopenLastMatch?: () => void;

  // Tiebreaker Handlers
  onStartOvertime?: () => void;
  onStartGoldenGoal?: () => void;
  onStartPenaltyShootout?: () => void;
  onCancelTiebreaker?: () => void;
  onRecordPenaltyResult?: (team: TeamSide, scored: boolean) => void;
  onForceFinish?: () => void;

  // Navigation
  onBack?: () => void;
}

// ---------------------------------------------------------------------------
// State Types
// ---------------------------------------------------------------------------

export interface LiveCockpitState {
  mode: LiveCockpitMode;
  showOverflowMenu: boolean;
  showTimeDialog: boolean;
  showScoreDialog: boolean;
  showRestartConfirm: boolean;
  showPenaltyDialog: boolean;
}

// ---------------------------------------------------------------------------
// Timer Display Types
// ---------------------------------------------------------------------------

export interface TimerDisplayProps {
  elapsedSeconds: number;
  durationSeconds: number;
  status: MatchStatus;
  playPhase?: MatchPlayPhase;
  /** Show countdown instead of elapsed */
  countdown?: boolean;
}

// ---------------------------------------------------------------------------
// Toast Types
// ---------------------------------------------------------------------------

export interface ToastProps {
  message: string;
  type: 'info' | 'warning' | 'success';
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}
