/**
 * B-50 Klärungsliste: offene Einträge zu Fällen ordnen und zusammengehörige Einträge koppeln. Rein, ohne React.
 *
 * - Fall (@FU-038, @FU-095): gleiche Spiel-ID, gleicher Grund (bei `CONTROL_LOST` auch „vor/nach Übernahme“) und
 *   gleiche Herkunft (Name + Gerät). Titel „3 Einträge von Tom nach Übernahme“ zählt Einträge, nicht Häkchen.
 * - Einheit (@FU-096): ein Häkchen. Gekoppelt werden Gelbe Karte + darauf folgende Gelb-Rote Karte (Team und
 *   Rückennummer gleich), ein Tor mit seiner Rücknahme (`targetId`) und ein Gegentor mit der Zeitstrafe, die es
 *   beendet hat (gleicher Abschnitt, Tor gegen das bestrafte Team innerhalb der Strafzeit).
 * - Hinweise (@FU-037, `kind notice`): je Spiel, Name und Feld ein Hinweis „1 Tor von Tom (Feld 2) nachträglich eingefügt“.
 */
import { REVIEW_COPY_TYPES } from '../handlers/reviewCopy';
import { isOpenReview, type MatchReview } from './matchReviewTypes';

export type ReviewReasonKey = 'afterTakeover' | 'beforeTakeover' | 'rightsRevoked' | 'afterEnd' | 'beforeReset';

export interface ReviewUnit {
  /** Schlüssel des Häkchens: Event-ID des ersten Eintrags. */
  key: string;
  reviews: MatchReview[];
  /** Kann übernommen werden (mindestens ein Eintrag zählt danach); sonst nur „Verwerfen“. */
  acceptable: boolean;
  /** Tor und Rücknahme: „Übernehmen“ verwirft beide (die Rücknahme ist nicht übernehmbar, Wirkung gleich). */
  retractPair: boolean;
}

export interface ReviewCase {
  key: string;
  matchId: string;
  matchNumber: number | null;
  field: number | null;
  reasonKey: ReviewReasonKey;
  author: string | null;
  deviceLabel: string | null;
  count: number;
  units: ReviewUnit[];
}

export interface ReviewNotice {
  key: string;
  matchId: string;
  matchNumber: number | null;
  field: number | null;
  author: string | null;
  count: number;
  /** Alle Hinweise des Falls sind Tore → „Tor/Tore“, sonst „Eintrag/Einträge“. */
  onlyGoals: boolean;
}

export function reasonKeyOf(review: MatchReview): ReviewReasonKey {
  switch (review.reason) {
    case 'RIGHTS_REVOKED':
      return 'rightsRevoked';
    case 'AFTER_END':
      return 'afterEnd';
    case 'BEFORE_RESET':
      return 'beforeReset';
    default:
      return review.detail.timing === 'before' ? 'beforeTakeover' : 'afterTakeover';
  }
}

const byPlay = (a: MatchReview, b: MatchReview): number =>
  (a.entry.section ?? 0) - (b.entry.section ?? 0) ||
  (a.entry.clockMs ?? 0) - (b.entry.clockMs ?? 0) ||
  a.receivedAt - b.receivedAt;

const isGoal = (review: MatchReview): boolean => review.entry.type === 'GOAL' || review.entry.type === 'OWN_GOAL';

/** Zählt das Tor gegen `team`? GOAL zählt für das eingetragene Team, OWN_GOAL für den Gegner (`applyGoal`). */
const isGoalAgainst = (goal: MatchReview, team: string): boolean =>
  goal.entry.type === 'OWN_GOAL' ? goal.entry.teamId === team : goal.entry.teamId !== null && goal.entry.teamId !== team;

function endsPenalty(goal: MatchReview, penalty: MatchReview, defaultPenaltySeconds: number): boolean {
  const penaltyTeam = penalty.entry.teamId;
  if (penaltyTeam === null || !isGoalAgainst(goal, penaltyTeam) || goal.entry.section !== penalty.entry.section) {
    return false;
  }
  const start = penalty.entry.clockMs;
  const at = goal.entry.clockMs;
  if (start === null || at === null) {
    return false;
  }
  const raw = penalty.entry.payload.durationSeconds;
  const seconds = typeof raw === 'number' ? raw : defaultPenaltySeconds;
  return at >= start && at <= start + seconds * 1000;
}

function partnerOf(review: MatchReview, rest: MatchReview[], defaultPenaltySeconds: number): MatchReview | undefined {
  const { type, teamId, payload } = review.entry;
  if (type === 'GOAL' || type === 'OWN_GOAL') {
    return rest.find((other) => other.entry.type === 'RETRACT' && other.entry.targetId === review.eventId)
      ?? rest.find((other) => other.entry.type === 'TIME_PENALTY' && endsPenalty(review, other, defaultPenaltySeconds));
  }
  if (type === 'RETRACT') {
    return rest.find((other) => other.eventId === review.entry.targetId);
  }
  if (type === 'YELLOW_CARD' && typeof payload.playerNumber === 'number') {
    return rest.find((other) => other.entry.type === 'YELLOW_RED_CARD' && other.entry.teamId === teamId
      && other.entry.payload.playerNumber === payload.playerNumber);
  }
  if (type === 'YELLOW_RED_CARD' && typeof payload.playerNumber === 'number') {
    return rest.find((other) => other.entry.type === 'YELLOW_CARD' && other.entry.teamId === teamId
      && other.entry.payload.playerNumber === payload.playerNumber);
  }
  if (type === 'TIME_PENALTY') {
    return rest.find((other) => isGoal(other) && endsPenalty(other, review, defaultPenaltySeconds));
  }
  return undefined;
}

/** Häkchen-Einheiten eines Falls in Spielreihenfolge. */
export function buildUnits(reviews: MatchReview[], defaultPenaltySeconds: number): ReviewUnit[] {
  const pool = [...reviews].sort(byPlay);
  const units: ReviewUnit[] = [];
  for (let first = pool.shift(); first !== undefined; first = pool.shift()) {
    const partner = partnerOf(first, pool, defaultPenaltySeconds);
    const members = partner ? [first, partner].sort(byPlay) : [first];
    if (partner) {
      pool.splice(pool.indexOf(partner), 1);
    }
    const retractPair = members.some((member) => member.entry.type === 'RETRACT');
    units.push({
      key: members[0].eventId,
      reviews: members,
      acceptable: members.some((member) => REVIEW_COPY_TYPES.has(member.entry.type)),
      retractPair,
    });
  }
  return units;
}

const caseKeyOf = (review: MatchReview): string =>
  [review.matchId, reasonKeyOf(review), review.author ?? '', review.deviceLabel ?? ''].join('|');

/** Offene Einträge als Fälle, ältester Fall zuerst. */
export function buildReviewCases(reviews: MatchReview[], defaultPenaltySeconds: number): ReviewCase[] {
  const groups = new Map<string, MatchReview[]>();
  for (const review of [...reviews].filter(isOpenReview).sort((a, b) => a.receivedAt - b.receivedAt)) {
    const key = caseKeyOf(review);
    groups.set(key, [...(groups.get(key) ?? []), review]);
  }
  return [...groups.entries()].map(([key, members]) => {
    const first = members[0];
    return {
      key,
      matchId: first.matchId,
      matchNumber: first.matchNumber,
      field: first.field,
      reasonKey: reasonKeyOf(first),
      author: first.author,
      deviceLabel: first.deviceLabel,
      count: members.length,
      units: buildUnits(members, defaultPenaltySeconds),
    };
  });
}

/** Hinweise „nachträglich eingefügt“ (@FU-037). */
export function buildReviewNotices(reviews: MatchReview[]): ReviewNotice[] {
  const groups = new Map<string, MatchReview[]>();
  for (const review of reviews.filter((candidate) => candidate.kind === 'notice')) {
    const key = [review.matchId, review.author ?? '', review.field ?? ''].join('|');
    groups.set(key, [...(groups.get(key) ?? []), review]);
  }
  return [...groups.entries()].map(([key, members]) => ({
    key,
    matchId: members[0].matchId,
    matchNumber: members[0].matchNumber,
    field: members[0].field,
    author: members[0].author,
    count: members.length,
    onlyGoals: members.every(isGoal),
  }));
}

/** Zähler im Kopf: offene Einträge (Hinweise zählen nicht). */
export function openReviewCount(reviews: MatchReview[]): number {
  return reviews.filter(isOpenReview).length;
}
