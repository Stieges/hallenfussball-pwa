/**
 * Klartext je Ablehnungscode (D-C1) und Kurzbeschreibung eines Eintrags.
 * Reine Funktionen ohne i18n-Zugriff: sie liefern nur Schluessel und Werte.
 */
import type { RejectedEntry } from '../../../core/match/client/matchCopy';
import type { EventType, MatchContext } from '../../../core/match/types';

/** Team-Zuordnung fuer „Tor Team A/B“ (optional, ohne bleibt Team unbestimmt). */
export type EventTeams = Pick<MatchContext, 'teamAId' | 'teamBId'>;

export interface EventDescription {
  /** i18n-Schluessel der Zeile: `outbox.eventLine.*`, je nach verfuegbaren Werten. */
  key: string;
  /** Werte fuer die Zeile (`what` = Schluessel des Typs, Team A/B, Spielminute). */
  values: {
    typeKey: string;
    team: 'A' | 'B' | null;
    minute: number | null;
  };
}

const REASON_KEYS: Record<string, string> = {
  INVALID_TRANSITION: 'outbox.rejection.INVALID_TRANSITION',
  FORBIDDEN_ACTOR: 'outbox.rejection.FORBIDDEN_ACTOR',
  UNKNOWN_TARGET: 'outbox.rejection.UNKNOWN_TARGET',
  ALREADY_RETRACTED: 'outbox.rejection.ALREADY_RETRACTED',
  STALE_BASE: 'outbox.rejection.STALE_BASE',
  INVALID_PAYLOAD: 'outbox.rejection.INVALID_PAYLOAD',
  MATCH_FINISHED: 'outbox.rejection.MATCH_FINISHED',
  NO_WINNER: 'outbox.rejection.NO_WINNER',
  DEPENDS_ON_REJECTED: 'outbox.rejection.DEPENDS_ON_REJECTED',
  ID_CONFLICT: 'outbox.rejection.ID_CONFLICT',
  NOT_CONTROLLER: 'outbox.rejection.NOT_CONTROLLER',
  MATCH_FULL: 'outbox.rejection.MATCH_FULL',
  MATCH_GONE: 'outbox.rejection.MATCH_GONE',
};

const UNKNOWN_REASON_KEY = 'outbox.rejection.unknown';

const TYPE_KEYS: Partial<Record<EventType, string>> = {
  MATCH_START: 'outbox.eventType.matchStart',
  PAUSE: 'outbox.eventType.pause',
  RESUME: 'outbox.eventType.resume',
  SECTION_END: 'outbox.eventType.sectionEnd',
  SECTION_START: 'outbox.eventType.sectionStart',
  CLOCK_ADJUST: 'outbox.eventType.clockAdjust',
  MATCH_END: 'outbox.eventType.matchEnd',
  TIEBREAK_CHOICE: 'outbox.eventType.tiebreakChoice',
  SHOOTOUT_KICK: 'outbox.eventType.shootoutKick',
  SHOOTOUT_END: 'outbox.eventType.shootoutEnd',
  RETRACT: 'outbox.eventType.retract',
  CORRECTION: 'outbox.eventType.correction',
  REOPEN: 'outbox.eventType.reopen',
  SKIP: 'outbox.eventType.skip',
  UNSKIP: 'outbox.eventType.unskip',
  RESULT_ENTRY: 'outbox.eventType.resultEntry',
  REVIEW_ACCEPT: 'outbox.eventType.reviewAccept',
  REVIEW_DISCARD: 'outbox.eventType.reviewDiscard',
  GOAL: 'outbox.eventType.goal',
  OWN_GOAL: 'outbox.eventType.ownGoal',
  YELLOW_CARD: 'outbox.eventType.yellowCard',
  YELLOW_RED_CARD: 'outbox.eventType.yellowRedCard',
  RED_CARD: 'outbox.eventType.redCard',
  TIME_PENALTY: 'outbox.eventType.timePenalty',
  SUBSTITUTION: 'outbox.eventType.substitution',
  FOUL: 'outbox.eventType.foul',
  AMEND: 'outbox.eventType.amend',
};

const UNKNOWN_TYPE_KEY = 'outbox.eventType.unknown';

/** i18n-Schluessel zum Ablehnungscode; unbekannte Codes laufen auf „unbekannter Grund“. */
export function rejectionReasonKey(code: string): string {
  return REASON_KEYS[code] ?? UNKNOWN_REASON_KEY;
}

/** Spielminute (1-basiert) aus der Spieluhr; `null`, solange keine Uhr laeuft. */
export function minuteFromClock(clockMs: number | null | undefined): number | null {
  if (clockMs === null || clockMs === undefined) {
    return null;
  }
  return Math.floor(clockMs / 60_000) + 1;
}

function sideOf(teamId: string | null | undefined, teams: EventTeams | undefined): 'A' | 'B' | null {
  if (!teams || !teamId) {
    return null;
  }
  if (teamId === teams.teamAId) {
    return 'A';
  }
  return teamId === teams.teamBId ? 'B' : null;
}

/** Kurzbeschreibung „was es war“ (Typ, Team A/B, Minute aus `clockMs`). */
export function describeEvent(entry: RejectedEntry, teams?: EventTeams): EventDescription {
  const team = sideOf(entry.event.teamId, teams);
  const minute = minuteFromClock(entry.event.clockMs);
  const typeKey = TYPE_KEYS[entry.event.type] ?? UNKNOWN_TYPE_KEY;
  if (team !== null && minute !== null) {
    return { key: 'outbox.eventLine.teamAndMinute', values: { typeKey, team, minute } };
  }
  if (team !== null) {
    return { key: 'outbox.eventLine.team', values: { typeKey, team, minute } };
  }
  if (minute !== null) {
    return { key: 'outbox.eventLine.minute', values: { typeKey, team, minute } };
  }
  return { key: 'outbox.eventLine.plain', values: { typeKey, team, minute } };
}

/** Zeigt der Schluessel einen unbekannten Code an (D-C1: Code zusaetzlich zeigen)? */
export function isUnknownReason(reasonKey: string): boolean {
  return reasonKey === UNKNOWN_REASON_KEY;
}
