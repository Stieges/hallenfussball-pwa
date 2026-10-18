/**
 * B-07a: Bausteine fuer `skip`, `unskip` und den Stapel `unskip + enterResult` (@FU-089, @FU-071,
 * @FU-093) und der gemeinsame Kern, der einen oder mehrere Eintraege **nacheinander gegen den
 * laufenden Zustand** pruefen kann. Rein (kein Store, kein Sender): `MatchCommands` speichert das
 * Ergebnis. Ein abgelehnter Eintrag verwirft den ganzen Stapel (R12) -- es entsteht nie ein halber
 * Stapel im Ausgang.
 */
import { applyEvent } from '../applyEvent';
import type { EngineEvent, ErrorCode, MatchContext } from '../types';
import { ERROR_CODES, type Actor } from '../types';
import type { MatchCommandsStore } from './MatchCommands';
import type { MatchEngineView } from './MatchEngine';
import { stampFor } from './matchCommandStamp';
import type { CommandSpec, TeamScores } from './matchCommandTypes';

/** @FU-089: Ueberspringen; der Grund ist optional und fehlt sonst ganz in der Payload. */
export function skipSpec(reason?: string): CommandSpec {
  return { type: 'SKIP', teamId: null, payload: reason === undefined ? {} : { reason } };
}

/** @FU-071: wieder einplanen. */
export const UNSKIP_SPEC: CommandSpec = { type: 'UNSKIP', teamId: null, payload: {} };

/** @FU-080/@FU-093: Ergebnis direkt eintragen. */
export function resultEntrySpec(scores: TeamScores): CommandSpec {
  return { type: 'RESULT_ENTRY', teamId: null, payload: { scores: { ...scores } } };
}

export type BuiltEvents =
  | { ok: true; events: EngineEvent[] }
  | { ok: false; code: ErrorCode; detail?: unknown };

/**
 * Baut die Eintraege und prueft jeden gegen den Zustand NACH dem vorigen. `noop` (z. B. zweites
 * Spielende) ergibt keinen Eintrag. Die erste Ablehnung beendet die Pruefung -- `ok: false`.
 */
export function buildEvents(
  view: MatchEngineView,
  serverNow: number,
  ctx: MatchContext,
  actor: Actor,
  specs: readonly CommandSpec[],
): BuiltEvents {
  const events: EngineEvent[] = [];
  let current = view;
  for (const spec of specs) {
    const stamp = stampFor(spec, current, serverNow);
    if (!stamp.ok) {
      return { ok: false, code: ERROR_CODES.INVALID_PAYLOAD, detail: { reason: stamp.reason } };
    }
    const { at, clockMs, section } = stamp;
    const event: EngineEvent = {
      id: (spec.clock?.kind === 'timing' ? spec.clock.id : undefined) ?? crypto.randomUUID(),
      type: spec.type,
      actor,
      at,
      section,
      clockMs,
      teamId: spec.teamId,
      targetId: spec.targetId ?? null,
      payload: spec.payload,
    };
    const result = applyEvent(current.result.state, event, ctx);
    if (result.status === 'rejected') {
      return { ok: false, code: result.code, detail: result.detail };
    }
    if (result.status === 'accepted') {
      events.push(event);
      current = { ...current, result: { ...current.result, state: result.state }, log: [...current.log, event] };
    }
  }
  return { ok: true, events };
}

/**
 * Speichert die Eintraege eines Befehls: Gast (`'guest'`) sofort bestaetigt, sonst im Ausgang.
 * Ein Eintrag geht einzeln, ein Stapel (>= 2) in EINER Transaktion -- nie ein halber Stapel.
 */
export async function storeEvents(
  store: MatchCommandsStore,
  accountId: string,
  matchId: string,
  events: readonly EngineEvent[],
): Promise<void> {
  const guest = accountId === 'guest';
  if (events.length === 1) {
    await (guest ? store.addConfirmedLocal(accountId, matchId, events[0]) : store.addPending(accountId, matchId, events[0]));
    return;
  }
  await (guest ? store.addConfirmedLocalBatch(accountId, matchId, events) : store.addPendingBatch(accountId, matchId, events));
}
