/**
 * Monitor Components
 *
 * TV-optimized components for spectator display.
 * Used by MonitorTab for fullscreen live match viewing.
 */

// Main display components
export { LiveMatchDisplay, NoMatchDisplay } from './LiveMatchDisplay';
export type { LiveMatchDisplayProps, NoMatchDisplayProps } from './LiveMatchDisplay';

// Timer component
export { MatchTimer } from './MatchTimer';
export type { MatchTimerProps } from './MatchTimer';

// Field selection
export { FieldSelector } from './FieldSelector';
export type { FieldSelectorProps } from './FieldSelector';

// Fullscreen controls
export { FullscreenControls, useFullscreen } from './FullscreenControls';
export type { FullscreenControlsProps } from './FullscreenControls';

// Goal celebration
export { GoalAnimation, GoalFlash } from './GoalAnimation';
export type { GoalAnimationProps, GoalFlashProps } from './GoalAnimation';

// Next match preview
export { NextMatchPreview, useRemainingSeconds } from './NextMatchPreview';
export type { NextMatchPreviewProps, NextMatch } from './NextMatchPreview';
