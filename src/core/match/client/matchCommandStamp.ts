/**
 * B-07: reine Hilfen von `MatchCommands` -- Payload ohne leere Felder, Spielzeit des ersten Tipps
 * (L1, @SL-084) und Zeitstempel eines Eintrags je `ClockSource`. Ausgelagert, damit
 * `MatchCommands.ts` unter 300 Zeilen bleibt.
 */
import { elapsedAt } from '../penalties';
import type { EngineEvent } from '../types';
import type { MatchEngineView } from './MatchEngine';
import type { ClockSource, CommandSpec, CommandTiming } from './matchCommandTypes';

/** Gruende einer Ablehnung (`MatchCommandRejectedError.detail.reason`, Code INVALID_PAYLOAD). */
export type StampRejection = 'CLOCK_OUT_OF_RANGE' | 'SECTION_OUT_OF_RANGE';

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
export function splitFirstTap<T extends { clockMs?: number; section?: number }>(
  options: T | undefined,
): { payload: Record<string, unknown>; clock: ClockSource } {
  const { clockMs, section, ...rest } = options ?? ({} as T);
  return {
    payload: definedFields(rest),
    clock: clockMs === undefined ? { kind: 'now' } : { kind: 'firstTap', clockMs, ...definedFields({ section }) },
  };
}

/** B-07: automatisches Ende mit exakter Grenze (`timing`), sonst Spielzeit des Sendens. */
export function timingClock(timing: CommandTiming | undefined): ClockSource {
  return timing ? { kind: 'timing', ...timing } : { kind: 'now' };
}

function isValidClockMs(clockMs: number): boolean {
  return Number.isInteger(clockMs) && clockMs >= 0;
}

/** Server klemmt `at` ebenso (`append_match_events`): nie vor dem letzten Eintrag im Log. */
function lastAtOf(log: readonly EngineEvent[]): number | null {
  return log.reduce<number | null>((max, event) => (max === null || event.at > max ? event.at : max), null);
}

export type Stamp =
  | { ok: true; at: number; clockMs: number; section: number }
  | { ok: false; reason: StampRejection };

/** Fixrunde F5: Abschnitt des Tipps -- ganze Zahl von 1 bis zum aktuellen Abschnitt. */
function sectionOf(requested: number | undefined, current: number): number | null {
  if (requested === undefined) {
    return current;
  }
  return Number.isInteger(requested) && requested >= 1 && requested <= current ? requested : null;
}

/**
 * Zeitstempel, Spielzeit und Abschnitt eines Eintrags. K4: MATCH_START steht immer am Anfang.
 * Fehlerpolitik: nur ungueltige Werte werden abgelehnt (Spielzeit keine ganze Zahl >= 0,
 * Abschnitt ausserhalb 1..aktuell). Ein erster Tipp nach der aktuellen Spielzeit wird geklemmt
 * (F2); `timing.at` wird wie auf dem Server auf `[letztes at, serverNow]` begrenzt (F3).
 */
export function stampFor(spec: CommandSpec, view: MatchEngineView, serverNow: number): Stamp {
  const at = serverNow;
  const state = view.result.state;
  if (spec.type === 'MATCH_START') {
    return { ok: true, at, clockMs: 0, section: 1 };
  }
  const clock = spec.clock ?? { kind: 'now' };
  if (clock.kind === 'now') {
    return { ok: true, at, clockMs: elapsedAt(state.clock, at), section: state.section };
  }
  const previousOk = clock.kind !== 'set' || isValidClockMs(clock.previousClockMs);
  if (!isValidClockMs(clock.clockMs) || !previousOk) {
    return { ok: false, reason: 'CLOCK_OUT_OF_RANGE' };
  }
  const section = sectionOf(clock.kind === 'set' ? undefined : clock.section, state.section);
  if (section === null) {
    return { ok: false, reason: 'SECTION_OUT_OF_RANGE' };
  }
  switch (clock.kind) {
    case 'firstTap':
      return { ok: true, at, clockMs: Math.min(clock.clockMs, elapsedAt(state.clock, at)), section };
    case 'set':
      return { ok: true, at, clockMs: clock.clockMs, section };
    case 'timing': {
      const lastAt = lastAtOf(view.log);
      const capped = Math.min(clock.at, serverNow);
      return { ok: true, at: lastAt === null ? capped : Math.max(lastAt, capped), clockMs: clock.clockMs, section };
    }
  }
}
