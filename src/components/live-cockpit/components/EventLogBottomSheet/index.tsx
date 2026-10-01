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
import sportGlossary from '../../../../i18n/glossary.json';
import type { RuntimeMatchEvent } from '../../../../types/tournament';
import { mergeProtocol } from '../protocolEntries';
import { ProtocolRow } from '../ProtocolRow';
import { cardKindOf } from '../../../../utils/cardKind';

interface EventLogBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  events: RuntimeMatchEvent[];
  /** C3b-1 (G6): zurückgenommene Einträge, nur zur Anzeige (durchgestrichen, ohne Bearbeiten). */
  retractedEvents?: RuntimeMatchEvent[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Task R2 Fixrunde 2 (H1b): optional — wenn kein Handler übergeben wird (readOnly), blendet
   *  die Komponente den "Bearbeiten"-Knopf komplett aus (gleiches Muster wie Sidebar/index.tsx
   *  `canEdit = !!onEventEdit`). Das Sheet selbst bleibt immer les-/öffenbar (Regel 2). */
  onEventEdit?: (event: RuntimeMatchEvent) => void;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventLogBottomSheet({
  isOpen,
  onClose,
  events,
  retractedEvents,
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
        // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden.
        return cardKindOf(event) === 'YELLOW_RED'
          ? `Gelb-Rote Karte ${teamName}${playerInfo}`
          : `Rote Karte ${teamName}${playerInfo}`;
      case 'TIME_PENALTY': {
        const duration = event.payload.penaltyDuration
          ? Math.floor(event.payload.penaltyDuration / 60)
          : 2;
        return `${duration} Min ${sportGlossary.terms.timePenalty.de} ${teamName}${playerInfo}`;
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
  const sortedEvents = mergeProtocol(events, retractedEvents).reverse();

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
          {sortedEvents.map((entry) => (
            <ProtocolRow
              key={entry.event.id}
              entry={entry}
              description={getEventDescription(entry.event)}
              variant="sheet"
              editable={isEditable(entry.event)}
              onEventEdit={onEventEdit}
            />
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

export default EventLogBottomSheet;
