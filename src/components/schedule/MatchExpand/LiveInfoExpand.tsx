/**
 * LiveInfoExpand - Read-only info panel for running matches
 *
 * Displays live match info without editing capability:
 * - LIVE badge with timer
 * - Large score display (read-only)
 * - Recent events (last 3-5)
 * - "Go to Cockpit" button
 *
 * @example
 * ```tsx
 * <LiveInfoExpand
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   homeScore={2}
 *   awayScore={1}
 *   elapsedFormatted="07:30"
 *   events={matchEvents}
 *   onNavigateToCockpit={() => navigate(`/cockpit/${matchId}`)}
 * />
 * ```
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../ui/Button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface MatchEvent {
  id: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'TIME_PENALTY' | 'SUBSTITUTION' | 'FOUL' | 'STATUS_CHANGE' | 'RESULT_EDIT';
  teamId?: string;
  teamName?: string;
  timestampSeconds: number;
  playerNumber?: number;
  direction?: 'INC' | 'DEC';
}

export interface LiveInfoExpandProps {
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Current home score */
  homeScore: number;
  /** Current away score */
  awayScore: number;
  /** Formatted elapsed time (e.g., "07:30") */
  elapsedFormatted: string;
  /** Recent match events */
  events?: MatchEvent[];
  /** Maximum events to display */
  maxEvents?: number;
  /** Callback to navigate to cockpit */
  onNavigateToCockpit: () => void;
  /** Callback to close the expand */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEventTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function getEventIcon(type: MatchEvent['type']): string {
  switch (type) {
    case 'GOAL':
      return '⚽';
    case 'YELLOW_CARD':
      return '🟨';
    case 'RED_CARD':
      return '🟥';
    case 'TIME_PENALTY':
      return '⏱️';
    case 'SUBSTITUTION':
      return '🔄';
    case 'FOUL':
      return '⚠️';
    default:
      return '📝';
  }
}

function getEventLabel(event: MatchEvent, homeTeam: Team, awayTeam: Team): string {
  const teamName = event.teamName || (event.teamId === homeTeam.id ? homeTeam.name : awayTeam.name);
  const playerInfo = event.playerNumber ? ` #${event.playerNumber}` : '';

  switch (event.type) {
    case 'GOAL':
      return `Tor ${teamName}${playerInfo}`;
    case 'YELLOW_CARD':
      return `Gelbe Karte ${teamName}${playerInfo}`;
    case 'RED_CARD':
      return `Rote Karte ${teamName}${playerInfo}`;
    case 'TIME_PENALTY':
      return `Zeitstrafe ${teamName}${playerInfo}`;
    case 'SUBSTITUTION':
      return `Wechsel ${teamName}`;
    case 'FOUL':
      return `Foul ${teamName}`;
    default:
      return event.type;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LiveInfoExpand: React.FC<LiveInfoExpandProps> = ({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  elapsedFormatted,
  events = [],
  maxEvents = 5,
  onNavigateToCockpit,
  onClose,
}) => {
  // Get recent events (excluding STATUS_CHANGE and RESULT_EDIT)
  const displayableEvents = events
    .filter((e) => e.type !== 'STATUS_CHANGE' && e.type !== 'RESULT_EDIT')
    .sort((a, b) => b.timestampSeconds - a.timestampSeconds)
    .slice(0, maxEvents);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const liveBadgeStyle: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    backgroundColor: cssVars.colors.liveBadgeBg,
    color: cssVars.colors.liveBadge,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.bold,
    padding: `${cssVars.spacing.xs} ${cssVars.spacing.sm}`,
    borderRadius: cssVars.borderRadius.sm,
  };

  const liveDotStyle: CSSProperties = {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: cssVars.colors.liveBadge,
    animation: 'pulse 2s ease-in-out infinite',
  };

  const timerStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.primary,
    fontVariantNumeric: 'tabular-nums',
  };

  const scoreContainerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
  };

  const teamScoreStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    minWidth: '80px',
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '100px',
  };

  const scoreValueStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: 900,
    color: cssVars.colors.textPrimary,
    lineHeight: 1,
  };

  const scoreSeparatorStyle: CSSProperties = {
    fontSize: '24px',
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textSecondary,
  };

  const eventsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const eventsHeaderStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const eventItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
  };

  const eventIconStyle: CSSProperties = {
    fontSize: '14px',
    flexShrink: 0,
  };

  const eventTextStyle: CSSProperties = {
    flex: 1,
    color: cssVars.colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const eventTimeStyle: CSSProperties = {
    color: cssVars.colors.textSecondary,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  };

  const noEventsStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.sm,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.sm,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'flex-end',
    paddingTop: cssVars.spacing.sm,
    borderTop: `1px solid ${cssVars.colors.border}`,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Header with LIVE badge and timer */}
      <div style={headerStyle}>
        <span style={liveBadgeStyle}>
          <span style={liveDotStyle} />
          LIVE
        </span>
        <span style={timerStyle}>{elapsedFormatted}</span>
      </div>

      {/* Large Score Display */}
      <div style={scoreContainerStyle}>
        <div style={teamScoreStyle}>
          <span style={teamNameStyle}>{homeTeam.name}</span>
          <span style={scoreValueStyle}>{homeScore}</span>
        </div>
        <span style={scoreSeparatorStyle}>:</span>
        <div style={teamScoreStyle}>
          <span style={teamNameStyle}>{awayTeam.name}</span>
          <span style={scoreValueStyle}>{awayScore}</span>
        </div>
      </div>

      {/* Recent Events */}
      <div style={eventsContainerStyle}>
        <span style={eventsHeaderStyle}>Letzte Ereignisse</span>
        {displayableEvents.length > 0 ? (
          displayableEvents.map((event) => (
            <div key={event.id} style={eventItemStyle}>
              <span style={eventIconStyle}>{getEventIcon(event.type)}</span>
              <span style={eventTextStyle}>
                {getEventLabel(event, homeTeam, awayTeam)}
              </span>
              <span style={eventTimeStyle}>
                {formatEventTime(event.timestampSeconds)}
              </span>
            </div>
          ))
        ) : (
          <div style={noEventsStyle}>Noch keine Ereignisse</div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={actionsStyle}>
        {onClose && (
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            Schließen
          </Button>
        )}
        <Button
          variant="primary"
          size="md"
          onClick={onNavigateToCockpit}
        >
          → Zum Cockpit
        </Button>
      </div>
    </div>
  );
};

export default LiveInfoExpand;
