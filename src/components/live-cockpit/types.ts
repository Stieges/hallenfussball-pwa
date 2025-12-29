/**
 * Live Cockpit Types
 *
 * Re-exports existing types from match-cockpit and adds new types
 * specific to the redesigned Live Cockpit.
 *
 * Props interface matches MatchCockpit for drop-in replacement.
 */

// Re-export existing types for backwards compatibility
export type {
  LiveMatch,
  MatchEvent,
  MatchStatus,
  MatchPlayPhase,
  Team,
  MatchSummary,
} from '../match-cockpit/MatchCockpit';

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

  /** The current match being played */
  currentMatch: import('../match-cockpit/MatchCockpit').LiveMatch | null;
  /** Last finished match for reopening */
  lastFinishedMatch?: {
    match: import('../match-cockpit/MatchCockpit').MatchSummary;
    homeScore: number;
    awayScore: number;
  } | null;
  /** Upcoming matches for proactive hints */
  upcomingMatches: import('../match-cockpit/MatchCockpit').MatchSummary[];
  /** Minutes before next match to show warning */
  highlightNextMatchMinutesBefore?: number;

  // Event Handlers - Required (match MatchCockpit signature with matchId)
  onStart(matchId: string): void;
  onPause(matchId: string): void;
  onResume(matchId: string): void;
  onFinish(matchId: string): void;
  onGoal(matchId: string, teamId: string, delta: 1 | -1, options?: {
    playerNumber?: number;
    assists?: number[];
    incomplete?: boolean;
  }): void;
  onUndoLastEvent(matchId: string): void;
  onManualEditResult(matchId: string, newHomeScore: number, newAwayScore: number): void;
  onAdjustTime(matchId: string, newElapsedSeconds: number): void;

  // Optional Event Handlers for detailed tracking
  onTimePenalty?(matchId: string, teamId: string, options?: {
    playerNumber?: number;
    durationSeconds?: number;
  }): void;
  onCard?(matchId: string, teamId: string, cardType: 'YELLOW' | 'RED', options?: {
    playerNumber?: number;
  }): void;
  onSubstitution?(matchId: string, teamId: string, options?: {
    playersOut?: number[];
    playersIn?: number[];
  }): void;
  onFoul?(matchId: string, teamId: string): void;

  onLoadNextMatch(fieldId: string): void;
  onReopenLastMatch(fieldId: string): void;

  // Tiebreaker Handlers
  onStartOvertime?(matchId: string): void;
  onStartGoldenGoal?(matchId: string): void;
  onStartPenaltyShootout?(matchId: string): void;
  onRecordPenaltyResult?(matchId: string, homeScore: number, awayScore: number): void;
  onForceFinish?(matchId: string): void;
  onCancelTiebreaker?(matchId: string): void;
}

// ---------------------------------------------------------------------------
// Internal Props (for sub-components that don't need matchId)
// ---------------------------------------------------------------------------

export interface InternalLiveCockpitProps {
  /** The current match being played */
  match: import('../match-cockpit/MatchCockpit').LiveMatch;
  /** Name of the field/court */
  fieldName?: string;
  /** Tournament name for display */
  tournamentName?: string;
  /** Upcoming matches for proactive hints */
  upcomingMatches?: import('../match-cockpit/MatchCockpit').MatchSummary[];
  /** Last finished match for reopening */
  lastFinishedMatch?: {
    match: import('../match-cockpit/MatchCockpit').MatchSummary;
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
  status: import('../match-cockpit/MatchCockpit').MatchStatus;
  playPhase?: import('../match-cockpit/MatchCockpit').MatchPlayPhase;
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
