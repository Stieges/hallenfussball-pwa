/**
 * DesktopCard - Desktop card for normal view (no DnD)
 *
 * Extracted from GroupStageSchedule.tsx for better maintainability.
 * Wraps MatchCardDesktop with expand functionality.
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../design-tokens'
import { ScheduledMatch } from '../../lib/scheduleGenerator';
import { Tournament } from '../../types/tournament';
import { getGroupShortCode } from '../../utils/displayNames';
import { MatchCardDesktop, type MatchCardStatus } from './MatchCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DesktopCardProps {
  /** Match data */
  match: ScheduledMatch;
  /** Current match status */
  status: MatchCardStatus;
  /** Whether card is expanded */
  isExpanded: boolean;
  /** Tournament data for group name resolution */
  tournament?: Tournament;
  /** Callback when card body is clicked */
  onCardClick: (matchId: string) => void;
  /** Callback when score circle is clicked */
  onCircleClick: (matchId: string) => void;
  /** Render function for expand content */
  renderExpandContent: (match: ScheduledMatch) => React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DesktopCard: React.FC<DesktopCardProps> = ({
  match,
  status,
  isExpanded,
  tournament,
  onCardClick,
  onCircleClick,
  renderExpandContent,
}) => {
  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    marginBottom: cssVars.spacing.sm,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle} data-match-card>
      <MatchCardDesktop
        matchId={match.id}
        matchNumber={match.matchNumber}
        scheduledTime={match.time}
        field={match.field}
        group={match.group ? getGroupShortCode(match.group, tournament) : undefined}
        homeTeam={{ id: `${match.id}-home`, name: match.homeTeam }}
        awayTeam={{ id: `${match.id}-away`, name: match.awayTeam }}
        homeScore={match.scoreA ?? 0}
        awayScore={match.scoreB ?? 0}
        status={status}
        progress={0}
        onRowClick={() => onCardClick(match.id)}
        onCircleClick={() => onCircleClick(match.id)}
        isExpanded={isExpanded}
        expandContent={renderExpandContent(match)}
      />
    </div>
  );
};

export default DesktopCard;
