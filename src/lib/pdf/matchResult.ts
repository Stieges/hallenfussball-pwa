/**
 * Ergebnis eines Spiels im PDF als Zustand (B-28a3-4, Punkt 1; Regeln aus @BM-011, @BM-012, @BM-013, @BM-045).
 * Rückgabe ist ein Zustand, kein Text: Ziffern nur bei `final`; `live` (laufend oder unterbrochen) steht im Ausdruck wie `empty`,
 * ohne „läuft“ und ohne Zwischenstand (@DR-019). Nur Rechnen, ohne Zeichnen.
 */
import type { StatefulMatch } from './tournamentState';

/**
 * Markierung unter dem Ergebnis (@DR-001, @BM-013): gewertet (Nichtantritt, `decidedBy: 'forfeit'`) oder korrigiert mit der Zeit der
 * letzten Korrektur. Beides zugleich: „gewertet“ – es sagt, dass das Spiel nicht gespielt wurde; der Platz reicht nur für ein Kennzeichen.
 */
export type ResultMark = { kind: 'awarded' } | { kind: 'corrected'; at: Date };

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

/**
 * Fassung: „Spielplan ohne Ergebnisse“ (`blank`) hat keine Ergebnisse, auch nicht für beendete Spiele. `final` ist die
 * Endstand-Fassung (C10) und zeigt Ergebnisse wie `plan`.
 */
export type ResultEdition = 'plan' | 'blank' | 'final';

/**
 * Eingang der Zustandsrechnung. `results` ist der Schalter „Ergebnisse zeigen“ des PDF-Dialogs (`includeScores`
 * in `PDFExportOptions`): aus heißt leer, unabhängig vom Status (B-28a3-4F F4).
 */
export interface ResultOptions {
  edition?: ResultEdition;
  results?: boolean;
}

/** Zustand eines Spiels. `running` und `paused` (Halbzeit, Pause, Verlängerung, Strafstoßschießen) sind `live`. */
export function resultState(match: StatefulMatch, options: ResultOptions = {}): ResultState {
  const { edition = 'plan', results = true } = options;
  if (edition === 'blank' || !results) {
    return { kind: 'empty' };
  }
  switch (match.matchStatus) {
    case 'running':
    case 'paused':
      return { kind: 'live' };
    case 'finished': {
      if (match.scoreA === undefined || match.scoreB === undefined) {
        return { kind: 'empty' };
      }
      const korrigiert = match.correctionHistory?.at(-1);
      const state: ResultState = { kind: 'final', scoreA: match.scoreA, scoreB: match.scoreB };
      if (match.decidedBy === 'forfeit') {
        state.mark = { kind: 'awarded' };
      } else if (korrigiert) {
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
    case 'scheduled':
    case 'waiting':
    case undefined:
      // geplant oder wartend: wie geplant, ohne Ergebnis
      return { kind: 'empty' };
    default:
      return assertNeverStatus(match.matchStatus);
  }
}

/** Neuer `MatchStatus`-Wert ohne Zweig oben: `tsc` meldet es hier (C-MATCHSTATUS-OHNE-PAUSED). */
function assertNeverStatus(status: never): never {
  throw new Error(`Unbekannter Spielstatus: ${String(status)}`);
}

/**
 * Zustand für den Ausdruck (@DR-019): „ausgefallen“ steht auch bei ausgeblendeten Ergebnissen; leere Linien statt „ausgefallen“
 * hat nur die Fassung ohne Ergebnisse. Ein laufendes oder unterbrochenes Spiel steht wie ein Spiel ohne Ergebnis da, ohne „läuft“
 * und ohne Zwischenstand; das Modell zeichnet für `live` leere Linien.
 */
export function printState(match: StatefulMatch, options: ResultOptions): ResultState {
  if (options.edition !== 'blank' && match.matchStatus === 'skipped') {
    return { kind: 'skipped' };
  }
  return resultState(match, options);
}

/** Text des Kennzeichens unter dem Ergebnis: „gewertet“ bzw. „korrigiert 14:52“; ohne Kennzeichen `undefined`. */
export function resultMarkText(state: ResultState, t: { awarded: string; corrected: (time: string) => string; formatClock: (date: Date) => string }): string | undefined {
  if (state.kind !== 'final' || state.mark === undefined) {
    return undefined;
  }
  return state.mark.kind === 'awarded' ? t.awarded : t.corrected(t.formatClock(state.mark.at));
}
