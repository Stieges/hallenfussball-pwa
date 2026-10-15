/**
 * Ergebnis eines Spiels im PDF als Zustand (B-28a3-4, Punkt 1; Regeln aus @BM-011, @BM-012, @BM-013, @BM-045).
 * Rückgabe ist ein Zustand, kein Text: Ziffern nur bei `final`, `live` zeigt ein laufendes Spiel ohne Ziffern.
 * Zeichnen folgt in a3-5. Nur Rechnen, ohne Zeichnen.
 */
import type { StatefulMatch } from './tournamentState';

/** Markierung unter dem Ergebnis: korrigiert, mit Zeit der letzten Korrektur. */
export interface ResultMark { kind: 'corrected'; at: Date }

/** Zwei Tore-Zahlen eines Spielabschnitts (nach Verlängerung, Strafstoßschießen). */
export interface ScorePair { a: number; b: number }

/**
 * `skipped` ist eine eigene Art (B-28 C1, a3-4-Review N5): ein ausgefallenes Spiel bekommt keine Schreibfelder, anders
 * als `empty`. `overtime` und `penalty` tragen die Zahlen, soweit das Turnier sie hat (N6).
 */
export type ResultState =
  | { kind: 'final'; scoreA: number; scoreB: number; mark?: ResultMark; overtime?: ScorePair; penalty?: ScorePair }
  | { kind: 'live' }
  | { kind: 'skipped' }
  | { kind: 'empty' };

/** Fassung: „Spielplan zum Ausfüllen“ (`blank`) hat keine Ergebnisse, auch nicht für beendete Spiele. */
export type ResultEdition = 'plan' | 'blank';

/**
 * Eingang der Zustandsrechnung. `results` ist der Schalter „Ergebnisse zeigen“ des PDF-Dialogs (`includeScores`
 * in `PDFExportOptions`): aus heißt leer, unabhängig vom Status (B-28a3-4F F4).
 */
export interface ResultOptions {
  edition?: ResultEdition;
  results?: boolean;
}

/** Zustand eines Spiels. `running` (auch pausiert, Verlängerung, Strafstoßschießen) ist `live`. */
export function resultState(match: StatefulMatch, options: ResultOptions = {}): ResultState {
  const { edition = 'plan', results = true } = options;
  if (edition === 'blank' || !results) {
    return { kind: 'empty' };
  }
  switch (match.matchStatus) {
    case 'running':
      return { kind: 'live' };
    case 'finished': {
      if (match.scoreA === undefined || match.scoreB === undefined) {
        return { kind: 'empty' };
      }
      const korrigiert = match.correctionHistory?.at(-1);
      const state: ResultState = { kind: 'final', scoreA: match.scoreA, scoreB: match.scoreB };
      if (korrigiert) {
        state.mark = { kind: 'corrected', at: new Date(korrigiert.timestamp) };
      }
      if (match.overtimeScoreA !== undefined && match.overtimeScoreB !== undefined) {
        state.overtime = { a: match.overtimeScoreA, b: match.overtimeScoreB };
      }
      if (match.penaltyScoreA !== undefined && match.penaltyScoreB !== undefined) {
        state.penalty = { a: match.penaltyScoreA, b: match.penaltyScoreB };
      }
      return state;
    }
    case 'skipped':
      return { kind: 'skipped' };
    default:
      // geplant oder wartend: wie geplant, ohne Ergebnis
      return { kind: 'empty' };
  }
}
