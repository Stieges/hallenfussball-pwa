/**
 * B-04c Fixrunde 3 – Fix 2 (@W2A-009, @W2A-039): Monitor-Pfad für Platzierungsspiele.
 *
 * Pflichttest (Monitor, grün):
 *   - finalsConfig { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout',
 *     placement: 'goldenGoal' } }, Platz-3-Spiel (finalType 'thirdPlace') → toLiveMatch liefert 'goldenGoal'.
 *     Der Wert ist bewusst NICHT der Engine-Rückfall ('shootout'), damit der Test nicht zufällig grün ist (F2).
 * Pflichttest (Cockpit, it.fails, Engine-Weg, A-08d1 F2): Cockpit-Regel = Monitor-Regel für Platz 3.
 *   Die Engine kennt nur finalsConfig.tiebreaker und die Phase; sie liefert 'shootout' statt 'goldenGoal'.
 * Gegenbeispiele (grün, Monitor):
 *   - finalType 'final' → 'overtime-then-shootout'
 *   - ohne placement folgt Platz 3 dem Finale ('overtime-then-shootout')
 * Mutation:
 *   - match.finalType aus monitorMatch.ts entfernen → rot (Monitor-Pflichttest)
 *   - Rückfall in serverRules (shootout → goldenGoal) → Cockpit-Test wird rot (it.fails bestanden = rot, F2)
 */
import { describe, it, expect } from 'vitest';
import { liveMatchOf } from './monitorViewHelper';
import { startEngineSpiel } from '../../../test/engineSpielFixture';
import type { FinalsConfig, Match, Team, Tournament } from '../../../types/tournament';
import { looseVs } from '../../../test/matchSlotFixtures';

type FinalType = NonNullable<Match['finalType']>;

const teams: Team[] = [
  { id: 'teamA', name: 'Alpha' },
  { id: 'teamB', name: 'Beta' },
];

const finalsConfig: FinalsConfig = {
  preset: 'top-4',
  tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'goldenGoal' },
};

const turnier = { id: 't1', teams, finalsConfig } as unknown as Tournament;

function planMatch(finalType: FinalType | undefined): Match {
  return {
    id: `m-final-${finalType ?? 'x'}`,
    matchNumber: 1,
    round: 1,
    label: 'final',
    phase: 'final',
    finalType,
    field: 1,
    ...looseVs('teamA', 'teamB'),
  };
}

function monitorRegel(finalType: FinalType | undefined) {
  return liveMatchOf(planMatch(finalType), turnier).tiebreakerMode;
}

/** Cockpit-Seite auf dem Engine-Weg (A-08d1); die Engine kennt kein finalType, nur die Phase. */
async function cockpitRegel(tournament: Tournament, finalType: FinalType) {
  const spiel = await startEngineSpiel(tournament, { phase: 'final', finalType });
  return spiel.tiebreakerMode;
}

describe('B-04c Fixrunde 3 – Monitor-Pfad für Platzierungsspiele (@W2A-009, @W2A-039)', () => {
  it('(Monitor) @W2A-039: Platz 3 zeigt im Monitor die Platzierungsregel', () => {
    expect(monitorRegel('thirdPlace')).toBe('goldenGoal');
  });

  // erwartet rot bis B-10b1/A-27 – Befund C-KO-RUNDENREGEL-SERVER bzw. ZA-1 (task-GB5-plan.md); Markierung entfernen, sobald grün
  // Engine-Weg: Platz 3 bekommt den Rückfall 'shootout' statt der Platzierungsregel 'goldenGoal' (kein finalType, keine Runden-Regel).
  // Nach A-27 grün; der Monitor-Test oben und das Finale-Gegenbeispiel bleiben dann als Gegenbeweis nötig.
  it.fails('Pflichttest (Cockpit) @W2A-039: Platz 3 zeigt im Cockpit dieselbe Regel wie im Monitor', async () => {
    expect(await cockpitRegel(turnier, 'thirdPlace')).toBe(monitorRegel('thirdPlace'));
  });

  it('Gegenbeispiel (Monitor) @W2A-039: das Finale behält seine eigene Regel', () => {
    expect(monitorRegel('final')).toBe('overtime-then-shootout');
  });

  it('Gegenbeispiel (Monitor) @W2A-039: ohne Platzierungsregel folgt Platz 3 dem Finale', () => {
    const ohnePlatzierung = {
      id: 't2',
      teams,
      finalsConfig: {
        preset: 'top-4',
        tiebreakerByRound: { final: 'overtime-then-shootout' },
      },
    } as unknown as Tournament;

    expect(liveMatchOf(planMatch('thirdPlace'), ohnePlatzierung).tiebreakerMode).toBe(
      'overtime-then-shootout',
    );
  });
});
