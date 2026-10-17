/**
 * MatchCard - Mobile match card for schedule view (@OB-064, Mockup Variante D "Tore je Zeile")
 *
 * ┌────────────────────────────────────┐
 * │ 14:20            Feld 1 • beendet  │
 * ├────────────────────────────────────┤
 * │ [AVA] Team Name A               2  │
 * │ [AVA] Team Name B               1  │
 * └────────────────────────────────────┘
 *
 * Features:
 * - Tap on card → Expand for score editing
 * - Tap on goals → Status-specific action (Start, Live-Info, Zusammenfassung)
 * - Tore je Zeile, Strafstoß kleiner daneben, Sieger fett (TeamScoreRows)
 * - Kopfzeile: Live-Kennzeichen mit Spielzeit, „beendet i. E.“ / „n. V.“ (MatchCardHeader)
 */

import { type CSSProperties, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import type { MatchCardStatus } from './MatchCardScore';
import { MatchCardHeader } from './MatchCardHeader';
import { TeamScoreRows } from './TeamScoreRows';
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
  /** Spielzeit eines laufenden Spiels (z. B. "07:30") für die Kopfzeile */
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
  /** Whether the match has events (goals, cards, etc.) - shows chevron indicator */
  hasEvents?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MatchCard: React.FC<MatchCardProps> = ({
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
  onCardClick,
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

  const handleCardClick = useCallback(
    (e: React.MouseEvent) => {
      // Prevent click if clicking on score circle or expand content
      const target = e.target as HTMLElement;
      if (target.closest('[data-score-circle]') || target.closest('[data-expand-content]')) {
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

  const bodyStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    gap: cssVars.spacing.md,
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
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty matchNumber should display as empty
      aria-label={t('matchCard.ariaLabel', { matchNumber: matchNumber || '', homeTeam: homeTeam.name, awayTeam: awayTeam.name })}
      data-match-card
    >
      <MatchCardHeader
        scheduledTime={scheduledTime}
        field={field}
        group={group}
        showGroupLabel={showGroupLabel}
        referee={referee}
        status={status}
        result={result}
        elapsedFormatted={elapsedFormatted}
      />

      {/* Body: Teams, Tore je Zeile + Events Indicator */}
      <div style={bodyStyle}>
        <TeamScoreRows
          matchId={matchId}
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          result={result}
          status={status}
          onScoreClick={handleCircleClick}
          disabled={disabled}
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

      {/* Expand Content */}
      {isExpanded && expandContent && (
        <div style={expandStyle} data-expand-content>
          {expandContent}
        </div>
      )}

    </div>
  );
};

export default MatchCard;
