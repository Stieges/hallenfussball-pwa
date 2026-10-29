/**
 * R2 PR 4 (M1) – @W2A-012 „Anzahl Schützen einstellbar“ (Record `2026-09-27_wizard-regelinhalte`):
 *   Gegeben die Turnierleitung stellt 5 Schützen ein / Wenn ein Spiel ins Schießen vom Punkt geht /
 *   Dann hat jedes Team zunächst 5 Schüsse / Und einstellbar sind 1 bis 5 Schützen, vorbelegt 3.
 * Engine-Weg: Anpfiff mit `serverRulesFor` (Produktionsfunktion, TS-Zwilling von `match_engine.server_rules`, Migration
 * `20261118_002`); die Regel steht danach im Engine-Stand. Die Grenzen prüfen zusätzlich die Regel-Fixtures 37 bis 39 gegen TS
 * und SQL (`scripts/match-engine-parity.sh`).
 */
import { describe, it, expect } from 'vitest';
import { startEngineSpiel } from '../../../test/engineSpielFixture';
import { DEFAULT_MATCH_COCKPIT_SETTINGS, type Tournament } from '../../../types/tournament';

const K_O = { phase: 'final' } as const;

function turnier(schuetzen?: number): Tournament {
  return {
    id: 't-schuetzen', title: 'Hallencup', teams: [], matches: [], groupPhaseGameDuration: 10, finalRoundGameDuration: 10,
    finalsConfig: { preset: 'final-only', tiebreaker: 'shootout' },
    ...(schuetzen === undefined ? {} : { matchCockpitSettings: { ...DEFAULT_MATCH_COCKPIT_SETTINGS, penaltyShootersPerTeam: schuetzen } }),
  } as unknown as Tournament;
}

describe('@W2A-012 Anzahl Schützen beim Anpfiff', () => {
  it('@W2A-012 5 eingestellt: das Spiel hat beim Schießen zunächst 5 Schützen je Team', async () => {
    expect((await startEngineSpiel(turnier(5), K_O)).rules.shootersPerTeam).toBe(5);
  });

  it('@W2A-012 nichts eingestellt: vorbelegt 3 (auch die Vorgabe der Einstellungen ist 3)', async () => {
    expect((await startEngineSpiel(turnier(), K_O)).rules.shootersPerTeam).toBe(3);
    expect(DEFAULT_MATCH_COCKPIT_SETTINGS.penaltyShootersPerTeam).toBe(3);
  });

  it.each([[1, 1], [0, 1], [9, 5]])('@W2A-012 einstellbar 1 bis 5: %i eingetragen → %i Schützen', async (eingetragen, gilt) => {
    expect((await startEngineSpiel(turnier(eingetragen), K_O)).rules.shootersPerTeam).toBe(gilt);
  });
});
