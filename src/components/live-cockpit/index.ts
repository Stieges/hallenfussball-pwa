/**
 * Live Cockpit - Redesigned Match Control Interface
 *
 * A touch-optimized interface for tournament directors to manage live matches.
 *
 * @see docs/concepts/LIVE-SCREEN-REDESIGN.md
 * @see docs/user-stories/US-LIVE-REDESIGN.md
 */

export { LiveCockpit } from './LiveCockpit';
export { LiveCockpitMockup } from './LiveCockpitMockup';
export { default } from './LiveCockpit';

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
