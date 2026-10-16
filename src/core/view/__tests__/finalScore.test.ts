/**
 * A-36b Schritt 3 (Brief R-A36b-1): der zentrale Endstand `matchFinalScore`.
 * Tore = regulär + Verlängerung/Golden Goal, das Strafstoßschießen steht getrennt und entscheidet nur den Sieger
 * (IFAB Regel 10). Befund C-ENDSTAND-NICHT-ZENTRAL.
 */
import { describe, expect, it } from 'vitest';
import { finalGoals, matchFinalScore, type FinalScoreSource } from '../finalScore';

const finished = (partial: Partial<FinalScoreSource>): FinalScoreSource => ({ matchStatus: 'finished', ...partial });

describe('@ET-002 Platzierungsspiel bestimmt Sieger und Verlierer – auch nach Verlängerung oder Strafstoßschießen', () => {
  // Spiel um Platz 3: DJK Berg (Heim, a) gegen SV Süd (Gast, b), „Verlängerung, dann Strafstoßschießen“.
  it.each([
    ['2:0 nach der regulären Spielzeit', finished({ scoreA: 2, scoreB: 0, decidedBy: 'regular' }), 'a', 'regular', 2, 0],
    [
      '1:1 nach der regulären Spielzeit und 1:2 nach Verlängerung',
      finished({ scoreA: 1, scoreB: 1, overtimeScoreA: 0, overtimeScoreB: 1, decidedBy: 'overtime' }),
      'b', 'overtime', 1, 2,
    ],
    [
      '1:1 nach Verlängerung und mit 4:3 für DJK Berg im Strafstoßschießen',
      finished({ scoreA: 1, scoreB: 1, overtimeScoreA: 0, overtimeScoreB: 0, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' }),
      'a', 'penalty', 1, 1,
    ],
  ] as const)('@ET-002 %s', (_verlauf, match, winner, decidedBy, a, b) => {
    const score = matchFinalScore(match);
    expect(score?.winner).toBe(winner);
    expect(score?.decidedBy).toBe(decidedBy);
    expect([score?.a, score?.b]).toEqual([a, b]);
  });

  it('@ET-002 Gegenbeispiel: 1:2 n. V. – der Verlierer nach regulärer Zeit (1:1) wird nicht Sieger', () => {
    const score = matchFinalScore(finished({ scoreA: 1, scoreB: 1, overtimeScoreA: 0, overtimeScoreB: 1, decidedBy: 'overtime' }));
    expect(score?.winner).not.toBe('a');
    expect(score?.regular).toEqual({ a: 1, b: 1 });
    expect(score?.overtime).toEqual({ a: 0, b: 1 });
  });
});

describe('@ET-013 Die Tore des Strafstoßschießens zählen nicht zu den Toren', () => {
  it('@ET-013 F-ES: 1:1 n. V., 4:3 im Strafstoßschießen → Tore 1:1, Strafstoß getrennt, Sieger Heim', () => {
    const score = matchFinalScore(
      finished({ scoreA: 1, scoreB: 1, overtimeScoreA: 0, overtimeScoreB: 0, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' }),
    );
    expect(score).toEqual({
      a: 1, b: 1,
      regular: { a: 1, b: 1 },
      overtime: { a: 0, b: 0 },
      penalty: { a: 4, b: 3 },
      decidedBy: 'penalty',
      winner: 'a',
    });
  });

  it('@ET-013 Gegenbeispiel: ein Gruppenspiel mit (fälschlich) gesetztem Strafstoß und decidedBy regular ignoriert ihn', () => {
    const score = matchFinalScore(finished({ scoreA: 2, scoreB: 2, penaltyScoreA: 5, penaltyScoreB: 4, decidedBy: 'regular' }));
    expect(score?.penalty).toBeUndefined();
    expect(score?.winner).toBeNull();
    expect(score?.decidedBy).toBeNull();
    expect([score?.a, score?.b]).toEqual([2, 2]);
  });

  it('@ET-013 Gegenbeispiel: decidedBy penalty ohne Strafstoß-Stand → kein Sieger, keine Ausnahme', () => {
    const score = matchFinalScore(finished({ scoreA: 1, scoreB: 1, decidedBy: 'penalty' }));
    expect(score?.decidedBy).toBe('penalty');
    expect(score?.winner).toBeNull();
    expect(score?.penalty).toBeUndefined();
  });
});

describe('@ET-002 Endstand: Verlängerung, Golden Goal, Gruppe, laufend', () => {
  it('@ET-002 F-NV: HF2 1:1, Verlängerung 4:1 → Verlängerungs-Tore 3:0, decidedBy overtime', () => {
    const score = matchFinalScore(finished({ scoreA: 1, scoreB: 1, overtimeScoreA: 3, overtimeScoreB: 0, decidedBy: 'overtime' }));
    expect(score).toMatchObject({ a: 4, b: 1, overtime: { a: 3, b: 0 }, decidedBy: 'overtime', winner: 'a' });
    expect(score?.penalty).toBeUndefined();
  });

  it('@ET-002 Golden Goal: 0:0, Golden Goal für den Gast → 0:1, decidedBy goldenGoal', () => {
    const score = matchFinalScore(finished({ scoreA: 0, scoreB: 0, overtimeScoreA: 0, overtimeScoreB: 1, decidedBy: 'goldenGoal' }));
    expect(score).toMatchObject({ a: 0, b: 1, decidedBy: 'goldenGoal', winner: 'b' });
  });

  it('@ET-002 Gruppenspiel 2:2 → decidedBy null, winner null', () => {
    expect(matchFinalScore(finished({ scoreA: 2, scoreB: 2, decidedBy: 'regular' }))).toMatchObject({ decidedBy: null, winner: null });
    expect(matchFinalScore(finished({ scoreA: 2, scoreB: 2 }))).toMatchObject({ decidedBy: null, winner: null });
  });

  it('@ET-002 Gruppenspiel 2:1 ohne gespeicherte Entscheidung → regulär entschieden, Heim gewinnt', () => {
    expect(matchFinalScore(finished({ scoreA: 2, scoreB: 1 }))).toMatchObject({ decidedBy: 'regular', winner: 'a' });
  });

  it('@ET-002 Ergebnis ohne Status (Eintrag im Spielplan) gilt als entschieden', () => {
    expect(matchFinalScore({ scoreA: 3, scoreB: 2 })).toMatchObject({ decidedBy: 'regular', winner: 'a' });
  });

  it('@ET-002 laufendes Spiel: Zwischenstand ohne Entscheidung und ohne Sieger', () => {
    const score = matchFinalScore({ matchStatus: 'running', scoreA: 2, scoreB: 1, overtimeScoreA: 1, overtimeScoreB: 0, decidedBy: 'overtime' });
    expect(score).toMatchObject({ a: 3, b: 1, decidedBy: null, winner: null });
  });

  it('@ET-002 Strafstoßschießen läuft (Cache paused): Zwischenstand mit Strafstoß getrennt, ohne Sieger', () => {
    const score = matchFinalScore({ matchStatus: 'paused', scoreA: 1, scoreB: 1, penaltyScoreA: 2, penaltyScoreB: 1 });
    expect(score).toMatchObject({ a: 1, b: 1, penalty: { a: 2, b: 1 }, decidedBy: null, winner: null });
  });

  it('Gegenbeispiel: kein Stand oder ausgefallenes Spiel → null', () => {
    expect(matchFinalScore({ matchStatus: 'scheduled' })).toBeNull();
    expect(matchFinalScore({ matchStatus: 'finished', scoreA: 1 })).toBeNull();
    expect(matchFinalScore({ matchStatus: 'skipped', scoreA: 0, scoreB: 0 })).toBeNull();
  });

  it('finalGoals: regulär + Verlängerung, ohne Strafstoß', () => {
    expect(finalGoals({ a: 1, b: 1 }, { overtimeScoreA: 2, overtimeScoreB: 0 })).toEqual({ a: 3, b: 1 });
    expect(finalGoals({ a: 1, b: 0 }, {})).toEqual({ a: 1, b: 0 });
  });
});
