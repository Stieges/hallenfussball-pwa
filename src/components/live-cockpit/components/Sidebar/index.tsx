/**
 * Sidebar - Penalties + Event Log (Desktop only)
 *
 * Based on mockup: scoreboard-desktop.html
 * Shows active time penalties and event history
 *
 * BUG-010: Added edit functionality for all events
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../../design-tokens'
import type { ActivePenalty, RuntimeMatchEvent } from '../../../../types/tournament';
import { mergeProtocol, takeRecent, formatTime } from '../protocolEntries';
import { ProtocolRow } from '../ProtocolRow';

export interface SidebarProps {
  activePenalties: ActivePenalty[];
  events: RuntimeMatchEvent[];
  /** C3b-1 (G6): zurückgenommene Einträge, nur zur Anzeige (durchgestrichen, ohne Bearbeiten). */
  retractedEvents?: RuntimeMatchEvent[];
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Sidebar: React.FC<SidebarProps> = ({
  activePenalties,
  events,
  retractedEvents,
  homeTeamName,
  awayTeamName,
  homeTeamId,
  awayTeamId,
  onEventEdit,
}) => {
  const { t } = useTranslation('cockpit');
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
        return t('sidebar.redEvent', { teamName }) + playerInfo;
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
  const recentEvents = takeRecent(mergeProtocol(events, retractedEvents).reverse(), 10);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle}>
      {/* Active Penalties */}
      <div style={panelStyle}>
        <div style={panelTitleStyle}>{t('sidebar.activePenalties')}</div>
        {activePenalties.length === 0 ? (
          <div style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
            {t('sidebar.noPenalties')}
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
        <div style={panelTitleStyle}>{t('sidebar.events')}</div>
        {recentEvents.length === 0 ? (
          <div style={{ color: cssVars.colors.textMuted, fontSize: cssVars.fontSizes.sm }}>
            {t('sidebar.noEvents')}
          </div>
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
