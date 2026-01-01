/**
 * EventLogBottomSheet - Mobile Bottom Sheet for Event Log
 *
 * BUG-002: Allows retroactive editing of all events on mobile devices.
 * Desktop has the Sidebar for this, but mobile was missing this capability.
 *
 * Features:
 * - Shows all events (not just incomplete ones)
 * - Edit button for each event
 * - Styled consistently with other bottom sheets
 */

import { type CSSProperties } from 'react';
import { cssVars } from '../../../../design-tokens';
import { BottomSheet } from '../../../ui/BottomSheet';
import type { RuntimeMatchEvent } from '../../../../types/tournament';

interface EventLogBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  events: RuntimeMatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  onEventEdit: (event: RuntimeMatchEvent) => void;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getEventIcon = (type: string): string => {
  switch (type) {
    case 'GOAL': return '⚽';
    case 'YELLOW_CARD': return '🟨';
    case 'RED_CARD': return '🟥';
    case 'TIME_PENALTY': return '⏱';
    case 'SUBSTITUTION': return '🔄';
    case 'FOUL': return '⚠';
    case 'STATUS_CHANGE': return '▶️';
    default: return '•';
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventLogBottomSheet({
  isOpen,
  onClose,
  events,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  onEventEdit,
}: EventLogBottomSheetProps) {
  const getTeamName = (teamId?: string): string => {
    if (teamId === homeTeamId) {return homeTeamName;}
    if (teamId === awayTeamId) {return awayTeamName;}
    return teamId ?? 'Team';
  };

  const getEventDescription = (event: RuntimeMatchEvent): string => {
    const teamName = event.payload.teamName ?? getTeamName(event.payload.teamId);
    const playerInfo = event.payload.playerNumber ? ` #${event.payload.playerNumber}` : '';

    switch (event.type) {
      case 'GOAL': {
        if (event.payload.direction === 'DEC') {
          return `−1 ${teamName}`;
        }
        let goalText = `TOR ${teamName}${playerInfo}`;
        const assists = event.payload.assists;
        if (assists && assists.length > 0) {
          const assistText = assists.map(a => `#${a}`).join(', ');
          goalText += ` (Assist: ${assistText})`;
        }
        return goalText;
      }
      case 'YELLOW_CARD':
        return `Gelbe Karte ${teamName}${playerInfo}`;
      case 'RED_CARD':
        return `Rote Karte ${teamName}${playerInfo}`;
      case 'TIME_PENALTY': {
        const duration = event.payload.penaltyDuration
          ? Math.floor(event.payload.penaltyDuration / 60)
          : 2;
        return `${duration} Min Zeitstrafe ${teamName}${playerInfo}`;
      }
      case 'SUBSTITUTION': {
        const playersOut = event.payload.playersOut;
        const playersIn = event.payload.playersIn;
        if (playersOut?.length || playersIn?.length) {
          const outInfo = playersOut?.map(n => `#${n}`).join(',') ?? '?';
          const inInfo = playersIn?.map(n => `#${n}`).join(',') ?? '?';
          return `Wechsel ${teamName}: ${outInfo} → ${inInfo}`;
        }
        return `Wechsel ${teamName}`;
      }
      case 'FOUL':
        return `Foul ${teamName}`;
      case 'STATUS_CHANGE': {
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

  // Show most recent events first
  const sortedEvents = [...events].reverse();

  // Check if event is editable (not status changes)
  const isEditable = (event: RuntimeMatchEvent): boolean => {
    return event.type !== 'STATUS_CHANGE';
  };

  // Styles
  const listStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
    maxHeight: '60vh',
    overflowY: 'auto',
  };

  const eventRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceElevated,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    minHeight: 56,
  };

  const eventInfoStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    flex: 1,
    overflow: 'hidden',
  };

  const iconStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.lg,
    flexShrink: 0,
  };

  const timeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    fontVariantNumeric: 'tabular-nums',
    color: cssVars.colors.textSecondary,
    flexShrink: 0,
    minWidth: 50,
  };

  const descStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const incompleteStyle: CSSProperties = {
    color: cssVars.colors.warning,
    marginLeft: cssVars.spacing.xs,
  };

  const editButtonStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: cssVars.spacing.sm,
    backgroundColor: cssVars.colors.primary,
    color: cssVars.colors.onPrimary,
    border: 'none',
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minWidth: 80,
    minHeight: 44,
  };

  const emptyStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.xl,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.md,
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title="Ereignisprotokoll"
    >
      {sortedEvents.length === 0 ? (
        <div style={emptyStyle}>
          Noch keine Ereignisse aufgezeichnet
        </div>
      ) : (
        <div style={listStyle}>
          {sortedEvents.map((event) => (
            <div key={event.id} style={eventRowStyle}>
              <div style={eventInfoStyle}>
                <span style={iconStyle}>{getEventIcon(event.type)}</span>
                <span style={timeStyle}>{formatTime(event.timestampSeconds)}</span>
                <span style={descStyle}>
                  {getEventDescription(event)}
                  {event.incomplete && <span style={incompleteStyle}>⚠️</span>}
                </span>
              </div>
              {isEditable(event) && (
                <button
                  style={editButtonStyle}
                  onClick={() => onEventEdit(event)}
                  aria-label={`${getEventDescription(event)} bearbeiten`}
                >
                  ✏️ Bearbeiten
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

export default EventLogBottomSheet;
