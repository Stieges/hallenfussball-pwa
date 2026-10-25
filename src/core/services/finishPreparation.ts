/**
 * Turnier abschließen – Vorbereitung auf dem Gerät (Plan R3-2b, E4, E5; @LZ-009, @LZ-010, @LZ-012, @LZ-013, @LZ-029), rein,
 * ohne React. Aus der Antwort von `finish_preflight`, der Klärungsliste (`list_match_reviews`) und dem Stand des Geräts
 * entsteht entweder der Grund, warum (noch) nicht abgeschlossen werden kann, oder das, was gesendet wird.
 *
 * Reihenfolge:
 * 1. Zustand: nur „Läuft“ lässt sich abschließen (abgeschlossen → `ALREADY_FINISHED`, sonst `NOT_RUNNING`).
 * 2. Offene Punkte: die des Servers plus offene Klärungen (E5, bis W-M nur hier geprüft) – alle gemeinsam (@LZ-012).
 * 3. Stand (E4): die App rechnet den Endstand nur, wenn ihr Stand dem bestätigten Serverstand gleicht; sonst „Erst
 *    übertragen“ (eigene wartende Einträge) bzw. „Stand neu laden“ – nie ein Abschluss, der sicher `STALE_STATE` bekommt.
 * 4. Endstand: nur `complete` (vorläufig → `PROVISIONAL`), Form wie am Server (`FinalStandingsSnapshotSchema`).
 * Gesendet wird als erwarteter Stand immer `preflight.state`.
 */
import type { Tournament } from '../../types/tournament';
import type { EngineEventsById } from '../../utils/calculations';
import { isOpenReview, type MatchReview } from '../match/review/matchReviewTypes';
import { FinalStandingsSnapshotSchema } from '../models/schemas/FinalStandingsSchema';
import type { FinishItem, FinishPreflight, FinishWarning, InvalidStandingsReason, ReviewOpenItem } from '../repositories/lifecycleRpc';
import { computeFinalStandings, type FinalStandingsSnapshot, type FinalStandingsTournament } from '../standings/finalStandings';
import { computeScorers } from '../standings/scorers';
import { expectedTournamentState, sameTournamentState, type TournamentMatchState } from './lifecycle';

/** Warum (noch) nicht abgeschlossen werden kann – vor dem Senden. */
export type FinishBlocker =
  | { code: 'ALREADY_FINISHED'; at: string | null }
  | { code: 'NOT_RUNNING'; lifecycle: string }
  | { code: 'OPEN_ITEMS'; items: FinishItem[] }
  | { code: 'OWN_OUTBOX'; pending: number }
  | { code: 'STALE_STATE' }
  | { code: 'PROVISIONAL' }
  | { code: 'INVALID_STANDINGS'; reason: InvalidStandingsReason };

export interface FinishReady {
  expectedState: TournamentMatchState[];
  snapshot: FinalStandingsSnapshot;
  warnings: FinishWarning[];
}

export type FinishPreparation = { ok: true; ready: FinishReady } | { ok: false; blocker: FinishBlocker };

export type FinishTournamentInput = Pick<Tournament, 'matches'> & FinalStandingsTournament;

export interface FinishPreparationInput {
  tournament: FinishTournamentInput;
  preflight: FinishPreflight;
  reviews: readonly MatchReview[];
  /** Wartende Einträge dieses Geräts für das Turnier (Ausgang). */
  ownPending: number;
  engineEventsById?: EngineEventsById;
  appVersion: string;
  /** Zeitpunkt der Rechnung (ISO mit Versatz). */
  computedAt: string;
}

/** E5: offene Einträge der Klärungsliste als Punkt `review_open` (Sprungziel Klärungsliste). */
export function openReviewItems(reviews: readonly MatchReview[]): ReviewOpenItem[] {
  return reviews.filter(isOpenReview).map((review) => ({
    kind: 'review_open',
    eventId: review.eventId,
    matchId: review.matchId,
    ...(review.matchNumber !== null ? { matchNumber: review.matchNumber } : {}),
    ...(review.field !== null ? { field: review.field } : {}),
  }));
}

/** Endstand mit Torschützen zum Speichern (@ET-045: mit App-Version); vorläufig oder formwidrig → Grund. */
export function buildFinalStandingsSnapshot(
  tournament: FinishTournamentInput,
  { engineEventsById, appVersion, computedAt }: Pick<FinishPreparationInput, 'engineEventsById' | 'appVersion' | 'computedAt'>,
): { ok: true; snapshot: FinalStandingsSnapshot } | { ok: false; blocker: FinishBlocker } {
  const computed = computeFinalStandings(tournament, engineEventsById);
  if (computed.state !== 'complete') {
    return { ok: false, blocker: { code: 'PROVISIONAL' } };
  }
  const snapshot: FinalStandingsSnapshot = {
    format: 1,
    ranking: computed.ranking,
    scorers: computeScorers(tournament, engineEventsById),
    appVersion,
    computedAt,
  };
  return FinalStandingsSnapshotSchema.safeParse(snapshot).success
    ? { ok: true, snapshot }
    : { ok: false, blocker: { code: 'INVALID_STANDINGS', reason: 'SHAPE' } };
}

export function prepareFinish(input: FinishPreparationInput): FinishPreparation {
  const { preflight } = input;
  if (preflight.lifecycle === 'finished') {
    return { ok: false, blocker: { code: 'ALREADY_FINISHED', at: preflight.finishedAt } };
  }
  if (preflight.lifecycle !== 'running') {
    return { ok: false, blocker: { code: 'NOT_RUNNING', lifecycle: preflight.lifecycle } };
  }
  const items: FinishItem[] = [...preflight.items, ...openReviewItems(input.reviews)];
  if (items.length > 0) {
    return { ok: false, blocker: { code: 'OPEN_ITEMS', items } };
  }
  if (!sameTournamentState(expectedTournamentState(input.tournament), preflight.state)) {
    return { ok: false, blocker: input.ownPending > 0 ? { code: 'OWN_OUTBOX', pending: input.ownPending } : { code: 'STALE_STATE' } };
  }
  const built = buildFinalStandingsSnapshot(input.tournament, input);
  if (!built.ok) {
    return built;
  }
  return { ok: true, ready: { expectedState: preflight.state, snapshot: built.snapshot, warnings: preflight.warnings } };
}
