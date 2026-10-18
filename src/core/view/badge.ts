/**
 * Zustands-Abzeichen eines Spiels (Aufgabe 1.1 Spielanzeige, @OB-065, @OB-066, @ZM-039, @ZM-044, @ZM-115, @ZM-104).
 *
 * Eine reine Zuordnung Status (+ Feinstatus) → Abzeichen, ohne Uhr. Der Feinstatus kommt für die Verwaltung aus der
 * Engine, für Monitor und Zuschauer aus `matches.live_state` (R-SA8, `badgeDetailFromLiveState`). Kein React.
 */
import { z } from 'zod';
import { MatchStatusSchema, PhaseSchema } from '../match/types';
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
  sectionSeconds: z.number().positive().nullish(),
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
  const detail: MatchBadgeEngineDetail = { status: s.status, phase: s.phase, section: s.section, sections: s.sections ?? 1 };
  if (typeof s.sectionSeconds === 'number') {
    detail.sectionSeconds = s.sectionSeconds;
  }
  if (typeof s.elapsedMs === 'number') {
    const running = typeof s.anchorAt === 'number' ? Math.max(0, nowMs - s.anchorAt) : 0;
    detail.sectionElapsedSec = Math.max(0, Math.floor((s.elapsedMs + running - (s.sectionStartMs ?? 0)) / MS_PER_SECOND));
  }
  if (typeof s.breakStartedAt === 'number' && typeof s.breakSeconds === 'number') {
    detail.breakRemainingSec = Math.max(0, s.breakSeconds - Math.floor((nowMs - s.breakStartedAt) / MS_PER_SECOND));
  }
  return detail;
}
