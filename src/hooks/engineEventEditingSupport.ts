/**
 * engineEventEditingSupport (C3b-1): Typen, i18n-Schluessel-Tabellen und die Alt-Regel fuer Minus aus
 * `useEngineEventEditing.ts` ausgelagert (Dateigroesse < 300 Zeilen).
 */
import type { BlockReason, TargetKind } from '../core/match/client';

export type Side = 'home' | 'away';

export interface EditingMatch {
  id: string;
  status: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  homeScore: number;
  awayScore: number;
  playPhase?: string;
  overtimeScoreA?: number;
  overtimeScoreB?: number;
  events: readonly { id: string }[];
}

/** Geaenderte Angaben aus dem Bearbeiten-Dialog (G10): Nummer setzen ODER Nummer leeren. */
export interface EventFieldChanges {
  playerNumber?: number;
  clearPlayerNumber?: boolean;
}

/** A-08c: nur noch Typ-Kompatibilität für `LiveCockpit` (Altzweige entfernt, ohne Engine-Ansicht passiert nichts). */
export interface LegacyEditHandlers {
  onGoal: (matchId: string, teamId: string, delta: -1) => void;
  onUndoLastEvent?: (matchId: string) => void;
  onUpdateEvent?: (matchId: string, eventId: string, updates: { playerNumber?: number; incomplete?: boolean }) => void;
  onDeleteEvent?: (matchId: string, eventId: string) => void;
}

export interface EventEditingParams {
  tournamentId: string;
  match: EditingMatch | null;
  readOnly: boolean;
  legacy?: LegacyEditHandlers;
  notify: { success: (message: string) => void; error: (message: string) => void };
}

export interface SideState {
  canMinus: boolean;
  /** Beschriftung mit Ziel (aria-label), nur bei Engine-Spielen mit Ziel. */
  label?: string;
  hint?: string;
}

export const HINT_KEYS = {
  finishedHelper: 'engine.retract.hint.finishedHelper',
  finishedLeitung: 'engine.retract.hint.finishedLeitung',
  decisionPending: 'engine.retract.hint.decisionPending',
  staleBase: 'engine.retract.hint.staleBase',
  regularGoal: 'engine.retract.hint.regularGoal',
  shootout: 'engine.retract.hint.shootout',
  notAllowed: 'engine.retract.hint.notAllowed',
} as const satisfies Record<BlockReason, string>;

export const KIND_KEYS = {
  goal: 'engine.retract.kind.goal',
  ownGoal: 'engine.retract.kind.ownGoal',
  yellowCard: 'engine.retract.kind.yellowCard',
  yellowRedCard: 'engine.retract.kind.yellowRedCard',
  redCard: 'engine.retract.kind.redCard',
  timePenalty: 'engine.retract.kind.timePenalty',
  foul: 'engine.retract.kind.foul',
  substitution: 'engine.retract.kind.substitution',
  shootoutKick: 'engine.retract.kind.shootoutKick',
} as const satisfies Record<TargetKind, string>;

