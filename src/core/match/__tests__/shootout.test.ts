/**
 * B1b (B-U6): Siegerermittlung im Strafstoßschießen. Reihenfolge der Teams wird nicht erzwungen;
 * Sieger (a) uneinholbar innerhalb der ersten `shootersPerTeam` Schüsse je Team oder (b) gleiche
 * Schusszahl (>= shootersPerTeam) und verschiedene Tore. `suddenDeathAfter` wird bewusst nicht
 * ausgewertet.
 */
import { describe, expect, it } from 'vitest';
import { initialState } from '../applyEvent';
import { shootoutWinner } from '../handlers/shootout';
import type { MatchContext, MatchRules, MatchState } from '../types';

const ctx: MatchContext = { matchId: 'm', teamAId: 'A', teamBId: 'B' };
const baseRules: MatchRules = {
  sections: 1,
  sectionSeconds: 600,
  breakSeconds: 0,
  knockout: true,
  tiebreak: 'shootout',
  overtimeSeconds: 0,
  shootersPerTeam: 5,
  suddenDeathAfter: 5,
  penaltySeconds: 120,
};

/** Baut einen Zustand aus einer Schussfolge wie "A+ B- A+" (Team + Treffer/-). */
function withKicks(sequence: string, rules: MatchRules = baseRules): MatchState {
  const state = initialState(ctx);
  const kicks = sequence
    .split(' ')
    .filter(Boolean)
    .map((token, index) => ({ id: `k${index}`, teamId: token[0], scored: token[1] === '+' }));
  const scores = { ...state.scores };
  for (const kick of kicks) {
    if (kick.scored) {
      scores[kick.teamId] = { ...scores[kick.teamId], shootout: scores[kick.teamId].shootout + 1 };
    }
  }
  return { ...state, rules, status: 'shootout', phase: 'shootout', shootoutKicks: kicks, scores };
}

describe('shootoutWinner', () => {
  it('kein Sieger ohne Schüsse', () => {
    expect(shootoutWinner(withKicks(''), ctx)).toBeNull();
  });

  it('vorzeitiger Sieger: 3:0 nach 3 Runden bei 5 Schützen', () => {
    expect(shootoutWinner(withKicks('A+ B- A+ B- A+ B-'), ctx)).toBe('A');
  });

  it('noch kein Sieger, solange der Rückstand aufholbar ist', () => {
    expect(shootoutWinner(withKicks('A+ B- A+ B- A+'), ctx)).toBeNull();
  });

  it('Reihenfolge wird nicht erzwungen: B schießt dreimal zuerst', () => {
    expect(shootoutWinner(withKicks('B+ B+ B+ A- A- A-'), ctx)).toBe('B');
  });

  it('Gleichstand nach allen regulären Schützen -> kein Sieger', () => {
    expect(shootoutWinner(withKicks('A+ B+ A+ B+ A+ B+ A+ B+ A- B-'), ctx)).toBeNull();
  });

  it('Sudden Death: erst bei gleicher Schusszahl entschieden', () => {
    const regular = 'A+ B+ A+ B+ A+ B+ A+ B+ A+ B+';
    expect(shootoutWinner(withKicks(`${regular} A+`), ctx)).toBeNull();
    expect(shootoutWinner(withKicks(`${regular} A+ B-`), ctx)).toBe('A');
    expect(shootoutWinner(withKicks(`${regular} A+ B+`), ctx)).toBeNull();
  });

  it('suddenDeathAfter wird nicht ausgewertet (Ergebnis unabhängig vom Wert)', () => {
    const sequence = 'A+ B+ A+ B+ A+ B+ A+ B+ A+ B+ A+ B-';
    expect(shootoutWinner(withKicks(sequence, { ...baseRules, suddenDeathAfter: 0 }), ctx)).toBe('A');
    expect(shootoutWinner(withKicks(sequence, { ...baseRules, suddenDeathAfter: 99 }), ctx)).toBe('A');
  });
});
