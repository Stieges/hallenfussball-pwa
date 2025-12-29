/**
 * Sidebar - Penalties + Event Log (Desktop only)
 *
 * Based on mockup: scoreboard-desktop.html
 * Shows active time penalties and event history
 */

import { type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActivePenalty {
  eventId: string;
  teamId: string;
  playerNumber?: number;
  remainingSeconds: number;
}

interface MatchEvent {
  id: string;
  type: string;
  timestampSeconds: number;
  payload?: {
    teamId?: string;
    teamName?: string;
    playerNumber?: number;
    direction?: 'INC' | 'DEC';
    penaltyDuration?: number;
    cardType?: 'YELLOW' | 'RED';
  };
  /** Event wurde ohne Details erfasst - muss nachgetragen werden */
  incomplete?: boolean;
}

export interface SidebarProps {
  activePenalties: ActivePenalty[];
  events: MatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Callback when an incomplete event is clicked for editing */
  onEventClick?: (eventId: string) => void;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sidebar: React.FC<SidebarProps> = ({
  activePenalties,
  events,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  onEventClick,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.md,
  };

  const panelStyle: CSSProperties = {
    background: colors.surfaceSolid,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  };

  const panelTitleStyle: CSSProperties = {
    fontSize: '11px',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: spacing.md,
  };

  // ---------------------------------------------------------------------------
  // Penalty Card
  // ---------------------------------------------------------------------------

  const penaltyCardStyle: CSSProperties = {
    background: colors.warningBannerBg,
    borderLeft: `3px solid ${colors.warning}`,
    borderRadius: `0 ${borderRadius.sm} ${borderRadius.sm} 0`,
    padding: `${spacing.sm} ${spacing.md}`,
    marginBottom: spacing.sm,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: fontSizes.sm,
  };

  const penaltyTimerStyle: CSSProperties = {
    color: colors.warning,
    fontWeight: fontWeights.bold,
    fontVariantNumeric: 'tabular-nums',
  };

  const getTeamName = (teamId: string): string => {
    if (teamId === homeTeamId) {return homeTeamName;}
    if (teamId === awayTeamId) {return awayTeamName;}
    return teamId;
  };

  // ---------------------------------------------------------------------------
  // Event Log
  // ---------------------------------------------------------------------------

  const logEntryStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${spacing.sm} 0`,
    borderBottom: `1px solid ${colors.borderSolid}`,
    fontSize: fontSizes.sm,
  };

  const logEntryClickableStyle: CSSProperties = {
    ...logEntryStyle,
    cursor: 'pointer',
    backgroundColor: colors.warningHighlight, // subtle warning highlight
    margin: `0 -${spacing.sm}`,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderBottom: 'none',
    marginBottom: spacing.xs,
    transition: 'background-color 0.15s ease',
  };

  const logTimeStyle: CSSProperties = {
    color: colors.textMuted,
    fontVariantNumeric: 'tabular-nums',
  };

  const incompleteWarningStyle: CSSProperties = {
    color: colors.warning,
    marginLeft: spacing.xs,
    fontSize: fontSizes.sm,
  };

  const getEventIcon = (type: string): string => {
    switch (type) {
      case 'GOAL': return '⚽';
      case 'YELLOW_CARD': return '🟨';
      case 'RED_CARD': return '🟥';
      case 'TIME_PENALTY': return '⏱';
      case 'SUBSTITUTION': return '🔄';
      case 'FOUL': return '⚠';
      default: return '•';
    }
  };

  const getEventDescription = (event: MatchEvent): string => {
    const teamName = event.payload?.teamName ??
      (event.payload?.teamId === homeTeamId ? homeTeamName : awayTeamName);
    const playerInfo = event.payload?.playerNumber ? ` (#${event.payload.playerNumber})` : '';

    switch (event.type) {
      case 'GOAL':
        return event.payload?.direction === 'DEC'
          ? `−1 ${teamName}`
          : `TOR ${teamName}${playerInfo}`;
      case 'YELLOW_CARD':
        return `Gelb ${teamName}${playerInfo}`;
      case 'RED_CARD':
        return `Rot ${teamName}${playerInfo}`;
      case 'TIME_PENALTY':
        return `2 Min ${teamName}${playerInfo}`;
      case 'SUBSTITUTION':
        return `Wechsel ${teamName}`;
      case 'FOUL':
        return `Foul ${teamName}`;
      default:
        return event.type;
    }
  };

  // Show most recent events first, limit to 10
  const recentEvents = [...events].reverse().slice(0, 10);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Active Penalties */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Aktive Zeitstrafen</div>
        {activePenalties.length === 0 ? (
          <div style={{ color: colors.textMuted, fontSize: fontSizes.sm }}>
            Keine aktiven Strafen
          </div>
        ) : (
          activePenalties.map((penalty) => (
            <div key={penalty.eventId} style={penaltyCardStyle}>
              <span>
                #{penalty.playerNumber ?? '?'} {getTeamName(penalty.teamId)}
              </span>
              <span style={penaltyTimerStyle}>
                {formatTime(penalty.remainingSeconds)}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Event Log */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>Ereignisse</div>
        {recentEvents.length === 0 ? (
          <div style={{ color: colors.textMuted, fontSize: fontSizes.sm }}>
            Noch keine Ereignisse
          </div>
        ) : (
          recentEvents.map((event, index) => {
            const isIncomplete = event.incomplete === true;
            const isClickable = isIncomplete && onEventClick;
            const isLastItem = index === recentEvents.length - 1;

            const entryStyle = isClickable
              ? logEntryClickableStyle
              : {
                  ...logEntryStyle,
                  borderBottom: isLastItem ? 'none' : logEntryStyle.borderBottom,
                };

            return (
              <div
                key={event.id}
                style={entryStyle}
                onClick={isClickable ? () => onEventClick(event.id) : undefined}
                role={isClickable ? 'button' : undefined}
                tabIndex={isClickable ? 0 : undefined}
                onKeyDown={
                  isClickable
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onEventClick(event.id);
                        }
                      }
                    : undefined
                }
              >
                <span>
                  {getEventIcon(event.type)} {getEventDescription(event)}
                  {isIncomplete && <span style={incompleteWarningStyle}>⚠️</span>}
                </span>
                <span style={logTimeStyle}>{formatTime(event.timestampSeconds)}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
