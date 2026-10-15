/**
 * Ergebnis eines Spiels im PDF als Zustand (B-28a3-4, Punkt 1; Regeln aus @BM-011, @BM-012, @BM-013, @BM-045).
 * Rückgabe ist ein Zustand, kein Text: Ziffern nur bei `final`, `live` zeigt ein laufendes Spiel ohne Ziffern.
 * Zeichnen folgt in a3-5. Nur Rechnen, ohne Zeichnen.
 */
import type { StatefulMatch } from './tournamentState';

/** Markierung unter oder neben dem Ergebnis: korrigiert (mit Zeit der letzten Korrektur) oder übersprungen. */
export type ResultMark = { kind: 'corrected'; at: Date } | { kind: 'skipped' };

export type ResultState =
  | { kind: 'final'; scoreA: number; scoreB: number; mark?: ResultMark }
  | { kind: 'live' }
  | { kind: 'empty'; mark?: ResultMark };

/** Fassung: „Spielplan zum Ausfüllen“ (`blank`) hat keine Ergebnisse, auch nicht für beendete Spiele. */
export type ResultEdition = 'plan' | 'blank';

/** Zustand eines Spiels. `running` (auch pausiert, Verlängerung, Strafstoßschießen) ist `live`. */
export function resultState(match: StatefulMatch, edition: ResultEdition = 'plan'): ResultState {
  if (edition === 'blank') {
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
      const mark: ResultMark | undefined = korrigiert ? { kind: 'corrected', at: new Date(korrigiert.timestamp) } : undefined;
      return mark
        ? { kind: 'final', scoreA: match.scoreA, scoreB: match.scoreB, mark }
        : { kind: 'final', scoreA: match.scoreA, scoreB: match.scoreB };
    }
    case 'skipped':
      return { kind: 'empty', mark: { kind: 'skipped' } };
    default:
      // geplant oder wartend: wie geplant, ohne Ergebnis
      return { kind: 'empty' };
  }
}
