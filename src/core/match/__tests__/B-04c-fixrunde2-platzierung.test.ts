/**
 * B-04c Fixrunde 2 – @W2A-039: Platzierungsspiele haben eine eigene Entscheidungsregel,
 * vorbelegt wie die K.-o.-Spiele.
 *
 * Pflichttest:
 *   - Platzierungsspiel (match.finalType thirdPlace/fifthSixth/seventhEighth) mit
 *     tiebreakerByRound.placement = 'shootout' und Finale = 'overtime-then-shootout'
 *     → 'shootout' (direkt Strafstoßschießen)
 *   - Ohne Platzierungs-Regel → Rückfall auf die Regel des Finales
 * Gegenbeispiel:
 *   - Finale (finalType 'final') bleibt bei seiner Regel, wenn die Platzierungs-Regel abweicht
 *   - Halbfinale unverändert (der Schlüssel `placement` berührt die Runden-Regeln nicht)
 *   - Gruppenspiel ohne finalType bleibt ohne Entscheidung
 * Mutation:
 *   - Platzierungs-Erkennung (isPlacementFinal) in resolveTiebreakMode entfernen → rot
 *   - Rückfall auf die Finale-Regel entfernen → rot
 */
import { describe, it, expect } from 'vitest';
import { resolveTiebreakMode, isPlacementFinal, knockoutRoundOf } from '../tiebreakDecision';
import type { FinalsConfig } from '../../../types/tournament';

const config: FinalsConfig = {
  preset: 'top-4',
  tiebreaker: 'goldenGoal',
  tiebreakerDuration: 5,
  tiebreakerByRound: {
    semifinal: 'shootout',
    final: 'overtime-then-shootout',
    placement: 'shootout',
  },
};

describe('B-04c Fixrunde 2 – @W2A-039 Platzierungsspiele eigene Entscheidungsregel', () => {
  it('Pflichttest: Platzierungsspiel nutzt die Platzierungs-Regel, nicht die Finale-Regel', () => {
    expect(resolveTiebreakMode(config, 'final', 'thirdPlace')).toBe('shootout');
    expect(resolveTiebreakMode(config, 'final', 'fifthSixth')).toBe('shootout');
    expect(resolveTiebreakMode(config, 'final', 'seventhEighth')).toBe('shootout');
  });

  it('Pflichttest: ohne Platzierungs-Regel Rückfall auf die Regel des Finales', () => {
    const ohnePlatzierungsRegel: FinalsConfig = {
      preset: 'top-4',
      tiebreaker: 'goldenGoal',
      tiebreakerByRound: { final: 'overtime-then-shootout' },
    };
    expect(resolveTiebreakMode(ohnePlatzierungsRegel, 'final', 'thirdPlace')).toBe(
      'overtime-then-shootout',
    );
  });

  it('Gegenbeispiel: Finale bleibt bei seiner Regel, Halbfinale unverändert', () => {
    expect(resolveTiebreakMode(config, 'final', 'final')).toBe('overtime-then-shootout');
    expect(resolveTiebreakMode(config, 'semifinal')).toBe('shootout');
    expect(resolveTiebreakMode(config, 'semifinal', 'final')).toBe('shootout');
  });

  it('Gegenbeispiel: Klassifizierung hängt am Feld finalType, nicht an der Phase', () => {
    expect(isPlacementFinal('thirdPlace')).toBe(true);
    expect(isPlacementFinal('fifthSixth')).toBe(true);
    expect(isPlacementFinal('seventhEighth')).toBe(true);
    expect(isPlacementFinal('final')).toBe(false);
    expect(isPlacementFinal(undefined)).toBe(false);
    // Platzierungsspiel ohne (brauchbare) Phasen-Angabe erkennt die Regel trotzdem:
    expect(resolveTiebreakMode(config, knockoutRoundOf(null), 'thirdPlace')).toBe('shootout');
  });

  it('Gegenbeispiel: Gruppenspiel ohne finalType bleibt ohne Entscheidung', () => {
    expect(resolveTiebreakMode(config, null)).toBeUndefined();
    expect(resolveTiebreakMode(config, null, undefined)).toBeUndefined();
  });

  it('Gegenbeispiel: Platzierungsspiel ohne jede Regel folgt der Kette bis shootout', () => {
    expect(resolveTiebreakMode({ preset: 'top-4' }, 'final', 'thirdPlace')).toBe('shootout');
    expect(
      resolveTiebreakMode({ preset: 'top-4', tiebreaker: 'goldenGoal' }, 'final', 'thirdPlace'),
    ).toBe('goldenGoal');
  });
});
