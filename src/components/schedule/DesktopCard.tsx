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
import type { ScheduleSource } from './scheduleSource';
import { getGroupShortCode } from '../../utils/displayNames';
import { buildSideContext, matchHeading, matchViewOf, sideDisplay, type SideContext } from './matchSides';
import { resultFigures } from './matchResult';
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
  tournament?: ScheduleSource;
  /** Kontext der Spielseiten-Anzeige (Teams, Vorgängerspiele); ohne Angabe aus `tournament` gebaut */
  sideContext?: SideContext;
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
  /** Spielzeit eines laufenden Spiels, z. B. „07:30“ */
  elapsedFormatted?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DesktopCard: React.FC<DesktopCardProps> = ({
  match,
  status,
  isExpanded,
  tournament,
  sideContext,
  showGroupLabel = true,
  onCardClick,
  onCircleClick,
  renderExpandContent,
  hasEvents = false,
  elapsedFormatted,
}) => {
  const { t } = useTranslation('tournament');
  const sides = sideContext ?? buildSideContext(tournament, [match]);
  const matchView = matchViewOf(sides, match.id);

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
        group={matchHeading(match, sides) ?? (match.group ? getGroupShortCode(match.group, tournament) : undefined)}
        showGroupLabel={showGroupLabel}
        homeTeam={sideDisplay(match, 'A', sides)}
        awayTeam={sideDisplay(match, 'B', sides)}
        result={resultFigures(matchView?.score, status)}
        status={status}
        elapsedFormatted={elapsedFormatted}
        viewStatus={matchView?.status}
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
