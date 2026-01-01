/**
 * MatchCard - Mobile match card for schedule view
 *
 * Card-based layout for mobile devices:
 * ┌────────────────────────────────────┐
 * │ 09:00 Uhr          Feld 1 • Gr. A │
 * ├────────────────────────────────────┤
 * │ [AVA] Team Name A                  │
 * │ [AVA] Team Name B           ┌────┐ │
 * └────────────────────────────────────┘
 *
 * Features:
 * - Tap on card → Expand for score editing
 * - Tap on circle → Status-specific action
 * - Live badge for running matches
 * - Progress ring for live matches
 */

import { type CSSProperties, useState, useCallback } from 'react';
import { cssVars } from '../../../design-tokens'
import { MatchCardScore, type MatchCardStatus } from './MatchCardScore';
import { formatTime, getTeamInitials } from './utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface MatchCardProps {
  /** Unique match ID */
  matchId: string;
  /** Match number (for display) */
  matchNumber?: number;
  /** Scheduled time (ISO string or formatted) */
  scheduledTime?: string;
  /** Field number */
  field?: number;
  /** Group label */
  group?: string;
  /** Whether to show group label (hide for single-group tournaments) */
  showGroupLabel?: boolean;
  /** Home team */
  homeTeam: Team;
  /** Away team */
  awayTeam: Team;
  /** Home score */
  homeScore: number;
  /** Away score */
  awayScore: number;
  /** Match status */
  status: MatchCardStatus;
  /** Progress 0-1 for live matches */
  progress?: number;
  /** Formatted elapsed time */
  elapsedFormatted?: string;
  /** Callback when card body is clicked */
  onCardClick?: () => void;
  /** Callback when score circle is clicked */
  onCircleClick?: () => void;
  /** Whether card is in expanded state */
  isExpanded?: boolean;
  /** Expand content (rendered below card) */
  expandContent?: React.ReactNode;
  /** Disable interactions */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MatchCard: React.FC<MatchCardProps> = ({
  matchId: _matchId,
  matchNumber,
  scheduledTime,
  field,
  group,
  showGroupLabel = true,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  status,
  progress = 0,
  elapsedFormatted,
  onCardClick,
  onCircleClick,
  isExpanded = false,
  expandContent,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  const isLive = status === 'running';

  // ---------------------------------------------------------------------------
  // Event Handlers
  // ---------------------------------------------------------------------------

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent click if clicking on score circle
      const target = e.target as HTMLElement;
      if (target.closest('[data-score-circle]')) {
        return;
      }

      if (!disabled && onCardClick) {
        onCardClick();
      }
    },
    [disabled, onCardClick]
  );

  const handleCircleClick = useCallback(() => {
    if (!disabled && onCircleClick) {
      onCircleClick();
    }
  }, [disabled, onCircleClick]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const cardStyle: CSSProperties = {
    backgroundColor: isLive
      ? `linear-gradient(135deg, ${cssVars.colors.primaryMedium}, ${cssVars.colors.surface})`
      : cssVars.colors.surface,
    background: isLive
      ? `linear-gradient(135deg, ${cssVars.colors.primaryMedium}, ${cssVars.colors.surface})`
      : cssVars.colors.surface,
    border: `1px solid ${isLive ? cssVars.colors.borderActive : cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.lg,
    overflow: 'hidden',
    cursor: disabled ? 'default' : 'pointer',
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    boxShadow: isHovered && !disabled
      ? `0 4px 12px ${cssVars.colors.shadowMedium}`
      : 'none',
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.md}`,
    borderBottom: `1px solid ${cssVars.colors.border}`,
    backgroundColor: cssVars.colors.surfaceDark,
  };

  const timeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: isLive ? cssVars.colors.primary : cssVars.colors.textSecondary,
    fontVariantNumeric: 'tabular-nums',
  };

  const metaStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
  };

  const bodyStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: cssVars.spacing.md,
    gap: cssVars.spacing.md,
  };

  const teamsContainerStyle: CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.sm,
  };

  const teamRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
  };

  const avatarStyle: CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: cssVars.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.onPrimary,
    flexShrink: 0,
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: 800,
    color: cssVars.colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const liveBadgeStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    backgroundColor: cssVars.colors.primaryLight,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    padding: `3px ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
  };

  const liveDotStyle: CSSProperties = {
    width: 6,
    height: 6,
    borderRadius: '50%',
    backgroundColor: cssVars.colors.primary,
    animation: 'pulse 2s ease-in-out infinite',
  };

  const expandStyle: CSSProperties = {
    borderTop: `1px solid ${cssVars.colors.border}`,
    backgroundColor: cssVars.colors.surfaceVariant,
    padding: cssVars.spacing.md,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={cardStyle}
      onClick={handleCardClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="article"
      aria-label={`Spiel ${matchNumber || ''}: ${homeTeam.name} gegen ${awayTeam.name}`}
      data-match-card
    >
      {/* Header: Time, Field, Group, Live Badge */}
      <div style={headerStyle}>
        <span style={timeStyle}>
          {formatTime(scheduledTime)}
        </span>
        <div style={metaStyle}>
          {field !== undefined && <span>Feld {field}</span>}
          {showGroupLabel && group && group !== 'all' && <span>• Gr. {group}</span>}
          {isLive && (
            <span style={liveBadgeStyle}>
              <span style={liveDotStyle} />
              LIVE
            </span>
          )}
        </div>
      </div>

      {/* Body: Teams + Score Circle */}
      <div style={bodyStyle}>
        {/* Teams */}
        <div style={teamsContainerStyle}>
          {/* Home Team */}
          <div style={teamRowStyle}>
            <div style={avatarStyle}>
              {getTeamInitials(homeTeam.name)}
            </div>
            <span style={teamNameStyle}>{homeTeam.name}</span>
          </div>
          {/* Away Team */}
          <div style={teamRowStyle}>
            <div style={avatarStyle}>
              {getTeamInitials(awayTeam.name)}
            </div>
            <span style={teamNameStyle}>{awayTeam.name}</span>
          </div>
        </div>

        {/* Score Circle */}
        <div data-score-circle>
          <MatchCardScore
            homeScore={homeScore}
            awayScore={awayScore}
            status={status}
            progress={progress}
            elapsedFormatted={elapsedFormatted}
            onClick={handleCircleClick}
            disabled={disabled}
          />
        </div>
      </div>

      {/* Expand Content */}
      {isExpanded && expandContent && (
        <div style={expandStyle}>
          {expandContent}
        </div>
      )}

    </div>
  );
};

export default MatchCard;
