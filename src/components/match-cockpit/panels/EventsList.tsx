/**
 * EventsList - Match events log with undo functionality
 *
 * MF-004: Accessibility improvements - semantic HTML with ul/li
 */

import { CSSProperties } from 'react';
import { theme } from '../../../styles/theme';
import { Button } from '../../ui';
import { useIsMobile } from '../../../hooks/useIsMobile';
import { formatTime } from '../utils/matchPanelUtils';

export interface MatchEvent {
  id: string;
  time: number;
  type: string;
  payload: any;
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
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTop: `1px dashed ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: isMobile ? 'column' : 'row',
    justifyContent: 'space-between',
    alignItems: isMobile ? 'stretch' : 'center',
    gap: theme.spacing.sm,
  };

  const titleStyle: CSSProperties = {
    fontSize: isMobile ? theme.fontSizes.md : theme.fontSizes.sm,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: theme.colors.text.secondary,
  };

  // MF-004: Semantic list styles (ul without default styling)
  const listStyle: CSSProperties = {
    maxHeight: isMobile ? '200px' : '140px',
    overflowY: 'auto',
    paddingRight: theme.spacing.xs,
    listStyle: 'none',
    margin: 0,
    padding: 0,
    paddingInlineStart: 0,
  };

  const getEventItemStyle = (eventType: string): CSSProperties => {
    let backgroundColor: string = 'transparent';
    let borderColor: string = theme.colors.border;

    if (eventType === 'GOAL') {
      backgroundColor = 'rgba(0, 230, 118, 0.05)';
      borderColor = 'rgba(0, 230, 118, 0.3)';
    } else if (eventType === 'STATUS_CHANGE') {
      backgroundColor = 'rgba(59, 130, 246, 0.05)';
      borderColor = 'rgba(59, 130, 246, 0.3)';
    } else if (eventType === 'RESULT_EDIT') {
      backgroundColor = 'rgba(251, 191, 36, 0.05)';
      borderColor = 'rgba(251, 191, 36, 0.3)';
    }

    return {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: theme.spacing.sm,
      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      fontSize: theme.fontSizes.sm,
      borderBottom: `1px dashed ${borderColor}`,
      backgroundColor,
      borderRadius: theme.borderRadius.sm,
      marginBottom: '2px',
    };
  };

  const timeStyle: CSSProperties = {
    fontFamily: 'ui-monospace, monospace',
    color: theme.colors.text.secondary,
    fontSize: theme.fontSizes.xs,
    minWidth: '54px',
  };

  const descStyle: CSSProperties = {
    flex: 1,
  };

  const scoreStyle: CSSProperties = {
    fontWeight: theme.fontWeights.semibold,
    color: theme.colors.text.primary,
    fontSize: theme.fontSizes.xs,
  };

  const getEventDescription = (event: MatchEvent) => {
    if (event.type === 'GOAL') {
      const { teamName, direction } = event.payload;
      // DEF-004: Robust fallback for missing teamName
      const displayName = teamName || 'Unbekanntes Team';
      if (direction === 'INC') {
        return `⚽ Tor für ${displayName}`;
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
          gap: theme.spacing.xs,
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
