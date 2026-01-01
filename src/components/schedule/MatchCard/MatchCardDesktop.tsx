/**
 * MatchCardDesktop - Horizontal row layout for desktop schedule view
 *
 * Row-based layout for desktop:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 09:00 │ Feld 1 │ [AVA] Team A      ┌────┐      Team B [AVA] │ Gr. A │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Hover states for row and score circle
 * - Click on row → Expand for editing
 * - Click on circle → Status-specific action
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

export interface MatchCardDesktopProps {
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
  /** Callback when row is clicked */
  onRowClick?: () => void;
  /** Callback when score circle is clicked */
  onCircleClick?: () => void;
  /** Whether row is in expanded state */
  isExpanded?: boolean;
  /** Expand content (rendered below row) */
  expandContent?: React.ReactNode;
  /** Disable interactions */
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MatchCardDesktop: React.FC<MatchCardDesktopProps> = ({
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
  onRowClick,
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

  const handleRowClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-score-circle]') || target.closest('[data-expand-content]')) {
        return;
      }

      if (!disabled && onRowClick) {
        onRowClick();
      }
    },
    [disabled, onRowClick]
  );

  const handleCircleClick = useCallback(() => {
    if (!disabled && onCircleClick) {
      onCircleClick();
    }
  }, [disabled, onCircleClick]);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    borderRadius: cssVars.borderRadius.md,
    overflow: 'hidden',
    border: `1px solid ${isLive ? cssVars.colors.borderActive : cssVars.colors.border}`,
  };

  const rowStyle: CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'auto auto 1fr auto 1fr auto',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    backgroundColor: isLive
      ? undefined
      : isHovered && !disabled
        ? cssVars.colors.surfaceHover
        : cssVars.colors.surface,
    background: isLive
      ? `linear-gradient(135deg, ${cssVars.colors.primaryMedium}, ${cssVars.colors.surface})`
      : undefined,
    cursor: disabled ? 'default' : 'pointer',
    transition: 'background-color 0.15s ease',
  };

  const timeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    color: isLive ? cssVars.colors.primary : cssVars.colors.textSecondary,
    fontVariantNumeric: 'tabular-nums',
    minWidth: '50px',
  };

  const fieldStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    minWidth: '60px',
  };

  const teamStyle = (align: 'left' | 'right'): CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
  });

  const avatarStyle: CSSProperties = {
    width: 32,
    height: 32,
    borderRadius: cssVars.borderRadius.sm,
    backgroundColor: cssVars.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: cssVars.fontSizes.xs,
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

  const groupStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textAlign: 'right',
    minWidth: '50px',
  };

  const liveBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    backgroundColor: cssVars.colors.primaryLight,
    color: cssVars.colors.primary,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.bold,
    padding: `2px 6px`,
    borderRadius: cssVars.borderRadius.sm,
    marginLeft: cssVars.spacing.sm,
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
    <div style={containerStyle}>
      <div
        style={rowStyle}
        onClick={handleRowClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        role="row"
        aria-label={`Spiel ${matchNumber || ''}: ${homeTeam.name} gegen ${awayTeam.name}`}
      >
        {/* Time */}
        <div style={timeStyle}>
          {formatTime(scheduledTime)}
          {isLive && (
            <span style={liveBadgeStyle}>
              <span style={liveDotStyle} />
              LIVE
            </span>
          )}
        </div>

        {/* Field */}
        <div style={fieldStyle}>
          {field !== undefined ? `Feld ${field}` : ''}
        </div>

        {/* Home Team (right-aligned) */}
        <div style={teamStyle('right')}>
          <span style={teamNameStyle}>{homeTeam.name}</span>
          <div style={avatarStyle}>
            {getTeamInitials(homeTeam.name)}
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
            size={52}
            onClick={handleCircleClick}
            disabled={disabled}
          />
        </div>

        {/* Away Team (left-aligned) */}
        <div style={teamStyle('left')}>
          <div style={avatarStyle}>
            {getTeamInitials(awayTeam.name)}
          </div>
          <span style={teamNameStyle}>{awayTeam.name}</span>
        </div>

        {/* Group */}
        <div style={groupStyle}>
          {showGroupLabel && group && group !== 'all' ? `Gr. ${group}` : ''}
        </div>
      </div>

      {/* Expand Content */}
      {isExpanded && expandContent && (
        <div style={expandStyle} data-expand-content>
          {expandContent}
        </div>
      )}

    </div>
  );
};

export default MatchCardDesktop;
