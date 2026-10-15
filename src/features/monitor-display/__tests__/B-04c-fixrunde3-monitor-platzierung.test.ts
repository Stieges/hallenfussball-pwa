/**
 * B-04c Fixrunde 3 – Fix 2 (@W2A-009, @W2A-039): Monitor-Pfad für Platzierungsspiele.
 *
 * Pflichttest:
 *   - finalsConfig { preset: 'top-4', tiebreakerByRound: { final: 'overtime-then-shootout',
 *     placement: 'shootout' } }, Platz-3-Spiel (finalType 'thirdPlace') → toLiveMatch
 *     liefert 'shootout' und ist gleich dem Ergebnis des Engine-Wegs (startEngineSpiel, A-08d1)
 *     für dasselbe Spiel.
 * Gegenbeispiele:
 *   - finalType 'final' → 'overtime-then-shootout'
 *   - ohne placement folgt Platz 3 dem Finale ('overtime-then-shootout')
 * Mutation:
 *   - match.finalType aus monitorMatch.ts entfernen → rot
 */
import { describe, it, expect } from 'vitest';
import { toLiveMatch } from '../monitorMatch';
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
  tiebreakerByRound: { final: 'overtime-then-shootout', placement: 'shootout' },
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

/** Cockpit-Seite auf dem Engine-Weg (A-08d1); die Engine kennt kein finalType, nur die Phase. */
async function cockpitRegel(tournament: Tournament) {
  const spiel = await startEngineSpiel(tournament, 'final');
  return spiel.tiebreakerMode;
}

describe('B-04c Fixrunde 3 – Monitor-Pfad für Platzierungsspiele (@W2A-009, @W2A-039)', () => {
  it('Pflichttest: Platz 3 zeigt im Monitor die Platzierungsregel und gleicht dem Cockpit', async () => {
    const monitor = toLiveMatch(planMatch('thirdPlace'), teams, turnier).tiebreakerMode;
    const cockpit = await cockpitRegel(turnier);

    expect(monitor).toBe('shootout');
    expect(monitor).toBe(cockpit);
  });

  it('Gegenbeispiel: das Finale behält seine eigene Regel', () => {
    expect(toLiveMatch(planMatch('final'), teams, turnier).tiebreakerMode).toBe(
      'overtime-then-shootout',
    );
  });

  it('Gegenbeispiel: ohne Platzierungsregel folgt Platz 3 dem Finale', () => {
    const ohnePlatzierung = {
      id: 't2',
      teams,
      finalsConfig: {
        preset: 'top-4',
        tiebreakerByRound: { final: 'overtime-then-shootout' },
      },
    } as unknown as Tournament;

    expect(toLiveMatch(planMatch('thirdPlace'), teams, ohnePlatzierung).tiebreakerMode).toBe(
      'overtime-then-shootout',
    );
  });
});
