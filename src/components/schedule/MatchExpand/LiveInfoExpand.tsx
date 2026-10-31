/**
 * LiveInfoExpand - Read-only info panel for running matches
 *
 * Displays live match info without editing capability:
 * - Zustands-Abzeichen (MatchStatusBadge) und Restzeit (MatchClock)
 * - Large score display (read-only)
 * - Recent events (last 3-5)
 * - "Go to Cockpit" button
 *
 * @example
 * ```tsx
 * <LiveInfoExpand
 *   homeTeam={{ id: '1', name: 'Team A' }}
 *   awayTeam={{ id: '2', name: 'Team B' }}
 *   homeScore={2}
 *   awayScore={1}
 *   clock={clock}
 *   events={matchEvents}
 *   onNavigateToCockpit={() => navigate(`/cockpit/${matchId}`)}
 * />
 * ```
 */

import { type CSSProperties } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens'
import { Button } from '../../ui/Button';
import { MatchStatusBadge } from '../../ui/molecules/MatchStatusBadge';
import type { MatchBadgeModel, SpectatorClock } from '../../../core/view';
import { MatchClock } from '../../ui/molecules/MatchClock';
import { getEventIcon, getEventLabel, showsMinuteInLabel } from './liveInfoEventLine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Team {
  id: string;
  name: string;
}

export interface MatchEvent {
  id: string;
  type: 'GOAL' | 'YELLOW_CARD' | 'RED_CARD' | 'TIME_PENALTY' | 'SUBSTITUTION' | 'FOUL' | 'STATUS_CHANGE' | 'RESULT_EDIT';
  teamId?: string;
  teamName?: string;
  timestampSeconds: number;
  playerNumber?: number;
  direction?: 'INC' | 'DEC';
  /** @ZM-186: Eigentor -- `teamId` ist das begünstigte, `ownGoalTeamId` das schießende Team. */
  ownGoal?: boolean;
  ownGoalTeamId?: string;
  /** F3b2 (Ruling PC30): 'YELLOW' | 'YELLOW_RED' | 'RED' -- unterschieden nur ueber cardKindOf. */
  cardType?: string;
}

export interface LiveInfoExpandProps {
  /** Home team info */
  homeTeam: Team;
  /** Away team info */
  awayTeam: Team;
  /** Current home score */
  homeScore: number;
  /** Current away score */
  awayScore: number;
  /** Restzeit beim Stand (@ZM-162); ohne Uhr steht nichts */
  clock?: SpectatorClock | null;
  /** Abzeichen der Ansicht (`MatchView.badge`); ohne Angabe „Live“ */
  badge?: MatchBadgeModel;
  /** Recent match events */
  events?: MatchEvent[];
  /** Maximum events to display */
  maxEvents?: number;
  /** Callback to navigate to cockpit */
  onNavigateToCockpit?: () => void;
  /** Spiel beenden (@FU-112, @FU-114): nur für die Turnierleitung -- öffnet die Eingabe; Helfer bekommen den Weg nicht (@FU-113). */
  onEndAndEnter?: () => void;
  /** Callback to close the expand */
  onClose?: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const LIVE_BADGE: MatchBadgeModel = { kind: 'badge', state: 'live' };

function formatEventTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const LiveInfoExpand: React.FC<LiveInfoExpandProps> = ({
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  clock,
  badge,
  events = [],
  maxEvents = 5,
  onNavigateToCockpit,
  onEndAndEnter,
  onClose,
}) => {
  const { t } = useTranslation('tournament');

  // Get recent events (excluding STATUS_CHANGE and RESULT_EDIT)
  const displayableEvents = events
    .filter((e) => e.type !== 'STATUS_CHANGE' && e.type !== 'RESULT_EDIT')
    .sort((a, b) => b.timestampSeconds - a.timestampSeconds)
    .slice(0, maxEvents);

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.md,
  };

  const headerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  };

  const scoreContainerStyle: CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: cssVars.spacing.md,
    padding: cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceLight,
    borderRadius: cssVars.borderRadius.md,
  };

  const teamScoreStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: cssVars.spacing.xs,
    minWidth: '80px',
  };

  const teamNameStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textSecondary,
    textAlign: 'center',
    // MOBILE-UX: No truncation - team names must be fully visible
    wordBreak: 'break-word',
    overflowWrap: 'break-word',
    maxWidth: '120px',
  };

  const scoreValueStyle: CSSProperties = {
    fontSize: '32px',
    fontWeight: 900,
    color: cssVars.colors.textPrimary,
    lineHeight: 1,
  };

  const scoreSeparatorStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xxl,
    fontWeight: cssVars.fontWeights.bold,
    color: cssVars.colors.textSecondary,
  };

  const eventsContainerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: cssVars.spacing.xs,
  };

  const eventsHeaderStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.xs,
    color: cssVars.colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  };

  const eventItemStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: cssVars.spacing.xs,
    fontSize: cssVars.fontSizes.sm,
  };

  const eventIconStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.md,
    flexShrink: 0,
  };

  const eventTextStyle: CSSProperties = {
    flex: 1,
    color: cssVars.colors.textPrimary,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };

  const eventTimeStyle: CSSProperties = {
    color: cssVars.colors.textSecondary,
    fontVariantNumeric: 'tabular-nums',
    flexShrink: 0,
  };

  const noEventsStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.sm,
    color: cssVars.colors.textMuted,
    fontSize: cssVars.fontSizes.sm,
  };

  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: cssVars.spacing.sm,
    justifyContent: 'flex-end',
    paddingTop: cssVars.spacing.sm,
    borderTop: `1px solid ${cssVars.colors.border}`,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={containerStyle} data-testid="live-info-expand">
      {/* Header with LIVE badge and timer */}
      <div style={headerStyle}>
        <MatchStatusBadge model={badge ?? LIVE_BADGE} size="card" />
        {clock && <MatchClock clock={clock} size="card" />}
      </div>

      {/* Large Score Display */}
      <div style={scoreContainerStyle}>
        <div style={teamScoreStyle}>
          <span style={teamNameStyle}>{homeTeam.name}</span>
          <span style={scoreValueStyle}>{homeScore}</span>
        </div>
        <span style={scoreSeparatorStyle}>:</span>
        <div style={teamScoreStyle}>
          <span style={teamNameStyle}>{awayTeam.name}</span>
          <span style={scoreValueStyle}>{awayScore}</span>
        </div>
      </div>

      {/* Recent Events */}
      <div style={eventsContainerStyle}>
        <span style={eventsHeaderStyle}>{t('matchExpand.liveInfo.recentEvents')}</span>
        {displayableEvents.length > 0 ? (
          displayableEvents.map((event) => (
            <div key={event.id} style={eventItemStyle}>
              <span style={eventIconStyle}>{getEventIcon(event)}</span>
              <span style={eventTextStyle}>
                {getEventLabel(event, homeTeam, awayTeam, t)}
              </span>
              {!showsMinuteInLabel(event) && (
                <span style={eventTimeStyle}>
                  {formatEventTime(event.timestampSeconds)}
                </span>
              )}
            </div>
          ))
        ) : (
          <div style={noEventsStyle}>{t('matchExpand.liveInfo.noEvents')}</div>
        )}
      </div>

      {/* Action Buttons */}
      <div style={actionsStyle}>
        {onClose && (
          <Button
            variant="secondary"
            size="md"
            onClick={onClose}
          >
            {t('matchExpand.liveInfo.close')}
          </Button>
        )}
        {onEndAndEnter && (
          <Button variant="secondary" size="md" onClick={onEndAndEnter} data-testid="end-and-enter-btn">
            {t('matchExpand.liveInfo.endAndEnter')}
          </Button>
        )}
        {onNavigateToCockpit && (
          <Button
            variant="primary"
            size="md"
            onClick={onNavigateToCockpit}
            data-testid="goto-cockpit-btn"
          >
            {t('matchExpand.liveInfo.gotoCockpit')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default LiveInfoExpand;
