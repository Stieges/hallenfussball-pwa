/**
 * Sidebar - Penalties + Event Log (Desktop only)
 *
 * Based on mockup: scoreboard-desktop.html
 * Shows active time penalties and event history
 *
 * BUG-010: Added edit functionality for all events
 * UR (@FU-080): Direkteinträge des Spiels als eigene Zeilen „Ergebnis eingetragen von …“ (`matchId`).
 */

import { type CSSProperties } from 'react';
import { StrafenSpalte } from '../../areas/StrafenSpalte';
import { KEINE_STRAFEN, type StrafenModel } from '../../model/toStrafenModel';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens'
import type { ActivePenalty, RuntimeMatchEvent } from '../../../../types/tournament';
import { mergeProtocol, takeRecent, type DiscardedProtocolEntry } from '../protocolEntries';
import { ProtocolRow } from '../ProtocolRow';
import { cardKindOf } from '../../../../utils/cardKind';
import { useResultEntryEvents } from '../../../../features/match-engine/useResultEntryEvents';
import { ResultEntryProtocolRows } from '../ResultEntryProtocolRow';

export interface SidebarProps {
  /** Nicht mehr gelesen: die Karten kommen aus `strafen` (Engine-Ansicht mit Dauer und Beginn, @SL-186). */
  activePenalties?: ActivePenalty[];
  /** Laufende Zeitstrafen als Karten (höchstens zwei je Team, „+ n weitere“); ohne Angabe „keine“. */
  strafen?: StrafenModel;
  events: RuntimeMatchEvent[];
  /** C3b-1 (G6): zurückgenommene Einträge, nur zur Anzeige (durchgestrichen, ohne Bearbeiten). */
  retractedEvents?: RuntimeMatchEvent[];
  /** B-50 (@FU-095, B6.3): verworfene Klärungseinträge (nur Turnierleitung). */
  discardedEntries?: DiscardedProtocolEntry[];
  homeTeamName: string;
  awayTeamName: string;
  homeTeamId: string;
  awayTeamId: string;
  /** BUG-010: Callback when edit button is clicked on any event */
  onEventEdit?: (event: RuntimeMatchEvent) => void;
  /** UR (@FU-080): Spiel-ID für die Protokoll-Zeilen der Direkteinträge. Ohne ID keine solche Zeile. */
  matchId?: string;
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sidebar: React.FC<SidebarProps> = ({
  strafen = KEINE_STRAFEN,
  events,
  retractedEvents,
  discardedEntries,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  onEventEdit,
  matchId,
}) => {
  const { t } = useTranslation('cockpit');
  const resultEntries = useResultEntryEvents(matchId);
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
  // Event Log
  // ---------------------------------------------------------------------------

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
        let goalText = t('sidebar.goalEvent', { teamName }) + playerInfo;
        // Show assists if present
        const assists = event.payload.assists;
        if (assists && assists.length > 0) {
          const assistsText = assists.map(a => `#${a}`).join(', ');
          goalText += ` ${t('sidebar.assistFormat', { assists: assistsText })}`;
        }
        return goalText;
      }
      case 'YELLOW_CARD':
        return t('sidebar.yellowEvent', { teamName }) + playerInfo;
      case 'RED_CARD':
        // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden, keine eigene
        // payload.cardType-Abfrage.
        return t(cardKindOf(event) === 'YELLOW_RED' ? 'sidebar.yellowRedEvent' : 'sidebar.redEvent', { teamName }) + playerInfo;
      case 'TIME_PENALTY': {
        const duration = event.payload.penaltyDuration
          ? Math.floor(event.payload.penaltyDuration / 60)
          : 2;
        return t('sidebar.penaltyEvent', { duration, teamName }) + playerInfo;
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
        return t('sidebar.substitutionEvent', { teamName });
      }
      case 'FOUL':
        return t('sidebar.foulEvent', { teamName });
      case 'STATUS_CHANGE': {
        // Show descriptive label for status changes
        const toStatus = event.payload.toStatus;
        switch (toStatus) {
          case 'RUNNING': return t('sidebar.matchStarted');
          case 'PAUSED': return t('sidebar.matchPaused');
          case 'FINISHED': return t('sidebar.matchEnded');
          default: return `Status: ${toStatus}`;
        }
      }
      default:
        return event.type;
    }
  };

  // Show most recent events first, limit to 10 effective entries (M2)
  const recentEvents = takeRecent(mergeProtocol(events, retractedEvents, discardedEntries).reverse(), 10);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Laufende Zeitstrafen als Karten (Plan Cockpit v2 B3, @SL-186) */}
      <StrafenSpalte model={strafen} />

      {/* Event Log */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{t('sidebar.events')}</div>
        {matchId && (
          <ResultEntryProtocolRows tournamentId={resultEntries.tournamentId} matchId={matchId} ids={resultEntries.ids} variant="sidebar" />
        )}
        {recentEvents.length === 0 ? (
          resultEntries.ids.length === 0 && (
            <div style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
              {t('sidebar.noEvents')}
            </div>
          )
        ) : (
          recentEvents.map((entry, index) => (
            <ProtocolRow
              key={entry.event.id}
              entry={entry}
              description={getEventDescription(entry.event)}
              variant="sidebar"
              isLast={index === recentEvents.length - 1}
              onEventEdit={onEventEdit}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default Sidebar;
