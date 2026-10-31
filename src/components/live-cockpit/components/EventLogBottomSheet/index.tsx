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
 * - UR (@FU-080): Direkteinträge des Spiels als eigene Zeilen „Ergebnis eingetragen von …“ (`matchId`)
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens';
import { BottomSheet } from '../../../ui/BottomSheet';
import type { RuntimeMatchEvent } from '../../../../types/tournament';
import { mergeProtocol, type DiscardedProtocolEntry } from '../protocolEntries';
import { ProtocolRow } from '../ProtocolRow';
import { describeGoal } from '../goalDescription';
import { cardKindOf } from '../../../../utils/cardKind';
import { useResultEntryEvents } from '../../../../features/match-engine/useResultEntryEvents';
import { ResultEntryProtocolRows } from '../ResultEntryProtocolRow';

interface EventLogBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  events: RuntimeMatchEvent[];
  /** C3b-1 (G6): zurückgenommene Einträge, nur zur Anzeige (durchgestrichen, ohne Bearbeiten). */
  retractedEvents?: RuntimeMatchEvent[];
  /** B-50 (@FU-095, B6.3): verworfene Klärungseinträge (nur Turnierleitung). */
  discardedEntries?: DiscardedProtocolEntry[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** Task R2 Fixrunde 2 (H1b): optional — wenn kein Handler übergeben wird (readOnly), blendet
   *  die Komponente den "Bearbeiten"-Knopf komplett aus (gleiches Muster wie Sidebar/index.tsx
   *  `canEdit = !!onEventEdit`). Das Sheet selbst bleibt immer les-/öffenbar (Regel 2). */
  onEventEdit?: (event: RuntimeMatchEvent) => void;
  /** UR (@FU-080): Spiel-ID für die Protokoll-Zeilen der Direkteinträge. Ohne ID keine solche Zeile. */
  matchId?: string;
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
  discardedEntries,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  onEventEdit,
  matchId,
}: EventLogBottomSheetProps) {
  const { t } = useTranslation('cockpit');
  const resultEntries = useResultEntryEvents(matchId);
  const getTeamName = (teamId?: string): string => {
    if (teamId === homeTeamId) {return homeTeamName;}
    if (teamId === awayTeamId) {return awayTeamName;}
    return teamId ?? 'Team';
  };

  const getEventDescription = (event: RuntimeMatchEvent): string => {
    const teamName = event.payload.teamName ?? getTeamName(event.payload.teamId);
    const playerInfo = event.payload.playerNumber ? ` #${event.payload.playerNumber}` : '';

    switch (event.type) {
      case 'GOAL':
        if (event.payload.direction === 'DEC') {
          return `−1 ${teamName}`;
        }
        return describeGoal(event, { homeTeamId, homeTeamName, awayTeamName }, t);
      case 'YELLOW_CARD':
        return t('sidebar.sheetYellowEvent', { teamName }) + playerInfo;
      case 'RED_CARD':
        // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden.
        return `${t(cardKindOf(event) === 'YELLOW_RED' ? 'cardDialog.yellowRedCard' : 'cardDialog.redCard')} ${teamName}${playerInfo}`;
      case 'TIME_PENALTY': {
        const duration = event.payload.penaltyDuration
          ? Math.floor(event.payload.penaltyDuration / 60)
          : 2;
        return t('sidebar.sheetPenaltyEvent', { duration, teamName }) + playerInfo;
      }
      case 'SUBSTITUTION': {
        const playersOut = event.payload.playersOut;
        const playersIn = event.payload.playersIn;
        if (playersOut?.length || playersIn?.length) {
          const outInfo = playersOut?.map(n => `#${n}`).join(',') ?? '?';
          const inInfo = playersIn?.map(n => `#${n}`).join(',') ?? '?';
          return t('sidebar.sheetSubstitutionDetail', { teamName, out: outInfo, in: inInfo });
        }
        return t('sidebar.substitutionEvent', { teamName });
      }
      case 'FOUL':
        return t('sidebar.foulEvent', { teamName });
      case 'STATUS_CHANGE': {
        const toStatus = event.payload.toStatus;
        switch (toStatus) {
          case 'RUNNING': return t('sidebar.matchStarted');
          case 'PAUSED': return t('sidebar.matchPaused');
          case 'FINISHED': return t('sidebar.matchEnded');
          default: return t('sidebar.statusOther', { status: String(toStatus) });
        }
      }
      default:
        return event.type;
    }
  };

  // Show most recent events first
  const sortedEvents = mergeProtocol(events, retractedEvents, discardedEntries).reverse();

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
      testId="event-log-sheet"
    >
      {sortedEvents.length === 0 && resultEntries.ids.length === 0 ? (
        <div style={emptyStyle}>
          Noch keine Ereignisse aufgezeichnet
        </div>
      ) : (
        <div style={listStyle}>
          {matchId && (
            <ResultEntryProtocolRows tournamentId={resultEntries.tournamentId} matchId={matchId} ids={resultEntries.ids} variant="sheet" />
          )}
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
