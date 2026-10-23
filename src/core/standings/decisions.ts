/**
 * Entscheidung der Turnierleitung über einen Gleichstand nach allen Kriterien (Paket TB, Plan v2 § 3.2, R-TB-4, R-TB-11).
 *
 * Gültig ist eine Entscheidung genau dann, wenn (a) der offene Block ohne Entscheidungen heute genau ihre Teams umfasst
 * und (b) ihr Fingerabdruck der Grundlage gleich dem heutigen ist: Punkteschema, aktive Kriterien in Reihenfolge und
 * `[id, scoreA, scoreB, matchStatus, forfeitAbsent]` aller Gruppenspiele, an denen ein Team des Blocks beteiligt ist
 * (@W2A-005, @W2A-052, @W2A-053; Nichtantritt GA4 A-25c – ein 0:0 als Wertung beider ist eine andere Grundlage als ein
 * gespieltes 0:0). Ist darunter eine Wertung beider Seiten, gehört auch die Wertung des Turniers dazu (sie setzt deren
 * Gegentore). Reine Rechnung – nichts wird gelöscht; kehrt dieselbe Grundlage zurück, gilt sie wieder.
 * Eine Annahme („Ergebnis so akzeptieren“) gilt zusätzlich nur, solange ihr Platz nicht ausgespielt werden muss –
 * geprüft beim Anwenden in `rankGroup` (Einstellung, Herkünfte; @W2A-068, @W2A-069, TB-3').
 * Rein, ohne React.
 */
import type { ForfeitScore, Match, PlacementCriterion, PointSystem, StandingDecision, Tournament } from '../../types/tournament';
import { matchSideTeamId } from '../models/matchSlot';
import { isDoubleForfeit, isForfeitMatch } from '../models/forfeit';
import { blockMayShare, effectivePlacementsToPlayOut, followUpRanks } from './playOutPlaces';

export type DecisionErrorCode =
  | 'SHOOTOUT_NEEDS_WINNER'
  | 'ORDER_MISMATCH'
  | 'REASON_REQUIRED'
  | 'ALREADY_DECIDED'
  | 'BLOCK_CHANGED'
  | 'STALE'
  | 'OFFLINE'
  /** GA4 A-13b-C: Verklemmung/Wartezeit am Server (`40P01`/`55P03`) – nichts geschrieben, „Bitte erneut versuchen“. */
  | 'RETRY_LATER'
  | 'SHARED_PLACE_NOT_ALLOWED'
  | 'WITHDRAW_NOT_ALLOWED';

/**
 * Was die Turnierleitung einträgt; Kennung und Grundlage ergänzt der Dienst. Der Grund einer Reihenfolge wird geprüft,
 * aber nicht im öffentlich lesbaren `config` gespeichert (@W2A-072); er geht an `record_standing_decision` und steht nur im
 * Verlauf (GA4 A-13b-C).
 */
export type DecisionDraft = Pick<StandingDecision, 'groupId' | 'teamIds' | 'order' | 'kind' | 'shootout'> & { reason?: string };

/** Grund: Pflicht nur bei einer Reihenfolge (3+ Teams), 1–500 Zeichen (Hinweis „keine Spielernamen“ in der Oberfläche). */
export const DECISION_REASON_MAX_LENGTH = 500;

export const sortedIds = (ids: readonly string[]): string[] => [...ids].sort();

export const sameTeamSet = (a: readonly string[], b: readonly string[]): boolean => {
  const x = sortedIds(a);
  const y = sortedIds(b);
  return x.length === y.length && x.every((id, i) => id === y[i]);
};

export interface BasisInput {
  pointSystem: PointSystem;
  forfeitScore: ForfeitScore;
  placementLogic: readonly PlacementCriterion[];
  matches: readonly Match[];
}

/** Fingerabdruck der Grundlage eines Blocks. */
export function decisionBasis(input: BasisInput, teamIds: readonly string[]): string {
  const members = new Set(teamIds);
  const blockMatches = input.matches
    .filter((m) => [matchSideTeamId(m, 'A'), matchSideTeamId(m, 'B')].some((id) => id !== undefined && members.has(id)));
  const matches = blockMatches
    .map((m) => [m.id, m.scoreA ?? null, m.scoreB ?? null, m.matchStatus ?? null, isForfeitMatch(m) ? m.forfeitAbsent ?? null : null] as const)
    .sort((a, b) => a[0].localeCompare(b[0]));
  return JSON.stringify({
    points: [input.pointSystem.win, input.pointSystem.draw, input.pointSystem.loss],
    criteria: input.placementLogic.filter((c) => c.enabled).map((c) => c.id),
    matches,
    ...(blockMatches.some(isDoubleForfeit) ? { forfeit: [input.forfeitScore.winner, input.forfeitScore.loser] } : {}),
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

/** Prüfungen am Eintrag selbst, ohne Tabelle (gleich mit und ohne Netz, @W2A-061, @W2A-062, @W2A-044). */
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
  if (draft.kind === 'shared') {
    return null; // „Ergebnis so akzeptieren“: ein Tipp, kein Grund (Daniel B4d, @W2A-063)
  }
  const reason = draft.reason?.trim() ?? '';
  return reason.length === 0 || reason.length > DECISION_REASON_MAX_LENGTH ? 'REASON_REQUIRED' : null;
}

/**
 * „Ergebnis so akzeptieren“ erlaubt? Nur, wenn kein Platz des Blocks in der Einstellung steht und keiner als
 * Gruppenplatz-Herkunft in ein weiteres Spiel führt (ganzer Block; @W2A-063, @W2A-064, @W2A-067, @ET-057). Platz 1 ist
 * nur über die Einstellung geschützt (Voreinstellung), abgewählt darf er geteilt werden. Dieselbe Regel nutzt die
 * Oberfläche für die Hinweisform: falsch = „Strafstoßschießen nötig“, wahr = „Gleichstand – Entscheidung nötig“.
 */
export function sharedPlaceAllowed(
  tournament: Pick<Tournament, 'matches' | 'teams' | 'placementsToPlayOut'>,
  groupId: string,
  block: { place: number; size: number },
): boolean {
  return blockMayShare(effectivePlacementsToPlayOut(tournament), followUpRanks(tournament.matches, groupId), block);
}
