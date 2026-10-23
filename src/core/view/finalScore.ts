/**
 * Der EINE Endstand eines Spiels (A-36b, Brief R-A36b-1; Befund C-ENDSTAND-NICHT-ZENTRAL).
 *
 * - Tore = regulär + Verlängerung/Golden Goal. Die Engine schreibt Verlängerungstore nur in `overtimeScoreA/B`
 *   (`cacheColumns`), `scoreA/B` bleibt die reguläre Spielzeit.
 * - Das Strafstoßschießen steht getrennt und entscheidet nur den Sieger, seine Tore zählen nicht (IFAB Regel 10,
 *   @ET-013).
 * - Sieger nach Verlängerung oder Strafstoßschießen (@ET-002); Gruppen-Unentschieden ohne Entscheidung.
 *
 * Rein, ohne React. Tabelle (`getMatchWinner`), Cockpit (`getEffectiveScore`, ÜBERGANG) und die Ansicht
 * (`MatchView.score`) lesen den Endstand nur hier; der Wächter-Test hält das fest.
 */
import type { Match } from '../../types/tournament';
import { isDoubleForfeit } from '../models/forfeit';

export type FinalDecision = 'regular' | 'overtime' | 'goldenGoal' | 'penalty';

export interface FinalScore {
  /** Tore inkl. Verlängerung/Golden Goal, OHNE Strafstoßschießen (IFAB Regel 10). */
  a: number;
  b: number;
  regular: { a: number; b: number };
  /** Nur Verlängerungs-Tore. */
  overtime?: { a: number; b: number };
  /** Strafstoßschießen getrennt. */
  penalty?: { a: number; b: number };
  /** null = nicht entschieden (Unentschieden in der Gruppe oder noch offen). */
  decidedBy: FinalDecision | null;
  /** Aus decidedBy; der Strafstoß entscheidet nur den Sieger. */
  winner: 'a' | 'b' | null;
}

/** Was der Endstand vom Spiel liest. */
export type FinalScoreSource = Partial<
  Pick<Match, 'scoreA' | 'scoreB' | 'overtimeScoreA' | 'overtimeScoreB' | 'penaltyScoreA' | 'penaltyScoreB' | 'decidedBy' | 'forfeitAbsent'>
> & { matchStatus?: Match['matchStatus'] };

export type Pair = { a: number; b: number };

/** Tore beider Seiten: regulär + Verlängerung, ohne Strafstoßschießen. */
export function finalGoals(regular: Pair, overtime: Pick<FinalScoreSource, 'overtimeScoreA' | 'overtimeScoreB'>): Pair {
  return { a: regular.a + (overtime.overtimeScoreA ?? 0), b: regular.b + (overtime.overtimeScoreB ?? 0) };
}

function leader(pair: Pair): 'a' | 'b' | null {
  if (pair.a === pair.b) {
    return null;
  }
  return pair.a > pair.b ? 'a' : 'b';
}

function decide(m: FinalScoreSource, goals: Pair, penalty: Pair | undefined, hasOvertime: boolean): Pick<FinalScore, 'decidedBy' | 'winner'> {
  if (isDoubleForfeit(m)) {
    // Beide nicht angetreten: kein Sieger, gleich welcher Stand gespeichert ist (@TM-062, A-14b-Hinweis an A-25c).
    return { decidedBy: null, winner: null };
  }
  if (m.decidedBy === 'penalty') {
    // Ohne Strafstoß-Stand kein Sieger – ein Datenfehler, keine Ausnahme (Brief A-36b Schritt 3).
    return { decidedBy: 'penalty', winner: penalty === undefined ? null : leader(penalty) };
  }
  const winner = leader(goals);
  if (winner === null) {
    return { decidedBy: null, winner: null };
  }
  if (m.decidedBy === 'overtime' || m.decidedBy === 'goldenGoal') {
    return { decidedBy: m.decidedBy, winner };
  }
  if (m.decidedBy === undefined && hasOvertime) {
    return { decidedBy: 'overtime', winner };
  }
  return { decidedBy: 'regular', winner };
}

/**
 * Endstand bzw. Zwischenstand eines Spiels. `null`, solange kein Stand eingetragen ist oder das Spiel ausgefallen ist.
 * Laufend/unterbrochen: Zwischenstand ohne Entscheidung und ohne Sieger.
 */
export function matchFinalScore(m: FinalScoreSource): FinalScore | null {
  if (m.scoreA === undefined || m.scoreB === undefined || m.matchStatus === 'skipped') {
    return null;
  }
  const regular: Pair = { a: m.scoreA, b: m.scoreB };
  const hasOvertime = m.overtimeScoreA !== undefined || m.overtimeScoreB !== undefined;
  const overtime: Pair | undefined = hasOvertime ? { a: m.overtimeScoreA ?? 0, b: m.overtimeScoreB ?? 0 } : undefined;
  const goals = finalGoals(regular, m);
  const live = m.matchStatus === 'running' || m.matchStatus === 'paused';
  const shootout: Pair | undefined =
    m.penaltyScoreA !== undefined && m.penaltyScoreB !== undefined ? { a: m.penaltyScoreA, b: m.penaltyScoreB } : undefined;
  // Strafstoß nur, wenn er entschieden hat oder gerade läuft – nie aus einem (fälschlich) gesetzten Feld.
  const penalty = live || m.decidedBy === 'penalty' ? shootout : undefined;
  const decision = live
    ? { decidedBy: null, winner: null }
    : decide(m, goals, penalty, hasOvertime && (overtime?.a ?? 0) + (overtime?.b ?? 0) > 0);
  return {
    ...goals,
    regular,
    ...(overtime === undefined ? {} : { overtime }),
    ...(penalty === undefined ? {} : { penalty }),
    ...decision,
  };
}
