/**
 * Ereigniszeilen der Liste „Letzte Ereignisse“ (Zuschauer-Seite und Verwaltung):
 * @ZM-002/@ZM-003 „Tor FC Nord, Nr. 9, 3.“ / „Zeitstrafe SV Süd, Nr. 5, 4.“ (Minute statt Uhrzeit, ohne Nummer „Tor FC Nord, 12.“),
 * @ZM-021 „Gelbe Karte SV Süd, Nr. 5“ (ohne Uhrzeit).
 */
import type { ReactNode } from 'react';
import { cardKindOf } from '../../../utils/cardKind';
import { FOUL_SYMBOL } from '../../../utils/eventSymbols';
import { KartenSymbol } from '../../ui/atoms/KartenSymbol';
import type { MatchEvent, Team } from './LiveInfoExpand';

/** @ZM-002/@ZM-003: Spielminute als laufende Nummer („3.“ für 2:00 bis 2:59), nicht als Uhrzeit. */
export function eventMinute(seconds: number): number {
  return Math.floor(seconds / 60) + 1;
}

/** Tor, Zeitstrafe und Karten tragen alles in der Zeile (@ZM-002, @ZM-021), keine Uhrzeit rechts; Wechsel und Foul behalten sie. */
export function showsMinuteInLabel(event: MatchEvent): boolean {
  return event.type === 'GOAL' || event.type === 'TIME_PENALTY' || event.type === 'YELLOW_CARD' || event.type === 'RED_CARD';
}

export function getEventIcon(event: MatchEvent): ReactNode {
  switch (event.type) {
    case 'GOAL':
      return '⚽';
    case 'YELLOW_CARD':
      return <KartenSymbol art="YELLOW" />;
    // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden (MatchEvent ist hier flach,
    // cardKindOf erwartet payload.cardType -- deshalb der kleine Wrapper).
    case 'RED_CARD':
      return <KartenSymbol art={cardKindOf({ type: event.type, payload: { cardType: event.cardType } }) === 'YELLOW_RED' ? 'YELLOW_RED' : 'RED'} />;
    case 'TIME_PENALTY':
      return '⏱️';
    case 'SUBSTITUTION':
      return '🔄';
    case 'FOUL':
      return FOUL_SYMBOL;
    default:
      return '📝';
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getEventLabel(event: MatchEvent, homeTeam: Team, awayTeam: Team, t: (key: any, opts?: Record<string, string>) => string): string {
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing -- Empty teamName should use fallback
  const teamName = event.teamName || (event.teamId === homeTeam.id ? homeTeam.name : awayTeam.name);
  const numberInfo = event.playerNumber ? t('matchExpand.liveInfo.playerNumber', { number: String(event.playerNumber) }) : '';
  const minute = String(eventMinute(event.timestampSeconds));

  switch (event.type) {
    case 'GOAL':
      // @ZM-186: Eigentor „Eigentor SV Süd, Nr. 4, 6.“ -- schießendes Team, nicht das begünstigte
      if (event.ownGoal === true) {
        const schuetze = event.ownGoalTeamId === homeTeam.id ? homeTeam.name : awayTeam.name;
        return t('matchExpand.liveInfo.eventOwnGoal', { team: schuetze, player: numberInfo, minute });
      }
      return t('matchExpand.liveInfo.eventGoal', { team: teamName, player: numberInfo, minute });
    case 'YELLOW_CARD':
      return t('matchExpand.liveInfo.eventYellowCard', { team: teamName, player: numberInfo });
    case 'RED_CARD':
      // F3b2 (Ruling PC30): Gelb-Rot NUR ueber cardKindOf unterscheiden.
      return t(
        cardKindOf({ type: event.type, payload: { cardType: event.cardType } }) === 'YELLOW_RED'
          ? 'matchExpand.liveInfo.eventYellowRedCard'
          : 'matchExpand.liveInfo.eventRedCard',
        { team: teamName, player: numberInfo },
      );
    case 'TIME_PENALTY':
      return t('matchExpand.liveInfo.eventTimePenalty', { team: teamName, player: numberInfo, minute });
    case 'SUBSTITUTION':
      return t('matchExpand.liveInfo.eventSubstitution', { team: teamName });
    case 'FOUL':
      return t('matchExpand.liveInfo.eventFoul', { team: teamName });
    default:
      return event.type;
  }
}
