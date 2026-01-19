/**
 * Sidebar - Penalties + Event Log (Desktop only)
 *
 * Based on mockup: scoreboard-desktop.html
 * Shows active time penalties and event history
 *
 * BUG-010: Added edit functionality for all events
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens'
import type { ActivePenalty, RuntimeMatchEvent } from '../../../../types/tournament';

export interface SidebarProps {
  activePenalties: ActivePenalty[];
  events: RuntimeMatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** BUG-010: Callback when edit button is clicked on any event */
  onEventEdit?: (event: RuntimeMatchEvent) => void;
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
  onEventEdit,
}) => {
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const panelStyle: CSSProperties = {
    background: cssVars.colors.surfaceSolid,
    borderRadius: cssVars.borderRadius.lg,
    padding: cssVars.spacing.md,
  };

  const panelTitleStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: cssVars.spacing.md,
  };

  // ---------------------------------------------------------------------------
  // Penalty Card
  // ---------------------------------------------------------------------------

  const penaltyCardStyle: CSSProperties = {
    background: cssVars.colors.warningBannerBg,
    borderLeft: `3px solid ${cssVars.colors.warning}`,
    borderRadius: `0 ${cssVars.borderRadius.sm} ${cssVars.borderRadius.sm} 0`,
    padding: `${cssVars.spacing.sm} ${cssVars.spacing.md}`,
    marginBottom: cssVars.spacing.sm,
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: cssVars.fontSizes.sm,
  };

  const penaltyTimerStyle: CSSProperties = {
    color: cssVars.colors.warning,
    fontWeight: cssVars.fontWeights.bold,
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
    padding: `${cssVars.spacing.sm} 0`,
    borderBottom: `1px solid ${cssVars.colors.borderSolid}`,
    fontSize: cssVars.fontSizes.sm,
  };

  const logTimeStyle: CSSProperties = {
    color: cssVars.colors.textMuted,
    fontVariantNumeric: 'tabular-nums',
  };

  const incompleteWarningStyle: CSSProperties = {
    color: cssVars.colors.warning,
    marginLeft: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
  };

  // BUG-010: Edit button style
  const editButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: cssVars.spacing.xs,
    cursor: 'pointer',
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textMuted,
    borderRadius: cssVars.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'color 0.15s ease',
    minWidth: 28,
    minHeight: 28,
  };

  const logEntryRightStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
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

  const getEventDescription = (event: RuntimeMatchEvent): string => {
    const teamName = event.payload.teamName ??
      (event.payload.teamId === homeTeamId ? homeTeamName : awayTeamName);
    const playerInfo = event.payload.playerNumber ? ` #${event.payload.playerNumber}` : '';

    switch (event.type) {
      case 'GOAL': {
        if (event.payload.direction === 'DEC') {
          return `−1 ${teamName}`;
        }
        // Build goal description with player and assists
        let goalText = `TOR ${teamName}${playerInfo}`;
        // Show assists if present
        const assists = event.payload.assists;
        if (assists && assists.length > 0) {
          const assistText = assists.map(a => `#${a}`).join(', ');
          goalText += ` (Assist: ${assistText})`;
        }
        return goalText;
      }
      case 'YELLOW_CARD':
        return `Gelb ${teamName}${playerInfo}`;
      case 'RED_CARD':
        return `Rot ${teamName}${playerInfo}`;
      case 'TIME_PENALTY': {
        const duration = event.payload.penaltyDuration
          ? Math.floor(event.payload.penaltyDuration / 60)
          : 2;
        return `${duration} Min ${teamName}${playerInfo}`;
      }
      case 'SUBSTITUTION': {
        // Show player numbers if available
        const playersOut = event.payload.playersOut;
        const playersIn = event.payload.playersIn;
        if (playersOut?.length || playersIn?.length) {
          const outInfo = playersOut?.map(n => `#${n}`).join(',') ?? '?';
          const inInfo = playersIn?.map(n => `#${n}`).join(',') ?? '?';
          return `🔄 ${teamName}: ${outInfo} → ${inInfo}`;
        }
        return `Wechsel ${teamName}`;
      }
      case 'FOUL':
        return `Foul ${teamName}`;
      case 'STATUS_CHANGE': {
        // Show descriptive label for status changes
        const toStatus = event.payload.toStatus;
        switch (toStatus) {
          case 'RUNNING': return 'Spiel gestartet';
          case 'PAUSED': return 'Spiel pausiert';
          case 'FINISHED': return 'Spiel beendet';
          default: return `Status: ${toStatus}`;
        }
      }
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
          <div style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
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
          <div style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
            Noch keine Ereignisse
          </div>
        ) : (
          recentEvents.map((event, index) => {
            const isIncomplete = event.incomplete === true;
            // BUG-010: All events are now editable if onEventEdit is provided
            const canEdit = !!onEventEdit;
            const isLastItem = index === recentEvents.length - 1;

            const entryStyle = {
              ...logEntryStyle,
              borderBottom: isLastItem ? 'none' : logEntryStyle.borderBottom,
            };

            const handleEditClick = (e: React.MouseEvent) => {
              e.stopPropagation();
              if (onEventEdit) {
                onEventEdit(event);
              }
            };

            return (
              <div
                key={event.id}
                style={entryStyle}
              >
                <span>
                  {getEventIcon(event.type)} {getEventDescription(event)}
                  {isIncomplete && <span style={incompleteWarningStyle}>⚠️</span>}
                </span>
                <div style={logEntryRightStyle}>
                  <span style={logTimeStyle}>{formatTime(event.timestampSeconds)}</span>
                  {/* BUG-010: Edit button for all events */}
                  {canEdit && (
                    <button
                      style={editButtonStyle}
                      onClick={handleEditClick}
                      aria-label={`${getEventDescription(event)} bearbeiten`}
                      title="Bearbeiten"
                    >
                      ✏️
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Sidebar;
