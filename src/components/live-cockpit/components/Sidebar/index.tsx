/**
 * Sidebar - Penalties + Event Log (Desktop only)
 *
 * Based on mockup: scoreboard-desktop.html
 * Shows active time penalties and event history
 *
 * BUG-010: Added edit functionality for all events
 */

import { type CSSProperties } from 'react';
import { colors, spacing, fontSizes, fontWeights, borderRadius } from '../../../../design-tokens';
import type { ActivePenalty, RuntimeMatchEvent } from '../../../../types/tournament';

export interface SidebarProps {
  activePenalties: ActivePenalty[];
  events: RuntimeMatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** @deprecated Use onEventEdit instead */
  onEventClick?: (eventId: string) => void;
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
  onEventClick,
  onEventEdit,
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

  // BUG-010: Edit button style
  const editButtonStyle: CSSProperties = {
    background: 'transparent',
    border: 'none',
    padding: spacing.xs,
    cursor: 'pointer',
    fontSize: fontSizes.sm,
    color: colors.textMuted,
    borderRadius: borderRadius.sm,
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
    gap: spacing.xs,
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
            // BUG-010: All events are now editable if onEventEdit is provided
            const canEdit = !!onEventEdit;
            // Legacy: still support onEventClick for incomplete events
            const isLegacyClickable = isIncomplete && onEventClick && !onEventEdit;
            const isLastItem = index === recentEvents.length - 1;

            const entryStyle = isLegacyClickable
              ? logEntryClickableStyle
              : {
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
                onClick={isLegacyClickable ? () => onEventClick(event.id) : undefined}
                role={isLegacyClickable ? 'button' : undefined}
                tabIndex={isLegacyClickable ? 0 : undefined}
                onKeyDown={
                  isLegacyClickable
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
