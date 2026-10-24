/**
 * Zeiten verschieben (B-26, Record `2026-10-02_zeitplan-rueckt-nach.md`, Teil B3.2) – reine Regeln, ohne React.
 *
 * - Verschieben ab einer Uhrzeit oder ab einem Spiel um ±Minuten, immer auf allen Feldern (@ZP-012, @ZP-013, @ZP-015).
 * - Laufende, unterbrochene (Halbzeit, „Ergebnis folgt“), beendete und gewertete Spiele werden nie verschoben, ausgefallene
 *   nicht mitverschoben und nicht mitgezählt (@ZP-016, @ZP-062, @ZP-093).
 * - Vorziehen in die Vergangenheit nimmt die App nicht an (@ZP-057); „jetzt“ ist die Serverzeit (Aufrufer).
 * - Warnungen sperren nie: Puffer auf dem Feld kürzer als die eingestellte Pause (@ZP-096, Gegenbeispiel @ZP-097) und
 *   „beginnt in X Minuten“ beim Vorziehen auf weniger als 30 Minuten (@ZP-089).
 * - „ursprünglich“: Bezug ist die Uhrzeit beim ersten Anpfiff des Turniers. Davor ist jede Änderung Planung (kein Bezug), außer
 *   ein Spiel rückt kurzfristig früher (< 30 Minuten bis zum neuen Anpfiff, @ZP-089/@ZP-090/@ZP-091, @ZP-049). Stimmt die
 *   Uhrzeit wieder mit der ursprünglichen überein, entfällt der Bezug (@ZP-005).
 * - Ursprüngliche Uhrzeiten wiederherstellen: nur nicht angepfiffene Spiele; läge die Uhrzeit in der Vergangenheit, bleibt das
 *   Spiel, wo es ist, und wird genannt (@ZP-036, @ZP-037).
 *
 * Das neue Ende ist das Ende des letzten Spiels (Anpfiff + Spieldauer mit Halbzeitpausen). Die Reserve für Verlängerung und
 * Strafstoßschießen ist im Record Zeitrahmen und Fairness noch geparkt (Höhe offen) und hier nicht eingerechnet.
 */
import type { Match, Tournament } from '../../types/tournament';
import type { ViewMatchStatus } from '../view/types';
import { viewStatus } from '../view/status';
import { calculateTotalMatchDuration } from '../generators/scheduleHelpers';

const MINUTE_MS = 60_000;
/** Grenze „kurzfristig“ (Entscheidung Daniel 2026-10-02 (4)): fest, nicht je Turnier einstellbar. */
export const SHORT_NOTICE_MINUTES = 30;

/** Zeitregeln des Turniers, aus denen Spieldauer und Pause zwischen den Spielen kommen. */
export type ShiftTimingRules = Pick<
  Tournament,
  'groupPhaseGameDuration' | 'groupPhaseBreakDuration' | 'finalRoundGameDuration' | 'finalRoundBreakDuration' | 'gamePeriods' | 'halftimeBreak'
>;

export interface ShiftContext {
  /** Jetzt laut Server (Zone 1: nicht die Uhr des Geräts). */
  now: Date;
  /** Fachlicher Status je Spiel (Ansicht der Leitung inkl. Engine); ohne Angabe aus dem Stand der Turnierkopie. */
  statusOf?: (match: Match) => ViewMatchStatus;
}

export type ShiftStart = { kind: 'time'; at: Date } | { kind: 'match'; matchId: string };

export interface ShiftRequest {
  from: ShiftStart;
  /** Minuten, positiv = nach hinten (später), negativ = vorziehen (früher). */
  minutes: number;
}

export interface ShiftedMatch {
  matchId: string;
  matchNumber?: number;
  field: number;
  from: Date;
  to: Date;
}

export interface KeptMatch {
  matchId: string;
  matchNumber?: number;
  reason: 'running' | 'finished' | 'cancelled' | 'past';
}

export type ShiftWarning =
  | { kind: 'buffer'; field: number; before: number | undefined; after: number | undefined; gapMinutes: number; requiredMinutes: number }
  | { kind: 'soon'; matchNumbers: Array<number | undefined>; at: Date; inMinutes: number };

export interface PastError {
  kind: 'past';
  /** Spiele, die in die Vergangenheit rücken würden, mit ihrer neuen Uhrzeit */
  matches: Array<{ matchId: string; matchNumber?: number; to: Date }>;
  now: Date;
  /** So viele Minuten ließe sich höchstens vorziehen (0 = gar nicht). */
  maxMinutes: number;
}

export interface ShiftPlan {
  /** Spiele, die eine neue Uhrzeit bekommen (sortiert nach Uhrzeit, dann Feld). */
  changes: ShiftedMatch[];
  /** Spiele ab dem Start, die bleiben, wie sie sind (laufend, beendet, ausgefallen; beim Wiederherstellen: Vergangenheit). */
  kept: KeptMatch[];
  oldEnd?: Date;
  newEnd?: Date;
  warnings: ShiftWarning[];
  /** Gesetzt = nicht anwendbar; alle Uhrzeiten bleiben. */
  error?: PastError;
  /** Die vollständige Spielliste nach der Änderung (bei Fehler unverändert). */
  matches: Match[];
}

type ShiftClass = 'open' | 'running' | 'finished' | 'cancelled';

function classify(status: ViewMatchStatus): ShiftClass {
  switch (status) {
    case 'scheduled':
      return 'open';
    case 'running':
    case 'paused':
      return 'running';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'finished'; // finished, awarded
  }
}

function statusFn(ctx: ShiftContext): (m: Match) => ViewMatchStatus {
  return ctx.statusOf ?? ((m) => viewStatus(m));
}

function isFinalMatch(m: Match): boolean {
  return m.isFinal === true || (m.phase !== undefined && m.phase !== 'groupStage');
}

/** Spieldauer inkl. Halbzeitpausen, Gruppen- bzw. Finalrunde. */
export function matchDurationMinutes(m: Match, rules: ShiftTimingRules): number {
  const game = isFinalMatch(m) ? rules.finalRoundGameDuration ?? rules.groupPhaseGameDuration : rules.groupPhaseGameDuration;
  return calculateTotalMatchDuration(game, rules.gamePeriods ?? 1, rules.halftimeBreak ?? 0);
}

/** Eingestellte Pause zwischen den Spielen (Puffer auf dem Feld). */
export function breakMinutes(m: Match, rules: ShiftTimingRules): number {
  return (isFinalMatch(m) ? rules.finalRoundBreakDuration ?? rules.groupPhaseBreakDuration : rules.groupPhaseBreakDuration) ?? 0;
}

function timeOf(m: Match): number | undefined {
  if (m.scheduledTime === undefined) {
    return undefined;
  }
  const ms = new Date(m.scheduledTime).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

function originalOf(m: Match): number | undefined {
  if (m.originalStart === undefined) {
    return undefined;
  }
  const ms = new Date(m.originalStart).getTime();
  return Number.isNaN(ms) ? undefined : ms;
}

/** Ist das Turnier angepfiffen (mindestens ein Spiel läuft, ist unterbrochen, beendet oder gewertet)? */
export function isTournamentKickedOff(matches: readonly Match[], ctx: Pick<ShiftContext, 'statusOf'> = {}): boolean {
  const status = ctx.statusOf ?? ((m: Match) => viewStatus(m));
  return matches.some((m) => {
    const c = classify(status(m));
    return c === 'running' || c === 'finished';
  });
}

/**
 * „ursprünglich hh:mm“: die ursprüngliche Uhrzeit, wenn sie mindestens 1 Minute von der aktuellen abweicht (@ZP-004, @ZP-005);
 * sonst `undefined`.
 */
export function originalStartToShow(m: Match): Date | undefined {
  const orig = originalOf(m);
  const now = timeOf(m);
  if (orig === undefined || now === undefined || Math.abs(now - orig) < MINUTE_MS) {
    return undefined;
  }
  return new Date(orig);
}

/** Gibt es ein noch nicht angepfiffenes Spiel mit abweichender ursprünglicher Uhrzeit (Wiederherstellen sinnvoll)? */
export function hasRestorableTimes(matches: readonly Match[], ctx: Pick<ShiftContext, 'statusOf'> = {}): boolean {
  const status = ctx.statusOf ?? ((m: Match) => viewStatus(m));
  return matches.some((m) => classify(status(m)) === 'open' && originalStartToShow(m) !== undefined);
}

function endOf(matches: readonly Match[], rules: ShiftTimingRules, status: (m: Match) => ViewMatchStatus): Date | undefined {
  let end: number | undefined;
  for (const m of matches) {
    const t = timeOf(m);
    if (t === undefined || classify(status(m)) === 'cancelled') {
      continue;
    }
    const e = t + matchDurationMinutes(m, rules) * MINUTE_MS;
    end = end === undefined ? e : Math.max(end, e);
  }
  return end === undefined ? undefined : new Date(end);
}

function byTimeThenField(a: { to: Date; field: number }, b: { to: Date; field: number }): number {
  return a.to.getTime() - b.to.getTime() || a.field - b.field;
}

/** Puffer-Warnungen: je Feld benachbarte Spiele, deren Abstand die Änderung neu unter die eingestellte Pause drückt. */
function bufferWarnings(before: readonly Match[], after: readonly Match[], changed: ReadonlySet<string>, rules: ShiftTimingRules, status: (m: Match) => ViewMatchStatus): ShiftWarning[] {
  const oldById = new Map(before.map((m) => [m.id, m]));
  const usable = after.filter((m) => timeOf(m) !== undefined && classify(status(m)) !== 'cancelled');
  const fields = [...new Set(usable.map((m) => m.field))].sort((a, b) => a - b);
  const warnings: ShiftWarning[] = [];
  for (const field of fields) {
    const row = usable.filter((m) => m.field === field).sort((a, b) => (timeOf(a) ?? 0) - (timeOf(b) ?? 0));
    for (let i = 1; i < row.length; i += 1) {
      const prev = row[i - 1];
      const next = row[i];
      if (!changed.has(prev.id) && !changed.has(next.id)) {
        continue;
      }
      const gap = ((timeOf(next) ?? 0) - (timeOf(prev) ?? 0)) / MINUTE_MS - matchDurationMinutes(prev, rules);
      const required = breakMinutes(prev, rules);
      const prevOld = oldById.get(prev.id);
      const nextOld = oldById.get(next.id);
      const gapBefore = prevOld && nextOld
        ? ((timeOf(nextOld) ?? 0) - (timeOf(prevOld) ?? 0)) / MINUTE_MS - matchDurationMinutes(prevOld, rules)
        : Number.POSITIVE_INFINITY;
      // Nur, was die Änderung neu verursacht (Record: „betreffen nur, was die Änderung neu verursacht“)
      if (gap < required && gap < gapBefore) {
        warnings.push({ kind: 'buffer', field, before: prev.matchNumber, after: next.matchNumber, gapMinutes: Math.round(gap), requiredMinutes: required });
      }
    }
  }
  return warnings;
}

/** „beginnt in X Minuten“: früher gelegte Spiele mit neuem Anpfiff in weniger als 30 Minuten, je Uhrzeit eine Warnung. */
function soonWarnings(changes: readonly ShiftedMatch[], now: Date): ShiftWarning[] {
  const soon = changes.filter((c) => {
    const ahead = c.to.getTime() - now.getTime();
    return c.to.getTime() < c.from.getTime() && ahead >= 0 && ahead < SHORT_NOTICE_MINUTES * MINUTE_MS;
  });
  const byTime = new Map<number, ShiftedMatch[]>();
  for (const c of soon) {
    const key = c.to.getTime();
    byTime.set(key, [...(byTime.get(key) ?? []), c]);
  }
  return [...byTime.entries()]
    .sort(([a], [b]) => a - b)
    .map(([at, group]) => ({
      kind: 'soon' as const,
      matchNumbers: group.map((c) => c.matchNumber),
      at: new Date(at),
      inMinutes: Math.floor((at - now.getTime()) / MINUTE_MS),
    }));
}

/** Neue ursprüngliche Uhrzeit eines verschobenen Spiels nach der Regel aus Zone 1. */
function nextOriginal(m: Match, to: number, kickedOff: boolean, now: Date): Date | undefined {
  const old = timeOf(m) ?? to;
  const existing = originalOf(m);
  const shortNoticeEarlier = to < old && to - now.getTime() < SHORT_NOTICE_MINUTES * MINUTE_MS;
  const keepReference = kickedOff || shortNoticeEarlier;
  if (!keepReference) {
    return undefined; // Planung vor dem ersten Anpfiff setzt den Bezugspunkt neu (@ZP-049, @ZP-091)
  }
  const reference = existing ?? old;
  return Math.abs(to - reference) < MINUTE_MS ? undefined : new Date(reference);
}

function applyChanges(matches: readonly Match[], targets: ReadonlyMap<string, number>, kickedOff: boolean, now: Date): Match[] {
  return matches.map((m) => {
    const to = targets.get(m.id);
    if (to === undefined) {
      return m;
    }
    const originalStart = nextOriginal(m, to, kickedOff, now);
    const { originalStart: _drop, ...rest } = m;
    return { ...rest, scheduledTime: new Date(to), ...(originalStart === undefined ? {} : { originalStart }) };
  });
}

function keptReason(c: ShiftClass): KeptMatch['reason'] {
  return c === 'running' ? 'running' : c === 'cancelled' ? 'cancelled' : 'finished';
}

function startMs(matches: readonly Match[], from: ShiftStart): number | undefined {
  if (from.kind === 'time') {
    return from.at.getTime();
  }
  const m = matches.find((x) => x.id === from.matchId);
  return m === undefined ? undefined : timeOf(m);
}

/** Plan für „Zeiten verschieben“ (ohne Bestätigung ändert sich nichts: die Liste gilt erst, wenn der Aufrufer sie speichert). */
export function planShift(matches: readonly Match[], request: ShiftRequest, rules: ShiftTimingRules, ctx: ShiftContext): ShiftPlan {
  const status = statusFn(ctx);
  const start = startMs(matches, request.from);
  const kickedOff = isTournamentKickedOff(matches, ctx);
  const oldEnd = endOf(matches, rules, status);
  if (start === undefined || request.minutes === 0) {
    return { changes: [], kept: [], warnings: [], matches: [...matches], ...(oldEnd ? { oldEnd, newEnd: oldEnd } : {}) };
  }
  const delta = request.minutes * MINUTE_MS;
  const targets = new Map<string, number>();
  const changes: ShiftedMatch[] = [];
  const kept: KeptMatch[] = [];
  for (const m of matches) {
    const t = timeOf(m);
    if (t === undefined || t < start) {
      continue;
    }
    const c = classify(status(m));
    if (c !== 'open') {
      kept.push({ matchId: m.id, ...(m.matchNumber === undefined ? {} : { matchNumber: m.matchNumber }), reason: keptReason(c) });
      continue;
    }
    targets.set(m.id, t + delta);
    changes.push({ matchId: m.id, ...(m.matchNumber === undefined ? {} : { matchNumber: m.matchNumber }), field: m.field, from: new Date(t), to: new Date(t + delta) });
  }
  changes.sort(byTimeThenField);

  const past = request.minutes < 0 ? changes.filter((c) => c.to.getTime() < ctx.now.getTime()) : [];
  if (past.length > 0) {
    const room = Math.min(...changes.map((c) => Math.floor((c.from.getTime() - ctx.now.getTime()) / MINUTE_MS)));
    return {
      changes,
      kept,
      warnings: [],
      matches: [...matches],
      ...(oldEnd ? { oldEnd, newEnd: oldEnd } : {}),
      error: {
        kind: 'past',
        matches: past.map((c) => ({ matchId: c.matchId, ...(c.matchNumber === undefined ? {} : { matchNumber: c.matchNumber }), to: c.to })),
        now: ctx.now,
        maxMinutes: Math.max(0, room),
      },
    };
  }

  const next = applyChanges(matches, targets, kickedOff, ctx.now);
  const newEnd = endOf(next, rules, status);
  return {
    changes,
    kept,
    warnings: [...soonWarnings(changes, ctx.now), ...bufferWarnings(matches, next, new Set(targets.keys()), rules, status)],
    matches: next,
    ...(oldEnd ? { oldEnd } : {}),
    ...(newEnd ? { newEnd } : {}),
  };
}

/** Wendet `planShift` an; bei Fehler bleibt die Liste unverändert (Bauplan B-26: `shiftSchedule`). */
export function shiftSchedule(matches: readonly Match[], request: ShiftRequest, rules: ShiftTimingRules, ctx: ShiftContext): Match[] {
  return planShift(matches, request, rules, ctx).matches;
}

/**
 * Ursprüngliche Uhrzeiten wiederherstellen (@ZP-036, @ZP-037): nur nicht angepfiffene Spiele; angepfiffene behalten Uhrzeit und
 * Bezug. Läge die ursprüngliche Uhrzeit in der Vergangenheit, bleibt das Spiel und steht in `kept` (Grund `past`).
 */
export function planRestore(matches: readonly Match[], rules: ShiftTimingRules, ctx: ShiftContext): ShiftPlan {
  const status = statusFn(ctx);
  const oldEnd = endOf(matches, rules, status);
  const changes: ShiftedMatch[] = [];
  const kept: KeptMatch[] = [];
  for (const m of matches) {
    const orig = originalStartToShow(m);
    const t = timeOf(m);
    if (orig === undefined || t === undefined || classify(status(m)) !== 'open') {
      continue;
    }
    if (orig.getTime() < ctx.now.getTime()) {
      kept.push({ matchId: m.id, ...(m.matchNumber === undefined ? {} : { matchNumber: m.matchNumber }), reason: 'past' });
      continue;
    }
    changes.push({ matchId: m.id, ...(m.matchNumber === undefined ? {} : { matchNumber: m.matchNumber }), field: m.field, from: new Date(t), to: orig });
  }
  changes.sort(byTimeThenField);
  const targets = new Set(changes.map((c) => c.matchId));
  const toById = new Map(changes.map((c) => [c.matchId, c.to] as const));
  const next = matches.map((m) => {
    const to = toById.get(m.id);
    if (to === undefined) {
      return m;
    }
    const { originalStart: _drop, ...rest } = m;
    return { ...rest, scheduledTime: new Date(to) };
  });
  const newEnd = endOf(next, rules, status);
  return {
    changes,
    kept,
    warnings: [...soonWarnings(changes, ctx.now), ...bufferWarnings(matches, next, targets, rules, status)],
    matches: next,
    ...(oldEnd ? { oldEnd } : {}),
    ...(newEnd ? { newEnd } : {}),
  };
}
