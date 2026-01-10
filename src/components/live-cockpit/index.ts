/**
 * Live Cockpit - Match Control Interface
 *
 * A touch-optimized interface for tournament directors to manage live matches.
 * Features: Timer, Score Control, Event Tracking, Fouls, Cards, Substitutions.
 */

export { LiveCockpit } from './LiveCockpit';
export { default } from './LiveCockpit';

// Backwards compatibility alias (deprecated - use LiveCockpit instead)
export { LiveCockpit as LiveCockpitMockup } from './LiveCockpit';

// Export types
export type {
  LiveCockpitProps,
  LiveCockpitMode,
  LiveCockpitState,
  TeamSide,
  GoalAction,
  ToastProps,
  TimerDisplayProps,
} from './types';

// Re-export match types for convenience
export type {
  LiveMatch,
  MatchEvent,
  MatchStatus,
  MatchPlayPhase,
  Team,
  MatchSummary,
} from './types';
