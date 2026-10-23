/**
 * B-50 Klärungsliste: Entscheidungen eines Falls senden (A-35 Übergabe). Ablauf:
 *  1. nur mit Netz und mit Konto – die Liste kommt vom Server, eine vorgemerkte Entscheidung könnte veraltet ankommen;
 *  2. Spiel in die Engine holen und abgleichen (`ensureMatch`, `catchUp`), Einträge `REVIEW_ACCEPT`/`REVIEW_DISCARD` mit
 *     `targetId` bauen (`buildEvents`, Akteur `leitung`, keine Feldsteuerung nötig – A-35 D8);
 *  3. alle Entscheidungen des Falls in EINEM Aufruf am Ausgang vorbei senden (`OutboxSender.sendNow`, ein Stapel);
 *  4. Ergebnis: nur „angenommen“/„doppelt“ für ALLE Einträge zählt als entschieden (Review M3) → abgleichen (die Server-
 *     Kopie kommt über das normale Nachladen). Abgelehnt → Grund (`ALREADY_DECIDED`, `KNOCKOUT_FINISHED` …), Recht entzogen
 *     (`FORBIDDEN_ACTOR` oder `review RIGHTS_REVOKED`) → `notAllowed`, jedes andere Ergebnis → `notSent`. Es bleibt nichts
 *     halb gespeichert (Server-Transaktion).
 * Rein bis auf die übergebenen Abhängigkeiten (kein React).
 */
import { MatchCommandRejectedError, type MatchEngine, type OutboxSender } from '../../core/match/client';
import { buildEvents } from '../../core/match/client/matchCommandsSkip';
import { isClientOutdated } from '../../core/repositories/appendMatchEventsRpc';
import type { MatchContext } from '../../core/match';
import type { ReviewDecision } from '../../core/match/review/reviewDecision';

export type DecisionOutcome =
  | { status: 'saved'; accepted: number; matchFinished: boolean }
  | { status: 'offline' }
  | { status: 'notSent' }
  | { status: 'outdated' }
  | { status: 'notAllowed' }
  | { status: 'rejected'; code: string; reason: string | null };

export interface SendDecisionsInput {
  engine: Pick<MatchEngine, 'ensureMatch' | 'catchUp' | 'view' | 'serverNow'>;
  sender: Pick<OutboxSender, 'sendNow'>;
  online: () => boolean;
  tournamentId: string;
  matchId: string;
  ctx: MatchContext;
  decisions: ReviewDecision[];
}

const reasonOf = (detail: unknown): string | null =>
  typeof detail === 'object' && detail !== null && 'reason' in detail && typeof detail.reason === 'string' ? detail.reason : null;

/** Review M3: ein Ergebnis, das die Entscheidung nicht gespeichert hat. */
function notDecided(entry: { status: string; code?: string; detail?: unknown } | undefined): DecisionOutcome {
  if (!entry) {
    return { status: 'notSent' };
  }
  if (entry.code === 'FORBIDDEN_ACTOR' || (entry.status === 'review' && entry.code === 'RIGHTS_REVOKED')) {
    return { status: 'notAllowed' };
  }
  return entry.status === 'rejected' ? { status: 'rejected', code: entry.code ?? 'UNKNOWN', reason: reasonOf(entry.detail) } : { status: 'notSent' };
}

export async function sendReviewDecisions(input: SendDecisionsInput): Promise<DecisionOutcome> {
  const { engine, matchId } = input;
  if (!input.online()) {
    return { status: 'offline' };
  }
  if (input.decisions.length === 0) {
    return { status: 'saved', accepted: 0, matchFinished: false };
  }
  try {
    await engine.ensureMatch(matchId, input.ctx, input.tournamentId);
    await engine.catchUp(matchId);
  } catch {
    return { status: 'notSent' };
  }
  const view = engine.view(matchId);
  if (!view) {
    return { status: 'notSent' };
  }
  const specs = input.decisions.map((decision) => ({ type: decision.type, teamId: null, targetId: decision.targetId, payload: {} }));
  const built = buildEvents(view, engine.serverNow(), input.ctx, 'leitung', specs);
  if (!built.ok) {
    return { status: 'rejected', code: built.code, reason: reasonOf(built.detail) };
  }
  let result: Awaited<ReturnType<OutboxSender['sendNow']>>;
  try {
    result = await input.sender.sendNow(matchId, built.events);
  } catch (error) {
    if (error instanceof MatchCommandRejectedError) {
      return { status: 'rejected', code: error.code, reason: reasonOf(error.detail) };
    }
    return { status: 'notSent' };
  }
  if (isClientOutdated(result)) {
    return { status: 'outdated' };
  }
  const open = result.results.find((entry) => entry.status !== 'accepted' && entry.status !== 'duplicate');
  if (open || result.results.length !== built.events.length) {
    return notDecided(open);
  }
  await engine.catchUp(matchId).catch(() => undefined);
  return {
    status: 'saved',
    accepted: input.decisions.filter((decision) => decision.type === 'REVIEW_ACCEPT').length,
    matchFinished: view.result.state.status === 'finished',
  };
}
