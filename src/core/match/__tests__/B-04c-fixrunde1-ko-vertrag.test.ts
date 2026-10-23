/**
 * B-04c Fixrunde 1 – Fix 1 (@W2A-009): Vertrag K.o.-Entscheidung bindet an den Client.
 *
 * Die Vertrags-Fixture `server-rules-ko-entscheidung.json` erwartet den CLIENT-Wert
 * (`resolveTiebreakMode`). ZA-3 (D1, Befund C-KO-RUNDENREGEL-SERVER behoben): der Server liest
 * die Entscheidungsart je Runde (`match_engine.server_rules` mit `final_type`), der Vertrag läuft
 * OHNE `bekannteAbweichung` – Client, TS-Zwilling `serverRules` und SQL
 * (`scripts/append-match-events-check.sh`) liefern denselben Wert.
 *
 * Pflichttest: je Fall `expected.tiebreak === resolveTiebreakMode(finals, knockoutRoundOf(phase),
 * finalType) === serverRules(input).tiebreak`. Der Fall „Spiel um Platz 3 mit
 * Platzierungs-Regel" (@W2A-039) klassifiziert über `finalType`, nicht über die Phase. Rückfall ohne
 * Regel: „Verlängerung, dann Strafstoßschießen“ (@SL-145).
 * Mutation: `expected.tiebreak` auf "goldenGoal" zurücksetzen → rot.
 */
import { describe, it, expect } from 'vitest';
import vertrag from '../__contracts__/server-rules-ko-entscheidung.json';
import { resolveTiebreakMode, knockoutRoundOf } from '../tiebreakDecision';
import { serverRules } from '../client/serverRules';
import type { FinalsConfig, TiebreakerMode } from '../../../types/tournament';

interface Vertragsfall {
  name: string;
  input: {
    durationMinutes: number | null;
    phase: string;
    finalType?: 'final' | 'thirdPlace' | 'fifthSixth' | 'seventhEighth';
    groupDuration: number;
    finalDuration: number;
    config: unknown;
    finals: FinalsConfig | null;
  };
  expected: {
    tiebreak: TiebreakerMode;
  };
  bekannteAbweichung?: unknown;
}

const faelle = vertrag.cases as unknown as Vertragsfall[];

describe('B-04c Fixrunde 1 – Vertrag K.o.-Entscheidung erwartet den Client-Wert', () => {
  it('Pflichttest: expected.tiebreak je Fall == resolveTiebreakMode == serverRules (Server-Zwilling)', () => {
    expect(faelle.length).toBeGreaterThanOrEqual(3);
    for (const fall of faelle) {
      const rundentyp = knockoutRoundOf(fall.input.phase);
      expect(rundentyp, `Fall ${fall.name}: phase ist eine K.-o.-Runde`).not.toBeNull();
      expect(resolveTiebreakMode(fall.input.finals, rundentyp, fall.input.finalType), `Fall ${fall.name}`).toBe(fall.expected.tiebreak);
      const server = serverRules({
        durationMinutes: fall.input.durationMinutes,
        phase: fall.input.phase,
        finalType: fall.input.finalType ?? null,
        groupPhaseDuration: fall.input.groupDuration,
        finalRoundDuration: fall.input.finalDuration,
        config: fall.input.config,
        finalsConfig: fall.input.finals,
      });
      expect(server, `Fall ${fall.name}`).toEqual(fall.expected);
    }
  });

  it('@SL-145 Vertrag ohne Ausnahme: kein Fall trägt eine bekannteAbweichung (Befund C-KO-RUNDENREGEL-SERVER behoben)', () => {
    expect(faelle.filter((fall) => fall.bekannteAbweichung !== undefined)).toEqual([]);
    const ohneRegel = faelle.find((fall) => fall.input.finals?.tiebreaker === undefined && fall.input.finals?.tiebreakerByRound === undefined);
    expect(ohneRegel?.expected.tiebreak).toBe('overtime-then-shootout');
  });

  it('Gegenbeispiel: Fall ohne Runden-Regel trägt keine bekannteAbweichung (Skript: OK, nicht BEKANNT)', () => {
    const ohneRundenregel = faelle.filter(
      (fall) => fall.input.finals?.tiebreakerByRound === undefined,
    );
    expect(ohneRundenregel.length).toBeGreaterThanOrEqual(1);
    for (const fall of ohneRundenregel) {
      expect(fall.bekannteAbweichung, `Fall ${fall.name}`).toBeUndefined();
    }
    const ruckfallGlobaleRegel = ohneRundenregel.find(
      (fall) => fall.input.finals?.tiebreaker !== undefined,
    );
    expect(ruckfallGlobaleRegel?.expected.tiebreak).toBe(
      ruckfallGlobaleRegel?.input.finals?.tiebreaker,
    );
  });
});
