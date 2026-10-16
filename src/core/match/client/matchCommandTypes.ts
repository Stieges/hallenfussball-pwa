/**
 * B-07: Options- und Umschlagtypen von `MatchCommands` (reine Typen, ausgelagert, damit
 * `MatchCommands.ts` unter 300 Zeilen bleibt). Besitz Spur B, Absprache Spur A.
 */
import type { EventType } from '../types';

/**
 * L1 (@SL-084): Spielzeit des ersten Tipps. Fehlt sie, gilt die Spielzeit des Sendens
 * (`elapsedAt(clock, serverNow)`). Sie darf nicht hinter der aktuellen Spielzeit liegen.
 */
interface FirstTapClock {
  clockMs?: number;
}

export interface GoalOptions extends FirstTapClock {
  playerNumber?: number;
  assists?: number[];
}

export interface CardOptions extends FirstTapClock {
  playerNumber?: number;
}

export interface TimePenaltyOptions extends FirstTapClock {
  playerNumber?: number;
  durationSeconds?: number;
}

/** C3b-1 (G10): geaenderte Angaben eines Ereignisses (AMEND) -- nur `playerNumber`. */
export interface AmendFields {
  playerNumber?: number;
}

export interface FoulOptions {
  playerNumber?: number;
}

export interface SubstitutionOptions {
  playersIn?: number[];
  playersOut?: number[];
}

/**
 * B-07 (§ B-08b): exakte Grenze fuer automatische Enden. `clockMs` und `at` werden woertlich
 * uebernommen (statt `elapsedAt`/`serverNow`); `at` wird auf das letzte `at` im Log geklemmt.
 */
export interface CommandTiming {
  clockMs: number;
  at: number;
}

/** B-07: Wahl der Entscheidung bei K.-o.-Remis ohne festen Modus (TIEBREAK_CHOICE). */
export type TiebreakChoice = 'overtime' | 'goldenGoal' | 'shootout';

/** B-07: Endstand je Team (`RESULT_ENTRY`, `CORRECTION`) -- Schluessel genau beide Team-IDs. */
export type TeamScores = Record<string, number>;

/**
 * B-07: wie die Spielzeit eines Eintrags entsteht.
 * - `now`: Spielzeit beim Senden (Bestand).
 * - `firstTap`: Spielzeit des ersten Tipps, geprueft gegen die aktuelle Spielzeit (L1).
 * - `set`: Uhr wird auf diesen Wert gestellt (CLOCK_ADJUST, auch vorwaerts).
 * - `timing`: exakte Grenze eines automatischen Endes (`clockMs` und `at` woertlich).
 */
export type ClockSource =
  | { kind: 'now' }
  | { kind: 'firstTap'; clockMs: number }
  | { kind: 'set'; clockMs: number }
  | { kind: 'timing'; clockMs: number; at: number };

/** B-07: ein zu sendender Eintrag (Umschlag ohne `id`, `actor`, `at`, `section`). */
export interface CommandSpec {
  type: EventType;
  teamId: string | null;
  payload: Record<string, unknown>;
  targetId?: string | null;
  clock?: ClockSource;
}
