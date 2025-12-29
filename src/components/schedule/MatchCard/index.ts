/**
 * MatchCard Components
 *
 * Card-based layout for schedule view (Spielplan 2.0)
 */

// Main components
export { MatchCard } from './MatchCard';
export { MatchCardDesktop } from './MatchCardDesktop';
export { MatchCardScore } from './MatchCardScore';

// Edit mode components
export { EditableMatchCard } from './EditableMatchCard';
export { ConflictBadge } from './ConflictBadge';
export { SRQuickEditPopover } from './SRQuickEditPopover';

// Utilities
export { formatTime, getTeamInitials, formatReferee } from './utils';

// Types
export type { MatchCardProps, Team } from './MatchCard';
export type { MatchCardDesktopProps } from './MatchCardDesktop';
export type { MatchCardScoreProps, MatchCardStatus } from './MatchCardScore';
export type { EditableMatchCardProps } from './EditableMatchCard';
export type { ConflictBadgeProps } from './ConflictBadge';
export type { SRQuickEditPopoverProps, RefereeOption } from './SRQuickEditPopover';
