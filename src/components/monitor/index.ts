/**
 * Monitor Components
 *
 * TV-optimized components for spectator display.
 * Used by the Monitor-Seite (features/monitor-display).
 */

// Main display components
export { LiveMatchDisplay, NoMatchDisplay } from './LiveMatchDisplay';
export type { LiveMatchDisplayProps, NoMatchDisplayProps } from './LiveMatchDisplay';

// Team name display
export { TeamNameDisplay } from './TeamNameDisplay';
export type { TeamNameDisplayProps } from './TeamNameDisplay';

// Timer component
export { MatchTimer } from './MatchTimer';
export type { MatchTimerProps } from './MatchTimer';

// Goal celebration
export { GoalAnimation, GoalFlash } from './GoalAnimation';
export type { GoalAnimationProps, GoalFlashProps } from './GoalAnimation';

// Card animation
export { CardAnimation, CardFlash } from './CardAnimation';
export type { CardAnimationProps, CardFlashProps, CardEventInfo } from './CardAnimation';
