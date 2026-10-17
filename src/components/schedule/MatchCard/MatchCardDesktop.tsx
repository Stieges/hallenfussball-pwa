/**
 * MatchCardDesktop - Horizontal row layout for desktop schedule view
 *
 * Row-based layout for desktop:
 * ┌──────────────────────────────────────────────────────────────────────┐
 * │ 09:00 │ Feld 1 │ [AVA] Team A      ┌────┐      Team B [AVA] │ Gr. A │
 * └──────────────────────────────────────────────────────────────────────┘
 *
 * Features:
 * - Hover states for row and result
 * - Click on row → Expand for editing
 * - Click on result → Status-specific action
 * - Ergebnis waagerecht: "2:2 (4:3 i. E.)", "3:2 n. V." (@OB-064), Sieger fett
 */

import { type CSSProperties, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import { MatchCardScore, type MatchCardStatus } from './MatchCardScore';
import { formatTime } from './utils';
import { TeamAvatar } from '../../ui/TeamAvatar';
import type { ResultFigures } from '../matchResult';
import type { TeamLogo, TeamColors } from '../../../types/tournament';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
  logo?: TeamLogo;
  colors?: TeamColors;
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
  /** Referee name */
  referee?: string;
  /** Whether to show group label (hide for single-group tournaments) */
  showGroupLabel?: boolean;
  /** Home team */
  homeTeam: Team;
  /** Away team */
  awayTeam: Team;
  /** Tore, Strafstoß und Sieger (`resultFigures`); `null` für ein geplantes Spiel */
  result?: ResultFigures | null;
  /** Match status */
  status: MatchCardStatus;
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
  /** Whether the match has events (goals, cards, etc.) - shows chevron indicator */
  hasEvents?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MatchCardDesktop: React.FC<MatchCardDesktopProps> = ({
  matchId,
  matchNumber,
  scheduledTime,
  field,
  group,
  referee,
  showGroupLabel = true,
  homeTeam,
  awayTeam,
  result = null,
  status,
  elapsedFormatted,
  onRowClick,
  onCircleClick,
  isExpanded = false,
  expandContent,
  disabled = false,
  hasEvents = false,
}) => {
  const { t } = useTranslation('tournament');
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


  const decided = result?.winner !== undefined && result.winner !== null;
  const teamNameStyle = (side: 'a' | 'b'): CSSProperties => {
    const isWinner = decided && result?.winner === side;
    const isLoser = decided && result?.winner !== side;
    return {
      fontSize: cssVars.fontSizes.lg,
      fontWeight: isWinner ? cssVars.fontWeights.bold : isLoser || status === 'finished' ? cssVars.fontWeights.medium : cssVars.fontWeights.semibold,
      color: isLoser ? cssVars.colors.textSecondary : cssVars.colors.textPrimary,
      // MOBILE-UX: No truncation - team names must be fully visible
      wordBreak: 'break-word',
      overflowWrap: 'break-word',
    };
  };

  const groupStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textAlign: 'right',
    minWidth: '50px',
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
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty matchNumber should display as empty
        aria-label={t('matchCard.ariaLabel', { matchNumber: matchNumber || '', homeTeam: homeTeam.name, awayTeam: awayTeam.name })}
      >
        {/* Time */}
        <div style={timeStyle}>
          {formatTime(scheduledTime)}
          {isLive && (
            <>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: cssVars.spacing.xs,
                backgroundColor: cssVars.colors.statusLiveBg,
                color: cssVars.colors.statusLive,
                fontSize: cssVars.fontSizes.xs,
                fontWeight: cssVars.fontWeights.bold,
                padding: `2px 6px`,
                borderRadius: cssVars.borderRadius.sm,
                marginLeft: cssVars.spacing.sm,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  backgroundColor: cssVars.colors.statusLive,
                  animation: 'pulse 2s ease-in-out infinite',
                }} />
                LIVE
              </span>
              <style>{`
                @keyframes pulse {
                  0% { opacity: 1; transform: scale(1); }
                  50% { opacity: 0.6; transform: scale(1.2); }
                  100% { opacity: 1; transform: scale(1); }
                }
              `}</style>
            </>
          )}
        </div>

        {/* Field */}
        <div style={fieldStyle}>
          {field !== undefined ? t('matchCard.field', { field }) : ''}
          {matchNumber && matchNumber > 0 && referee && (
            <div style={{ fontSize: cssVars.fontSizes.xs, color: cssVars.colors.textMuted }}>{t('matchCard.refereeSR', { referee })}</div>
          )}
        </div>

        {/* Home Team (right-aligned) */}
        <div style={teamStyle('right')}>
          <span style={teamNameStyle('a')} data-winner={decided && result?.winner === 'a' ? 'true' : undefined}>{homeTeam.name}</span>
          <TeamAvatar team={homeTeam} size="sm" />
        </div>

        {/* Score Circle + Events Indicator */}
        <div data-score-circle style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs }}>
          <MatchCardScore
            result={result}
            status={status}
            elapsedFormatted={elapsedFormatted}
            onClick={handleCircleClick}
            disabled={disabled}
            matchId={matchId}
          />
          {/* Chevron indicator for matches with events (shows expandability) */}
          {hasEvents && !isLive && (
            <span
              style={{
                color: cssVars.colors.textMuted,
                fontSize: cssVars.fontSizes.sm,
                transition: 'transform 0.2s ease',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
              aria-hidden="true"
            >
              ▼
            </span>
          )}
        </div>

        {/* Away Team (left-aligned) */}
        <div style={teamStyle('left')}>
          <TeamAvatar team={awayTeam} size="sm" />
          <span style={teamNameStyle('b')} data-winner={decided && result?.winner === 'b' ? 'true' : undefined}>{awayTeam.name}</span>
        </div>

        {/* Group */}
        <div style={groupStyle}>
          {showGroupLabel && group && group !== 'all' ? t('matchCard.groupShort', { group }) : ''}
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
