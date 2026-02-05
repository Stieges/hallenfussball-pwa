/**
 * DesktopCard - Desktop card for normal view (no DnD)
 *
 * Extracted from GroupStageSchedule.tsx for better maintainability.
 * Wraps MatchCardDesktop with expand functionality.
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../design-tokens'
import { ScheduledMatch } from '../../core/generators';
import { Tournament } from '../../types/tournament';
import { getGroupShortCode } from '../../utils/displayNames';
import { getTeamForDisplay } from '../../utils/teamHelpers';
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
  /** Whether to show group label (hide for single-group tournaments) */
  showGroupLabel?: boolean;
  /** Callback when card body is clicked */
  onCardClick: (matchId: string) => void;
  /** Callback when score circle is clicked */
  onCircleClick: (matchId: string) => void;
  /** Render function for expand content */
  renderExpandContent: (match: ScheduledMatch) => React.ReactNode;
  /** Whether the match has events (goals, cards, etc.) - shows chevron indicator */
  hasEvents?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DesktopCard: React.FC<DesktopCardProps> = ({
  match,
  status,
  isExpanded,
  tournament,
  showGroupLabel = true,
  onCardClick,
  onCircleClick,
  renderExpandContent,
  hasEvents = false,
}) => {
  const { t } = useTranslation('tournament');

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
        referee={match.referee ? t('matchCard.refereeSR', { referee: match.referee }) : undefined}
        group={match.label ?? (match.group ? getGroupShortCode(match.group, tournament) : undefined)}
        showGroupLabel={showGroupLabel}
        homeTeam={getTeamForDisplay(tournament?.teams, match.originalTeamA, match.homeTeam)}
        awayTeam={getTeamForDisplay(tournament?.teams, match.originalTeamB, match.awayTeam)}
        homeScore={match.scoreA ?? 0}
        awayScore={match.scoreB ?? 0}
        status={status}
        progress={0}
        onRowClick={() => onCardClick(match.id)}
        onCircleClick={() => onCircleClick(match.id)}
        isExpanded={isExpanded}
        expandContent={renderExpandContent(match)}
        hasEvents={hasEvents}
      />
    </div>
  );
};

export default DesktopCard;
