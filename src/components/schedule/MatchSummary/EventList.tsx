/**
 * EventList - Shared event rendering for MatchSummary
 *
 * Displays match events in a compact, readable format.
 * Used by both MatchSummaryDialog (Desktop) and MatchSummarySheet (Mobile).
 */

import { type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cssVars } from '../../../design-tokens';
import type { RuntimeMatchEvent } from '../../../types/tournament';
import { cardKindOf } from '../../../utils/cardKind';
import { FOUL_SYMBOL } from '../../../utils/eventSymbols';
import { KartenSymbol } from '../../ui/atoms/KartenSymbol';
import { eventMinute } from '../MatchExpand/liveInfoEventLine';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventListProps {
  events: RuntimeMatchEvent[];
  homeTeamId: string;
  awayTeamId: string;
  homeTeamName: string;
  awayTeamName: string;
  onEventEdit?: (event: RuntimeMatchEvent) => void;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/** Tor, Zeitstrafe und Karten tragen Minute bzw. Nummer in der Zeile (@ZM-002, @ZM-021), ohne Uhrzeit-Spalte. */
const hatNurZeile = (event: RuntimeMatchEvent): boolean =>
  event.type === 'GOAL' || event.type === 'TIME_PENALTY' || event.type === 'YELLOW_CARD' || event.type === 'RED_CARD';

const getEventIcon = (event: RuntimeMatchEvent): ReactNode => {
  switch (event.type) {
    case 'GOAL': return '\u26BD';
    // Karten-Farben nur für Karten (Oberfläche E): Symbol aus cardYellow/cardRed statt Farb-Emoji.
    case 'YELLOW_CARD': return <KartenSymbol art="YELLOW" />;
    // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden.
    case 'RED_CARD': return <KartenSymbol art={cardKindOf(event) === 'YELLOW_RED' ? 'YELLOW_RED' : 'RED'} />;
    case 'TIME_PENALTY': return '\u23F1';
    case 'SUBSTITUTION': return '\uD83D\uDD04';
    case 'FOUL': return FOUL_SYMBOL;
    default: return '\u2022';
  }
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EventList({
  events,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  onEventEdit,
  compact = false,
}: EventListProps) {
  const { t } = useTranslation('tournament');

  const getTeamName = (teamId?: string): string => {
    if (teamId === homeTeamId) {return homeTeamName;}
    if (teamId === awayTeamId) {return awayTeamName;}
    return teamId ?? 'Team';
  };

  const getEventDescription = (event: RuntimeMatchEvent): string => {
    const teamName = event.payload.teamName ?? getTeamName(event.payload.teamId);
    // @ZM-002/@ZM-021: „Tor FC Nord, Nr. 9, 3.“, „Zeitstrafe SV Süd, Nr. 5, 4.“, „Gelbe Karte SV Süd, Nr. 5“
    const numberInfo = event.payload.playerNumber ? t('matchSummary.events.playerNumber', { number: String(event.payload.playerNumber) }) : '';
    const minute = String(eventMinute(event.timestampSeconds));

    switch (event.type) {
      case 'GOAL': {
        if (event.payload.direction === 'DEC') {
          return t('matchSummary.events.goalDecrement', { team: teamName });
        }
        // @ZM-186: Eigentor „Eigentor SV Süd, Nr. 4, 6.“ -- schießendes Team, nicht das begünstigte
        if (event.payload.ownGoal === true) {
          return t('matchSummary.events.ownGoal', { team: getTeamName(event.payload.ownGoalTeamId), player: numberInfo, minute });
        }
        let goalText = t('matchSummary.events.goal', { team: teamName, player: numberInfo, minute });
        const assists = event.payload.assists;
        if (assists && assists.length > 0) {
          const assistText = assists.map(a => `#${a}`).join(', ');
          goalText += ` (${t('matchSummary.events.assist')}: ${assistText})`;
        }
        return goalText;
      }
      case 'YELLOW_CARD':
        return t('matchSummary.events.yellowCard', { team: teamName, player: numberInfo });
      case 'RED_CARD':
        // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden.
        return t(cardKindOf(event) === 'YELLOW_RED' ? 'matchSummary.events.yellowRedCard' : 'matchSummary.events.redCard', { team: teamName, player: numberInfo });
      case 'TIME_PENALTY': {
        return t('matchSummary.events.timePenalty', { team: teamName, player: numberInfo, minute });
      }
      case 'SUBSTITUTION': {
        const playersOut = event.payload.playersOut;
        const playersIn = event.payload.playersIn;
        if (playersOut?.length || playersIn?.length) {
          const outInfo = playersOut?.map(n => `#${n}`).join(',') ?? '?';
          const inInfo = playersIn?.map(n => `#${n}`).join(',') ?? '?';
          return t('matchSummary.events.substitutionDetail', { team: teamName, out: outInfo, in: inInfo });
        }
        return t('matchSummary.events.substitution', { team: teamName });
      }
      case 'FOUL':
        return t('matchSummary.events.foul', { team: teamName });
      default:
        return event.type;
    }
  };

  // Filter out STATUS_CHANGE events and sort chronologically (oldest first)
  const displayEvents = events
    .filter(e => e.type !== 'STATUS_CHANGE' && e.type !== 'RESULT_EDIT')
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);

  // Styles
  const containerStyle: CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: compact ? cssVars.spacing.xs : cssVars.spacing.sm,
  };

  const eventRowStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: cssVars.spacing.sm,
    padding: compact ? cssVars.spacing.sm : cssVars.spacing.md,
    backgroundColor: cssVars.colors.surfaceElevated,
    border: `1px solid ${cssVars.colors.border}`,
    borderRadius: cssVars.borderRadius.md,
    minHeight: compact ? 40 : 48,
  };

  const iconStyle: CSSProperties = {
    fontSize: compact ? cssVars.fontSizes.md : cssVars.fontSizes.lg,
    flexShrink: 0,
    width: 24,
    textAlign: 'center',
  };

  const timeStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    fontWeight: cssVars.fontWeights.semibold,
    fontVariantNumeric: 'tabular-nums',
    color: cssVars.colors.textSecondary,
    flexShrink: 0,
    minWidth: 45,
  };

  const descStyle: CSSProperties = {
    fontSize: cssVars.fontSizes.sm,
    color: cssVars.colors.textPrimary,
    flex: 1,
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
    padding: compact ? cssVars.spacing.xs : cssVars.spacing.sm,
    backgroundColor: 'transparent',
    color: cssVars.colors.primary,
    border: `1px solid ${cssVars.colors.primary}`,
    borderRadius: cssVars.borderRadius.sm,
    fontSize: cssVars.fontSizes.xs,
    fontWeight: cssVars.fontWeights.medium,
    cursor: 'pointer',
    minWidth: compact ? 60 : 70,
    minHeight: 36,
  };

  const emptyStyle: CSSProperties = {
    textAlign: 'center',
    padding: cssVars.spacing.lg,
    color: cssVars.colors.textSecondary,
    fontSize: cssVars.fontSizes.sm,
  };

  if (displayEvents.length === 0) {
    return (
      <div style={emptyStyle}>
        {t('matchSummary.events.noEvents')}
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {displayEvents.map((event) => (
        <div key={event.id} style={eventRowStyle}>
          <span style={iconStyle}>{getEventIcon(event)}</span>
          {!hatNurZeile(event) && <span style={timeStyle}>{formatTime(event.timestampSeconds)}</span>}
          <span style={descStyle}>
            {getEventDescription(event)}
            {event.incomplete && <span style={incompleteStyle}>\u26A0\uFE0F</span>}
          </span>
          {onEventEdit && (
            <button
              style={editButtonStyle}
              onClick={() => onEventEdit(event)}
              aria-label={t('matchSummary.events.editAria', { description: getEventDescription(event) })}
            >
              \u270F\uFE0F Edit
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

export default EventList;
