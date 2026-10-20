/**
 * Zustands-Abzeichen eines Spiels (Aufgabe 1.1 Spielanzeige, @OB-065, @OB-066, @ZM-039, @ZM-044, @ZM-115, @ZM-104).
 *
 * Eine reine Zuordnung Status (+ Feinstatus) → Abzeichen, ohne Uhr. Der Feinstatus kommt für die Verwaltung aus der
 * Engine, für Monitor und Zuschauer aus `matches.live_state` (R-SA8, `badgeDetailFromLiveState`). Kein React.
 */
import { z } from 'zod';
import { elapsedAt } from '../match/penalties';
import { overtimeStartMsOf } from '../match/client/viewDuration';
import { MatchStatusSchema, PhaseSchema, type MatchState } from '../match/types';
import type { EngineStatus, LocalClock, ViewMatchStatus } from './types';

export type MatchBadgeState = 'live' | 'pause' | 'halftime' | 'overtime' | 'shootout' | 'ended' | 'cancelled';

export interface MatchBadgeEngineDetail {
  status: EngineStatus;
  phase: 'regular' | 'overtime' | 'shootout';
  /** 1-basiert */
  section: number;
  /** Zahl der regulären Abschnitte */
  sections: number;
  /** Länge eines regulären Abschnitts (für `spectatorClockOf`, 5.1a) */
  sectionSeconds?: number;
  /** Im aktuellen Abschnitt gespielte Sekunden, aus elapsedMs/anchorAt (für `spectatorClockOf`, 5.1a) */
  sectionElapsedSec?: number;
  /** Rest der Pause aus breakStartedAt/breakSeconds */
  breakRemainingSec?: number;
  /** Länge der Verlängerung (Restzeit in der Verlängerung, 5.1a) */
  overtimeSeconds?: number;
  /** Uhrstand (Sekunden) am Anpfiff der Verlängerung, nur in der Verlängerung (Monitor-Dauer, Paket MU; wie `viewDurationSeconds`) */
  overtimeStartSec?: number;
  /** Die Spieluhr läuft (Anker gesetzt): `spectatorClockOf` zählt ab `asOfMs` weiter */
  running?: boolean;
  /** Zeitpunkt (Geräteuhr, ms), auf den sich `sectionElapsedSec` und `breakRemainingSec` beziehen */
  asOfMs?: number;
}

export interface MatchBadgeInput {
  status: ViewMatchStatus;
  engine?: MatchBadgeEngineDetail;
  kickoff?: LocalClock;
}

export type MatchBadgeModel =
  | { kind: 'badge'; state: MatchBadgeState }
  | { kind: 'kickoff'; time: string }
  | { kind: 'none' };

/** Schlüssel des Abzeichen-Worts (Namensraum `tournament`); eine Wortquelle für Oberfläche und `viewStatusText`. */
export const MATCH_BADGE_WORD_KEY: Record<MatchBadgeState, `matchBadge.${MatchBadgeState}`> = {
  live: 'matchBadge.live',
  pause: 'matchBadge.pause',
  halftime: 'matchBadge.halftime',
  overtime: 'matchBadge.overtime',
  shootout: 'matchBadge.shootout',
  ended: 'matchBadge.ended',
  cancelled: 'matchBadge.cancelled',
};

const badge = (state: MatchBadgeState): MatchBadgeModel => ({ kind: 'badge', state });

/** Zustand eines laufenden oder unterbrochenen Spiels aus dem Feinstatus. Die Pausen-Zustände haben Vorrang vor der Phase (@ZM-044). */
function liveState(engine: MatchBadgeEngineDetail, fallback: 'live' | 'pause'): MatchBadgeState {
  switch (engine.status) {
    case 'shootout':
      return 'shootout';
    case 'section_break':
      // Halbzeit nur bei genau zwei Abschnitten nach dem ersten; sonst, auch vor Verlängerung und Strafstoßschießen, „Pause“ (@ZM-115, @ZM-044)
      return engine.phase === 'regular' && engine.sections === 2 && engine.section === 1 ? 'halftime' : 'pause';
    case 'decision_pending':
    case 'paused':
      return 'pause';
    case 'running':
      if (engine.phase === 'shootout') {
        return 'shootout';
      }
      return engine.phase === 'overtime' ? 'overtime' : 'live';
    default:
      return fallback;
  }
}

export function matchBadgeModel(input: MatchBadgeInput): MatchBadgeModel {
  switch (input.status) {
    case 'scheduled':
      return input.kickoff === undefined ? { kind: 'none' } : { kind: 'kickoff', time: input.kickoff.time };
    case 'cancelled':
      return badge('cancelled');
    case 'finished':
    case 'awarded':
      return badge('ended');
    case 'running':
      return badge(input.engine === undefined ? 'live' : liveState(input.engine, 'live'));
    case 'paused':
      return badge(input.engine === undefined ? 'pause' : liveState(input.engine, 'pause'));
  }
}

const LiveStateSchema = z.object({
  status: MatchStatusSchema,
  phase: PhaseSchema,
  section: z.number().int().min(1),
  sections: z.number().int().min(1).nullish(),
  sectionSeconds: z.number().nonnegative().nullish(),
  overtimeSeconds: z.number().nonnegative().nullish(),
  sectionStartMs: z.number().nullish(),
  elapsedMs: z.number().nullish(),
  anchorAt: z.number().nullish(),
  breakStartedAt: z.number().nullish(),
  breakSeconds: z.number().nullish(),
});

const MS_PER_SECOND = 1000;

/**
 * Feinstatus aus `matches.live_state` (R-SA8). `nowMs` ist die Zeit des Abrufs für die laufenden Anteile (Uhr und Pause).
 * Ungültige oder fehlende Daten → `undefined`; das Abzeichen kommt dann aus dem Status.
 */
export function badgeDetailFromLiveState(raw: unknown, nowMs: number): MatchBadgeEngineDetail | undefined {
  const parsed = LiveStateSchema.safeParse(raw);
  if (!parsed.success) {
    return undefined;
  }
  const s = parsed.data;
  const detail: MatchBadgeEngineDetail = { status: s.status, phase: s.phase, section: s.section, sections: s.sections ?? 1, asOfMs: nowMs, running: typeof s.anchorAt === 'number' };
  if (typeof s.overtimeSeconds === 'number') {
    detail.overtimeSeconds = s.overtimeSeconds;
  }
  if (typeof s.sectionSeconds === 'number') {
    detail.sectionSeconds = s.sectionSeconds;
  }
  if (typeof s.elapsedMs === 'number') {
    const running = typeof s.anchorAt === 'number' ? Math.max(0, nowMs - s.anchorAt) : 0;
    detail.sectionElapsedSec = Math.max(0, Math.floor((s.elapsedMs + running - (s.sectionStartMs ?? 0)) / MS_PER_SECOND));
  }
  if (s.phase === 'overtime' && typeof s.elapsedMs === 'number' && typeof s.sectionStartMs === 'number') {
    detail.overtimeStartSec = Math.floor(overtimeStartMsOf(s.status, s.elapsedMs, s.sectionStartMs) / MS_PER_SECOND);
  }
  if (typeof s.breakStartedAt === 'number' && typeof s.breakSeconds === 'number') {
    detail.breakRemainingSec = Math.max(0, s.breakSeconds - Math.floor((nowMs - s.breakStartedAt) / MS_PER_SECOND));
  }
  return detail;
}

/**
 * Feinstatus für den Monitor und die Zuschauer-Seite: je Spiel aus `Match.liveState` (R-SA8). Spiele ohne gültiges
 * `live_state` liefern `undefined`; ob der Feinstatus gilt, entscheidet die Ansicht nach dem Cache-Status (A2).
 */
export function engineDetailFromMatches(
  matches: readonly { id: string; liveState?: unknown }[],
  nowMs: number,
): (matchId: string) => MatchBadgeEngineDetail | undefined {
  const byId = new Map(matches.map((m) => [m.id, m.liveState] as const));
  return (matchId) => badgeDetailFromLiveState(byId.get(matchId), nowMs);
}

/** Feinstatus der Verwaltung aus dem Stand der Engine (`MatchState`) zum Zeitpunkt `nowMs`. */
export function badgeDetailFromEngineState(
  state: Pick<MatchState, 'status' | 'phase' | 'section' | 'rules' | 'clock' | 'sectionStartMs' | 'breakStartedAt'>,
  nowMs: number,
): MatchBadgeEngineDetail {
  const rules = state.rules;
  const detail: MatchBadgeEngineDetail = {
    status: state.status, phase: state.phase, section: state.section, sections: rules?.sections ?? 1,
    running: state.clock.running, asOfMs: nowMs,
    sectionElapsedSec: Math.max(0, Math.floor((elapsedAt(state.clock, nowMs) - state.sectionStartMs) / MS_PER_SECOND)),
  };
  if (rules !== null && rules !== undefined) {
    detail.sectionSeconds = rules.sectionSeconds;
    detail.overtimeSeconds = rules.overtimeSeconds;
    if (state.breakStartedAt !== null) {
      detail.breakRemainingSec = Math.max(0, rules.breakSeconds - Math.floor((nowMs - state.breakStartedAt) / MS_PER_SECOND));
    }
  }
  return detail;
}
