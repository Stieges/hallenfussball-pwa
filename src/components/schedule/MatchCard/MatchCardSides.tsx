/**
 * MatchCardSides – die Teams nebeneinander in der Tabellenzeile (Aufgabe 5.1a Spielanzeige, Auslagerung aus
 * `MatchCardDesktop` ohne Sichtänderung): Heim rechtsbündig, das Ergebnis in der Mitte (mit Restzeit), Gast linksbündig.
 * Liefert drei Zellen für das Raster der Zeile (`MatchCardDesktop`).
 */
import { type CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens';
import { TeamAvatar } from '../../ui/TeamAvatar';
import type { SpectatorClock, ViewMatchStatus } from '../../../core/view';
import type { ResultFigures } from '../matchResult';
import { MatchCardScore, type MatchCardStatus } from './MatchCardScore';
import type { Team } from './MatchCardDesktop';

export interface MatchCardSidesProps {
  matchId: string;
  homeTeam: Team;
  awayTeam: Team;
  result: ResultFigures | null;
  status: MatchCardStatus;
  clock?: SpectatorClock | null;
  viewStatus?: ViewMatchStatus;
  onCircleClick: () => void;
  disabled: boolean;
  hasEvents: boolean;
  isExpanded: boolean;
}

const teamStyle = (align: 'left' | 'right'): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: cssVars.spacing.sm,
  justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
});

export const MatchCardSides: React.FC<MatchCardSidesProps> = ({
  matchId, homeTeam, awayTeam, result, status, clock, viewStatus, onCircleClick, disabled, hasEvents, isExpanded,
}) => {
  const isLive = status === 'running';
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

  return (
    <>
      {/* Home Team (right-aligned) */}
      <div style={teamStyle('right')}>
        <span style={teamNameStyle('a')} data-winner={decided && result?.winner === 'a' ? 'true' : undefined}>{homeTeam.name}</span>
        <TeamAvatar team={homeTeam} size="sm" />
      </div>

      {/* Score Circle + Events Indicator */}
      <div data-score-circle style={{ display: 'flex', alignItems: 'center', gap: cssVars.spacing.xs }}>
        <MatchCardScore result={result} status={status} clock={clock} viewStatus={viewStatus} onClick={onCircleClick} disabled={disabled} matchId={matchId} />
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
    </>
  );
};
