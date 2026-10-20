/**
 * Entscheidung der Turnierleitung über einen Gleichstand nach allen Kriterien (Paket TB, Plan v2 § 3.2, R-TB-4, R-TB-11).
 *
 * Gültig ist eine Entscheidung genau dann, wenn (a) der offene Block ohne Entscheidungen heute genau ihre Teams umfasst
 * und (b) ihr Fingerabdruck der Grundlage gleich dem heutigen ist: Punkteschema, aktive Kriterien in Reihenfolge und
 * `[id, scoreA, scoreB, matchStatus]` aller Gruppenspiele, an denen ein Team des Blocks beteiligt ist (@W2A-005,
 * @W2A-052, @W2A-053). Reine Rechnung – nichts wird gelöscht; kehrt dieselbe Grundlage zurück, gilt sie wieder.
 * Rein, ohne React.
 */
import type { Match, PlacementCriterion, PointSystem, StandingDecision, Tournament } from '../../types/tournament';
import { matchSideTeamId, slotSource } from '../models/matchSlot';
import type { SlotSource } from '../models/schemas/MatchSlotSchema';

export type DecisionErrorCode =
  | 'SHOOTOUT_NEEDS_WINNER'
  | 'ORDER_MISMATCH'
  | 'REASON_REQUIRED'
  | 'ALREADY_DECIDED'
  | 'BLOCK_CHANGED'
  | 'STALE'
  | 'OFFLINE'
  | 'SHARED_PLACE_NOT_ALLOWED';

/** Was die Turnierleitung einträgt; Person, Zeit, Kennung und Grundlage ergänzt der Dienst. */
export type DecisionDraft = Pick<StandingDecision, 'groupId' | 'teamIds' | 'order' | 'kind' | 'shootout' | 'reason'>;

/** Grund: Pflicht bei Reihenfolge und „gleichen Platz lassen“, 1–500 Zeichen (Hinweis „keine Spielernamen“ in der Oberfläche). */
export const DECISION_REASON_MAX_LENGTH = 500;

export const sortedIds = (ids: readonly string[]): string[] => [...ids].sort();

export const sameTeamSet = (a: readonly string[], b: readonly string[]): boolean => {
  const x = sortedIds(a);
  const y = sortedIds(b);
  return x.length === y.length && x.every((id, i) => id === y[i]);
};

export interface BasisInput {
  pointSystem: PointSystem;
  placementLogic: readonly PlacementCriterion[];
  matches: readonly Match[];
}

/** Fingerabdruck der Grundlage eines Blocks. */
export function decisionBasis(input: BasisInput, teamIds: readonly string[]): string {
  const members = new Set(teamIds);
  const matches = input.matches
    .filter((m) => [matchSideTeamId(m, 'A'), matchSideTeamId(m, 'B')].some((id) => id !== undefined && members.has(id)))
    .map((m) => [m.id, m.scoreA ?? null, m.scoreB ?? null, m.matchStatus ?? null] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({
    points: [input.pointSystem.win, input.pointSystem.draw, input.pointSystem.loss],
    criteria: input.placementLogic.filter((c) => c.enabled).map((c) => c.id),
    matches,
  });
}

/** Die gültige Entscheidung für einen offenen Block (gleiche Gruppe, gleiche Teams, gleiche Grundlage) oder `undefined`. */
export function findValidDecision(
  decisions: readonly StandingDecision[],
  groupId: string,
  block: readonly string[],
  basis: string,
): StandingDecision | undefined {
  return decisions.find((d) => d.groupId === groupId && sameTeamSet(d.teamIds, block) && d.basis === basis);
}

const isWholeNumber = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 0;

/** Prüfungen am Eintrag selbst, ohne Tabelle (gleich mit und ohne Netz, @W2A-061, @W2A-065, @W2A-062). */
export function checkDraftFields(draft: DecisionDraft): DecisionErrorCode | null {
  const unique = new Set(draft.teamIds);
  if (draft.teamIds.length < 2 || unique.size !== draft.teamIds.length
    || draft.order.length !== draft.teamIds.length || !sameTeamSet(draft.order, draft.teamIds)) {
    return 'ORDER_MISMATCH';
  }
  // Zwei Teams: Ergebnis eines Strafstoßschießens; drei und mehr: Reihenfolge mit Grund (@W2A-004, @W2A-057).
  const allowedKinds = draft.teamIds.length === 2 ? ['shootout', 'shared'] : ['order', 'shared'];
  if (!allowedKinds.includes(draft.kind)) {
    return 'ORDER_MISMATCH';
  }
  if (draft.kind === 'shootout') {
    const s = draft.shootout;
    if (s === undefined || !isWholeNumber(s.winner) || !isWholeNumber(s.loser) || s.winner <= s.loser) {
      return 'SHOOTOUT_NEEDS_WINNER';
    }
    return null;
  }
  const reason = draft.reason?.trim() ?? '';
  return reason.length === 0 || reason.length > DECISION_REASON_MAX_LENGTH ? 'REASON_REQUIRED' : null;
}

function sourcesOf(match: Match): SlotSource[] {
  return [match.originA, match.originB, slotSource(match.slotA), slotSource(match.slotB)]
    .filter((s): s is SlotSource => s !== undefined);
}

/**
 * „Gleichen Platz lassen“ (Variante C, Daniel F4): nur, wenn der Block nicht Platz 1 enthält und kein Platz des Blocks
 * als Gruppenplatz-Herkunft in einem weiteren Spiel steht (@W2A-063, @W2A-064).
 */
export function sharedPlaceAllowed(
  tournament: Pick<Tournament, 'matches'>,
  groupId: string,
  block: { place: number; size: number },
): boolean {
  if (block.place <= 1) {
    return false;
  }
  const last = block.place + block.size - 1;
  return !tournament.matches.some((m) => sourcesOf(m).some((s) =>
    s.kind === 'groupRank' && s.group === groupId && s.rank >= block.place && s.rank <= last));
}
