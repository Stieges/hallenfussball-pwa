/**
 * B-04c Fixrunde 1 – Fix 1 (@W2A-009): Vertrag K.o.-Entscheidung bindet an den Client.
 *
 * Die Vertrags-Fixture `server-rules-ko-entscheidung.json` erwartet den CLIENT-Wert
 * (`resolveTiebreakMode`), nicht die heutige Server-Ableitung. Bekannte
 * Server-Abweichungen stehen als Block `bekannteAbweichung` in der Fixture (Befund
 * C-KO-RUNDENREGEL-SERVER) und meldet `scripts/append-match-events-check.sh` als
 * BEKANNT mit ::warning:: (kein Fehler). Dieser Test ohne Docker hält `expected.tiebreak`
 * an die Client-Ermittlung fest, damit die Fixture nicht wieder auf den Server-Wert
 * „passend gemacht" werden kann.
 *
 * Pflichttest: je Fall `expected.tiebreak === resolveTiebreakMode(finals,
 * knockoutRoundOf(phase)) ?? 'shootout'`; jeder markierte Fall trägt `befund` und
 * `serverHeute` mit abweichendem `tiebreak`.
 * Gegenbeispiel: Fall ohne Runden-Regel trägt KEINE Markierung (läuft im Skript als
 * normaler Vertrag auf `OK`, nicht als `BEKANNT`).
 * Mutation: `expected.tiebreak` auf "goldenGoal" zurücksetzen → rot.
 */
import { describe, it, expect } from 'vitest';
import vertrag from '../__contracts__/server-rules-ko-entscheidung.json';
import { resolveTiebreakMode, knockoutRoundOf } from '../tiebreakDecision';
import type { FinalsConfig, TiebreakerMode } from '../../../types/tournament';

interface Vertragsfall {
  name: string;
  input: {
    phase: string;
    finals: FinalsConfig | null;
  };
  expected: {
    tiebreak: TiebreakerMode;
  };
  bekannteAbweichung?: {
    befund: string;
    uebergabe?: string;
    serverHeute: {
      tiebreak: TiebreakerMode;
    };
  };
}

const faelle = vertrag.cases as unknown as Vertragsfall[];

describe('B-04c Fixrunde 1 – Vertrag K.o.-Entscheidung erwartet den Client-Wert', () => {
  it('Pflichttest: expected.tiebreak je Fall == resolveTiebreakMode(finals, Runde aus phase)', () => {
    expect(faelle.length).toBeGreaterThanOrEqual(3);
    for (const fall of faelle) {
      const rundentyp = knockoutRoundOf(fall.input.phase);
      expect(rundentyp, `Fall ${fall.name}: phase ist eine K.-o.-Runde`).not.toBeNull();
      const clientWert = resolveTiebreakMode(fall.input.finals, rundentyp) ?? 'shootout';
      expect(clientWert, `Fall ${fall.name}`).toBe(fall.expected.tiebreak);
    }
  });

  it('Pflichttest: jeder markierte Fall trägt befund und serverHeute mit abweichendem tiebreak', () => {
    const markierte = faelle.filter((fall) => fall.bekannteAbweichung !== undefined);
    expect(markierte.length).toBeGreaterThanOrEqual(1);
    for (const fall of markierte) {
      const abweichung = fall.bekannteAbweichung;
      expect(abweichung?.befund, `Fall ${fall.name}`).toBe('C-KO-RUNDENREGEL-SERVER');
      expect(abweichung?.serverHeute.tiebreak, `Fall ${fall.name}`).toBeDefined();
      expect(abweichung?.serverHeute.tiebreak, `Fall ${fall.name}`).not.toBe(fall.expected.tiebreak);
    }
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
