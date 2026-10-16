/**
 * B-07: reine Hilfen von `MatchCommands` -- Payload ohne leere Felder, Spielzeit des ersten Tipps
 * (L1, @SL-084) und Zeitstempel eines Eintrags je `ClockSource`. Ausgelagert, damit
 * `MatchCommands.ts` unter 300 Zeilen bleibt.
 */
import { elapsedAt } from '../penalties';
import type { EngineEvent } from '../types';
import type { MatchEngineView } from './MatchEngine';
import type { ClockSource, CommandSpec, CommandTiming } from './matchCommandTypes';

/** Grund der Ablehnung einer ungueltigen Spielzeit (`MatchCommandRejectedError.detail`). */
export const CLOCK_OUT_OF_RANGE = { reason: 'CLOCK_OUT_OF_RANGE' } as const;

export function definedFields<T extends object>(fields: T): Partial<T> {
  const result: Partial<T> = {};
  for (const key of Object.keys(fields) as (keyof T)[]) {
    if (fields[key] !== undefined) {
      result[key] = fields[key];
    }
  }
  return result;
}

/** L1: `clockMs` gehoert in den Umschlag, nicht in die Payload; fehlt sie, zaehlt das Senden. */
export function splitFirstTap<T extends { clockMs?: number }>(
  options: T | undefined,
): { payload: Record<string, unknown>; clock: ClockSource } {
  const { clockMs, ...rest } = options ?? ({} as T);
  return {
    payload: definedFields(rest),
    clock: clockMs === undefined ? { kind: 'now' } : { kind: 'firstTap', clockMs },
  };
}

/** B-07: automatisches Ende mit exakter Grenze (`timing`), sonst Spielzeit des Sendens. */
export function timingClock(timing: CommandTiming | undefined): ClockSource {
  return timing ? { kind: 'timing', clockMs: timing.clockMs, at: timing.at } : { kind: 'now' };
}

function isValidClockMs(clockMs: number): boolean {
  return Number.isInteger(clockMs) && clockMs >= 0;
}

/** Server klemmt `at` ebenso (`append_match_events`): nie vor dem letzten Eintrag im Log. */
function lastAtOf(log: readonly EngineEvent[]): number | null {
  return log.reduce<number | null>((max, event) => (max === null || event.at > max ? event.at : max), null);
}

export type Stamp = { ok: true; at: number; clockMs: number } | { ok: false };

/**
 * Zeitstempel und Spielzeit eines Eintrags. K4: MATCH_START steht immer am Anfang (clockMs 0).
 * Fehlerpolitik: eine Spielzeit, die keine ganze Zahl >= 0 ist oder (erster Tipp) hinter der
 * aktuellen Spielzeit liegt, ergibt `{ ok: false }` -- der Aufrufer lehnt ab, nichts wird gespeichert.
 */
export function stampFor(spec: CommandSpec, view: MatchEngineView, serverNow: number): Stamp {
  const at = serverNow;
  if (spec.type === 'MATCH_START') {
    return { ok: true, at, clockMs: 0 };
  }
  const clock = spec.clock ?? { kind: 'now' };
  if (clock.kind === 'now') {
    return { ok: true, at, clockMs: elapsedAt(view.result.state.clock, at) };
  }
  if (!isValidClockMs(clock.clockMs)) {
    return { ok: false };
  }
  switch (clock.kind) {
    case 'firstTap':
      return clock.clockMs > elapsedAt(view.result.state.clock, at) ? { ok: false } : { ok: true, at, clockMs: clock.clockMs };
    case 'set':
      return { ok: true, at, clockMs: clock.clockMs };
    case 'timing': {
      const lastAt = lastAtOf(view.log);
      return { ok: true, at: lastAt === null ? clock.at : Math.max(clock.at, lastAt), clockMs: clock.clockMs };
    }
  }
}
