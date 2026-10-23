/**
 * B-04c Fixrunde 3 – Fix 1 (F3-1, @W2A-009): Der Import prüft Regelwerte und Rundenschlüssel.
 *
 * Pflichttest:
 *   - Import mit tiebreaker "penalty" (ungültig) und tiebreakerByRound mit ungültigem
 *     Schlüssel (semifinal: "foo", bogus: "shootout") und gültigem placement/final
 *     → tiebreaker undefined, semifinal/bogus fehlen, placement/final bleiben.
 *     → resolveTiebreakMode liefert für semifinal den Rückfall 'shootout',
 *       für final im Platz-3-Spiel 'shootout' (placement).
 * Gegenbeispiel:
 *   - Lauter gültige Werte bleiben 1:1 erhalten.
 * Mutation:
 *   - isTiebreakerMode gibt immer true zurück → rot
 *   - Schlüsselprüfung entfernt → rot (bogus bleibt)
 */
import { describe, it, expect } from 'vitest';
import { validateAndParseTournamentImport } from '../tournamentImporter';
import { resolveTiebreakMode } from '../../core/match/tiebreakDecision';

function importiere(finalsConfig: Record<string, unknown>) {
  return validateAndParseTournamentImport(
    JSON.stringify({
      title: 'Import-Prüfung',
      teams: [{ id: 'a', name: 'Alpha' }],
      finalsConfig,
    }),
    'json',
  );
}

describe('B-04c Fixrunde 3 – F3-1 Import prüft Regelwerte und Rundenschlüssel', () => {
  it('Pflichttest: ungültige Regelwerte und Schlüssel werden verworfen, gültige bleiben', () => {
    const ergebnis = importiere({
      preset: 'top-4',
      tiebreaker: 'penalty',
      tiebreakerByRound: {
        semifinal: 'foo',
        bogus: 'shootout',
        placement: 'shootout',
        final: 'overtime-then-shootout',
      },
    });

    expect(ergebnis.isValid).toBe(true);
    const cfg = ergebnis.tournament?.finalsConfig;
    expect(cfg?.tiebreaker).toBeUndefined();
    expect(cfg?.tiebreakerByRound?.semifinal).toBeUndefined();
    expect(cfg?.tiebreakerByRound).not.toHaveProperty('bogus');
    expect(cfg?.tiebreakerByRound?.placement).toBe('shootout');
    expect(cfg?.tiebreakerByRound?.final).toBe('overtime-then-shootout');

    expect(cfg).toBeDefined();
    if (!cfg) {
      throw new Error('finalsConfig fehlt');
    }
    // ZA-3 (E1, @SL-145): verworfene Halbfinal-Regel -> Rückfall „Verlängerung, dann Strafstoßschießen“.
    expect(resolveTiebreakMode(cfg, 'semifinal')).toBe('overtime-then-shootout');
    expect(resolveTiebreakMode(cfg, 'final', 'thirdPlace')).toBe('shootout');
  });

  it('Gegenbeispiel: lauter gültige Werte bleiben 1:1 erhalten', () => {
    const ergebnis = importiere({
      preset: 'top-4',
      tiebreaker: 'goldenGoal',
      tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'goldenGoal' },
    });

    expect(ergebnis.isValid).toBe(true);
    const cfg = ergebnis.tournament?.finalsConfig;
    expect(cfg?.tiebreaker).toBe('goldenGoal');
    expect(cfg?.tiebreakerByRound).toEqual({
      final: 'overtime-then-shootout',
      placement: 'goldenGoal',
    });
  });
});
