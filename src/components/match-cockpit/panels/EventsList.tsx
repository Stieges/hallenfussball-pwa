/**
 * EventsList - Match events log with undo functionality
 *
 * MF-004: Accessibility improvements - semantic HTML with ul/li
 */

import { CSSProperties } from 'react';
import { borderRadius, colors, fontSizes, fontWeights, spacing } from '../../../design-tokens';
import { Button } from '../../ui';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { formatTime } from '../utils/matchPanelUtils';

export interface MatchEvent {
  id: string;
  time: number;
  type: string;
  payload: {
    teamId?: string;
    teamName?: string;
    direction?: 'INC' | 'DEC';
    newHomeScore?: number;
    newAwayScore?: number;
    toStatus?: string;
    to?: string;
    /** Spieler-Rückennummer (Torschütze, Karte, Strafe) */
    playerNumber?: number;
    /** Assists bei Toren (max 2) */
    assists?: number[];
    /** Dauer der Zeitstrafe in Sekunden */
    penaltyDuration?: number;
    /** Ausgewechselte Spieler */
    playersOut?: number[];
    /** Eingewechselte Spieler */
    playersIn?: number[];
    /** Kartentyp */
    cardType?: 'YELLOW' | 'RED';
  };
  scoreAfter: { home: number; away: number };
}

export interface EventsListProps {
  events: MatchEvent[];
  onUndo(): void;
  onManualEdit(): void;
}

export const EventsList: React.FC<EventsListProps> = ({ events, onUndo, onManualEdit }) => {
  const isMobile = useIsMobile();

  const containerStyle: CSSProperties = {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTop: `1px dashed ${colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.sm,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'stretch' : 'center',
    gap: spacing.sm,
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? fontSizes.md : fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: colors.textSecondary,
  };

  // MF-004: Semantic list styles (ul without default styling)
  const listStyle: CSSProperties = {
    maxHeight: isMobile ? '200px' : '140px',
    overflowY: 'auto',
    paddingRight: spacing.xs,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    paddingInlineStart: 0,
  };

  const getEventItemStyle = (eventType: string): CSSProperties => {
    let backgroundColor: string = 'transparent';
    let borderColor: string = colors.border;

    if (eventType === 'GOAL') {
      backgroundColor = colors.eventGoalBg;
      borderColor = colors.eventGoalBorder;
    } else if (eventType === 'STATUS_CHANGE') {
      backgroundColor = colors.eventStatusBg;
      borderColor = colors.eventStatusBorder;
    } else if (eventType === 'RESULT_EDIT') {
      backgroundColor = colors.eventEditBg;
      borderColor = colors.eventEditBorder;
    } else if (eventType === 'YELLOW_CARD') {
      backgroundColor = colors.warningBannerBg;
      borderColor = colors.warning;
    } else if (eventType === 'RED_CARD') {
      backgroundColor = colors.dangerGradientStart;
      borderColor = colors.error;
    } else if (eventType === 'TIME_PENALTY') {
      backgroundColor = colors.warningBannerBg;
      borderColor = colors.warning;
    } else if (eventType === 'SUBSTITUTION') {
      backgroundColor = colors.surfaceElevated;
      borderColor = colors.border;
    } else if (eventType === 'FOUL') {
      backgroundColor = colors.surfaceElevated;
      borderColor = colors.border;
    }

    return {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: spacing.sm,
      padding: `${spacing.xs} ${spacing.sm}`,
      fontSize: fontSizes.sm,
      borderBottom: `1px dashed ${borderColor}`,
      backgroundColor,
      borderRadius: borderRadius.sm,
      marginBottom: '2px',
    };
  };

  const timeStyle: CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    color: colors.textSecondary,
    fontSize: fontSizes.xs,
    minWidth: '54px',
  };

  const descStyle: CSSProperties = {
    flex: 1,
  };

  const scoreStyle: CSSProperties = {
    fontWeight: fontWeights.semibold,
    color: colors.textPrimary,
    fontSize: fontSizes.xs,
  };

  const getEventDescription = (event: MatchEvent) => {
    const { teamName, playerNumber, assists, playersOut, playersIn, penaltyDuration } = event.payload;
    // DEF-004: Robust fallback for missing teamName
    const displayName = teamName || 'Unbekanntes Team';
    const playerInfo = playerNumber ? ` #${playerNumber}` : '';

    if (event.type === 'GOAL') {
      const { direction } = event.payload;
      if (direction === 'INC') {
        let goalText = `⚽ Tor für ${displayName}${playerInfo}`;
        // Show assists if present
        if (assists && assists.length > 0) {
          const assistText = assists.map(a => `#${a}`).join(', ');
          goalText += ` (Assist: ${assistText})`;
        }
        return goalText;
      } else {
        return `↩️ Tor zurückgenommen bei ${displayName}`;
      }
    } else if (event.type === 'RESULT_EDIT') {
      return '✏️ Ergebnis manuell korrigiert';
    } else if (event.type === 'STATUS_CHANGE') {
      const toStatus = event.payload.toStatus || event.payload.to;
      switch (toStatus) {
        case 'RUNNING':
          return '▶️ Spiel gestartet';
        case 'PAUSED':
          return '⏸️ Spiel pausiert';
        case 'FINISHED':
          return '🏁 Spiel beendet';
        default:
          return `Status: ${toStatus}`;
      }
    } else if (event.type === 'YELLOW_CARD') {
      return `🟨 Gelbe Karte ${displayName}${playerInfo}`;
    } else if (event.type === 'RED_CARD') {
      return `🟥 Rote Karte ${displayName}${playerInfo}`;
    } else if (event.type === 'TIME_PENALTY') {
      const duration = penaltyDuration ? Math.floor(penaltyDuration / 60) : 2;
      return `⏱ ${duration} Min Zeitstrafe ${displayName}${playerInfo}`;
    } else if (event.type === 'SUBSTITUTION') {
      if (playersOut?.length || playersIn?.length) {
        const outInfo = playersOut?.map(n => `#${n}`).join(',') ?? '?';
        const inInfo = playersIn?.map(n => `#${n}`).join(',') ?? '?';
        return `🔄 Wechsel ${displayName}: ${outInfo} → ${inInfo}`;
      }
      return `🔄 Wechsel ${displayName}`;
    } else if (event.type === 'FOUL') {
      return `⚠ Foul ${displayName}`;
    }
    return 'Ereignis';
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div style={titleStyle}>Spielereignisse</div>
        <div style={{
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          gap: spacing.xs,
          width: isMobile ? '100%' : 'auto'
        }}>
          <Button
            variant="secondary"
            size={isMobile ? "md" : "sm"}
            onClick={onManualEdit}
            style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto' }}
          >
            Ergebnis manuell anpassen
          </Button>
          <Button
            variant="danger"
            size={isMobile ? "md" : "sm"}
            onClick={onUndo}
            disabled={events.length === 0}
            style={{ flex: isMobile ? '1' : '0 1 auto', minHeight: isMobile ? '48px' : 'auto' }}
          >
            Letztes Ereignis zurücknehmen
          </Button>
        </div>
      </div>
      {/* MF-004: Semantic list with aria-live for new events */}
      <ul style={listStyle} aria-label="Spielereignisse" aria-live="polite">
        {events
          .slice()
          .reverse()
          .map((event) => (
            <li
              key={event.id}
              style={getEventItemStyle(event.type)}
              aria-label={`${formatTime(event.time)}: ${getEventDescription(event)}, Stand ${event.scoreAfter.home}:${event.scoreAfter.away}`}
            >
              <span style={timeStyle}>{formatTime(event.time)}</span>
              <span style={descStyle}>{getEventDescription(event)}</span>
              <span style={scoreStyle}>
                {event.scoreAfter.home}:{event.scoreAfter.away}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
};
