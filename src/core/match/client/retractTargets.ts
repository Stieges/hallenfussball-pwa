/**
 * retractTargets (C3b-1, Plan G1-G3, G5): framework-freie Zielwahl fuer Minus/Rueckgaengig und die
 * Feldsperre beim Bearbeiten -- ohne React, ohne Store.
 *
 * - G1: keine Autor-/Geraete-Filterung, jeder zuruecknehmbare Eintrag zaehlt (CORRECTION ausser
 *   fuer die Leitung, ab C3d).
 * - G1a: Rueckgaengig ueberspringt AMEND und CORRECTION; Reihenfolge = Ansichts-Reihenfolge (`log`,
 *   G2a), das Ziel ist der letzte zulaessige Eintrag.
 * - G1b: nach dem Abpfiff (`finished`) ist Zuruecknehmen fuer ALLE gesperrt -- nur in der Oberflaeche,
 *   die Engine bleibt unveraendert (Plan §8 Zeile 1). Die Sperre greift VOR dem Probelauf.
 * - G2: Minus sucht rueckwaerts in `state.goals` (deckt OWN_GOAL des Gegners ab).
 * - Zulaessigkeit sonst per Probelauf `applyEvent(RETRACT)` (deckt STALE_BASE, Verlaengerung, Shootout ab).
 */
import { applyEvent } from '../applyEvent';
import { isDetailEmpty, type DetailField } from '../details';
import { ERROR_CODES } from '../types';
import type { Actor, EngineEvent, ErrorCode, EventType, MatchContext, MatchState } from '../types';

/** Warum (noch) nichts zurueckgenommen werden kann -- Grundlage der Hinweistexte (G3). */
export type BlockReason =
  | 'finishedHelper'
  | 'finishedLeitung'
  | 'decisionPending'
  | 'staleBase'
  | 'regularGoal'
  | 'shootout'
  | 'notAllowed';

export type TargetKind =
  | 'goal'
  | 'ownGoal'
  | 'yellowCard'
  | 'yellowRedCard'
  | 'redCard'
  | 'timePenalty'
  | 'foul'
  | 'substitution'
  | 'shootoutKick';

export interface RetractTarget {
  id: string;
  kind: TargetKind;
  teamId: string | null;
  playerNumber?: number;
}

export interface TargetSelection {
  /** `null`, wenn nichts zurueckgenommen werden kann. */
  target: RetractTarget | null;
  /** `null` bei "gar kein Kandidat" (Knopf nur deaktiviert, kein Hinweis) oder wenn ein Ziel da ist. */
  blockReason: BlockReason | null;
}

export interface TargetInput {
  state: MatchState;
  /** Ansichts-Reihenfolge (bestaetigt nach seq, dann acked, dann pending) -- `MatchEngineView.log`. */
  log: readonly EngineEvent[];
  ctx: MatchContext;
  actor: Actor;
  /** Serverzeit fuer den Probelauf. */
  at: number;
}

const KIND_BY_TYPE: Partial<Record<EventType, TargetKind>> = {
  GOAL: 'goal',
  OWN_GOAL: 'ownGoal',
  YELLOW_CARD: 'yellowCard',
  YELLOW_RED_CARD: 'yellowRedCard',
  RED_CARD: 'redCard',
  TIME_PENALTY: 'timePenalty',
  FOUL: 'foul',
  SUBSTITUTION: 'substitution',
  SHOOTOUT_KICK: 'shootoutKick',
};

function ownEvent(state: MatchState, id: string): EngineEvent | undefined {
  return Object.hasOwn(state.accepted, id) ? state.accepted[id] : undefined;
}

function describeTarget(state: MatchState, event: EngineEvent, kind: TargetKind): RetractTarget {
  const details = Object.hasOwn(state.details, event.id) ? state.details[event.id] : undefined;
  const playerNumber = details?.playerNumber ?? details?.shooterNumber;
  return {
    id: event.id,
    kind,
    teamId: event.teamId ?? null,
    ...(playerNumber !== undefined ? { playerNumber } : {}),
  };
}

function probeRetract(input: TargetInput, targetId: string): ErrorCode | null {
  const probe: EngineEvent = {
    id: `probe-${targetId}`,
    type: 'RETRACT',
    actor: input.actor,
    at: input.at,
    section: input.state.section,
    clockMs: null,
    teamId: null,
    targetId,
    payload: {},
  };
  const result = applyEvent(input.state, probe, input.ctx);
  return result.status === 'rejected' ? result.code : null;
}

function reasonFor(state: MatchState, target: EngineEvent, code: ErrorCode): BlockReason {
  if (code === ERROR_CODES.STALE_BASE) {
    return 'staleBase';
  }
  if (code === ERROR_CODES.INVALID_PAYLOAD) {
    if (state.status === 'shootout') {
      return 'shootout';
    }
    if (state.phase === 'overtime' && (target.type === 'GOAL' || target.type === 'OWN_GOAL')) {
      return 'regularGoal';
    }
  }
  return 'notAllowed';
}

/** G1b/G3: Sperren, die VOR dem Probelauf greifen. */
function statusGate(input: TargetInput): BlockReason | null {
  const { status } = input.state;
  if (status === 'finished') {
    return input.actor === 'leitung' ? 'finishedLeitung' : 'finishedHelper';
  }
  if (status === 'decision_pending') {
    return 'decisionPending';
  }
  return null;
}

/** Erster zulaessiger Kandidat (Reihenfolge wie geliefert); sonst der Grund des ersten Kandidaten. */
function pickTarget(input: TargetInput, candidates: readonly EngineEvent[]): TargetSelection {
  if (candidates.length === 0) {
    return { target: null, blockReason: null };
  }
  const gate = statusGate(input);
  if (gate !== null) {
    return { target: null, blockReason: gate };
  }
  let firstReason: BlockReason | null = null;
  for (const event of candidates) {
    const code = probeRetract(input, event.id);
    if (code === null) {
      const kind = KIND_BY_TYPE[event.type];
      return kind === undefined
        ? { target: null, blockReason: 'notAllowed' }
        : { target: describeTarget(input.state, event, kind), blockReason: null };
    }
    firstReason ??= reasonFor(input.state, event, code);
  }
  return { target: null, blockReason: firstReason };
}

/** G1a/G2a: der letzte zulaessige, nicht zurueckgenommene Eintrag der Ansicht (AMEND/CORRECTION uebersprungen). */
export function undoTarget(input: TargetInput): TargetSelection {
  const candidates: EngineEvent[] = [];
  for (let index = input.log.length - 1; index >= 0; index--) {
    const event = ownEvent(input.state, input.log[index].id);
    if (
      event !== undefined &&
      KIND_BY_TYPE[event.type] !== undefined &&
      !input.state.retracted.includes(event.id)
    ) {
      candidates.push(event);
    }
  }
  return pickTarget(input, candidates);
}

/** G2/G6: das letzte zulaessige Tor, das `teamId` erzielt hat (OWN_GOAL des Gegners eingeschlossen). */
export function minusTarget(input: TargetInput, teamId: string): TargetSelection {
  if (input.state.status === 'shootout') {
    return { target: null, blockReason: 'shootout' };
  }
  const candidates: EngineEvent[] = [];
  for (let index = input.state.goals.length - 1; index >= 0; index--) {
    const goal = input.state.goals[index];
    const event = ownEvent(input.state, goal.id);
    if (goal.scoringTeamId === teamId && event !== undefined && !input.state.retracted.includes(goal.id)) {
      candidates.push(event);
    }
  }
  return pickTarget(input, candidates);
}

export type AmendBlockReason = 'unknownTarget' | 'retracted' | 'notAmendable' | 'finishedHelperLocked';

export interface AmendCheck {
  allowed: boolean;
  reason: AmendBlockReason | null;
}

/**
 * G5: nach dem Abpfiff darf ein Helfer nur LEERE Angaben ergaenzen; gesetzte Felder sind fuer ihn
 * gesperrt (Korrektur nur durch die Turnierleitung). Leitung und laufendes Spiel: erlaubt.
 */
export function canAmendField(
  input: Pick<TargetInput, 'state' | 'actor'>,
  targetId: string,
  field: DetailField,
): AmendCheck {
  const event = ownEvent(input.state, targetId);
  if (event === undefined) {
    return { allowed: false, reason: 'unknownTarget' };
  }
  if (input.state.retracted.includes(targetId)) {
    return { allowed: false, reason: 'retracted' };
  }
  if (KIND_BY_TYPE[event.type] === undefined) {
    return { allowed: false, reason: 'notAmendable' };
  }
  if (input.state.status === 'finished' && input.actor === 'helper') {
    const details = Object.hasOwn(input.state.details, targetId) ? input.state.details[targetId] : {};
    if (!isDetailEmpty(details[field], field)) {
      return { allowed: false, reason: 'finishedHelperLocked' };
    }
  }
  return { allowed: true, reason: null };
}

export interface RetractCheck {
  allowed: boolean;
  blockReason: BlockReason | null;
}

/** Darf genau dieses Ziel zurueckgenommen werden (Loeschen im Protokoll)? Gleiche Sperren wie Rueckgaengig. */
export function checkRetract(input: TargetInput, targetId: string): RetractCheck {
  const event = ownEvent(input.state, targetId);
  if (event === undefined || KIND_BY_TYPE[event.type] === undefined) {
    return { allowed: false, blockReason: 'notAllowed' };
  }
  const gate = statusGate(input);
  if (gate !== null) {
    return { allowed: false, blockReason: gate };
  }
  const code = probeRetract(input, targetId);
  return code === null
    ? { allowed: true, blockReason: null }
    : { allowed: false, blockReason: reasonFor(input.state, event, code) };
}

/** Beschreibung eines beliebigen (nicht zwingend zurueckgenommenen) Ereignisses fuer Toasts. */
export function describeEventTarget(state: MatchState, targetId: string): RetractTarget | null {
  const event = ownEvent(state, targetId);
  const kind = event === undefined ? undefined : KIND_BY_TYPE[event.type];
  return event === undefined || kind === undefined ? null : describeTarget(state, event, kind);
}
