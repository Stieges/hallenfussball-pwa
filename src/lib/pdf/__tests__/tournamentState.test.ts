/**
 * B-28a3-4F F1 (Review M1): `withTournamentState` mischt den Turnierstand in einen Plan, der keinen Zustand trägt.
 * Der Plan kommt aus einem Turnier OHNE gespielte Spiele (veralteter Plan, wie im Dialog möglich), der Zustand aus
 * einem zweiten Turnier. Gelesen über `allMatches` und `phases[].matches`.
 * Szenarien: @BM-011, @BM-013 (Zustand des Spiels), @DR-019 (Ausfall ohne Felder).
 */
import { describe, expect, it } from 'vitest';
import type { Match } from '../../../types/tournament';
import { withTournamentState } from '../tournamentState';
import { hallencupSchedule, hallencupTournament, matchByNumber } from './pdfFixture';

/**
 * Quelle der Spiel-IDs: der Generator vergibt bei jedem Lauf neue IDs, deshalb kommen alle Spiele dieses Tests aus
 * derselben Erzeugung. Turnier und Plan teilen sich so die IDs, wie es nach dem Speichern im Turnier auch wäre.
 */
const ID_QUELLE = hallencupSchedule();

/** Turnierspiel zur Plan-Spielnummer, mit der Plan-ID, damit die Zuordnung über die ID läuft. */
function turnierspiel(matchNumber: number, overrides: Partial<Match>): Match {
  const base = matchByNumber(ID_QUELLE, matchNumber);
  return {
    id: base.id,
    round: 0,
    field: base.field,
    slotA: base.slotA,
    slotB: base.slotB,
    originA: base.originA,
    originB: base.originB,
    group: base.group,
    phase: base.phase,
    matchNumber,
    ...overrides,
  };
}

const KORREKTUR = [{
  timestamp: '2026-11-14T14:52:00',
  previousScoreA: 1,
  previousScoreB: 0,
  newScoreA: 2,
  newScoreB: 1,
}];

describe('F1 withTournamentState mischt den Stand nur ein, wo das Turnier ihn hat', () => {
  // Plan aus einem Turnier mit Spiel 1 und 12 ohne Stand: der Plan trägt also keinen Zustand (Review M1). Der Generator
  // nimmt bei gespeicherten Spielen nur diese auf, deshalb stehen beide im Turnier.
  const veralteterPlan = hallencupSchedule(hallencupTournament({ matches: [turnierspiel(1, {}), turnierspiel(12, {})] }));
  const stand = hallencupTournament({
    matches: [turnierspiel(12, { matchStatus: 'finished', scoreA: 2, scoreB: 1, correctionHistory: KORREKTUR })],
  });

  it('Ausgangslage: der Plan trägt keinen Zustand, Spiel 12 hat weder Status noch Ergebnis', () => {
    const spiel = matchByNumber(veralteterPlan, 12) as unknown as Record<string, unknown>;
    expect(spiel.matchStatus).toBeUndefined();
    expect(spiel.scoreA).toBeUndefined();
  });

  it('Spiel 12 bekommt Status, Ergebnis und Korrekturhistorie aus dem Turnier (allMatches)', () => {
    const plan = withTournamentState(veralteterPlan, stand);
    const spiel = plan.allMatches.find(m => m.matchNumber === 12);

    expect(spiel).toMatchObject({ matchStatus: 'finished', scoreA: 2, scoreB: 1, correctionHistory: KORREKTUR });
  });

  it('dasselbe Spiel steht auch in phases[].matches mit Zustand (die Finalseite liest dort)', () => {
    const plan = withTournamentState(veralteterPlan, stand);
    const id = matchByNumber(veralteterPlan, 12).id;
    const inPhase = plan.phases.flatMap(phase => phase.matches).find(m => m.id === id);

    expect(inPhase).toMatchObject({ matchStatus: 'finished', scoreA: 2, scoreB: 1 });
  });

  it('Gegenbeispiel: ein Plan-Spiel ohne Turnier-Spiel bleibt unverändert (kein Zustand dazu)', () => {
    const plan = withTournamentState(veralteterPlan, stand);
    const ohneStand = plan.allMatches.find(m => m.matchNumber === 1) as unknown as Record<string, unknown>;

    expect(ohneStand).toEqual(veralteterPlan.allMatches.find(m => m.matchNumber === 1));
    expect(ohneStand.matchStatus).toBeUndefined();
    expect(ohneStand.scoreA).toBeUndefined();
  });
});

describe('N6 withTournamentState mischt Verlängerung und Entscheidungsart ein', () => {
  it('Spiel 12 trägt overtimeScoreA/B, penaltyScoreA/B und decidedBy aus dem Turnier', () => {
    const plan = hallencupSchedule(hallencupTournament({ matches: [turnierspiel(12, {})] }));
    const stand = hallencupTournament({
      matches: [turnierspiel(12, {
        matchStatus: 'finished', scoreA: 2, scoreB: 2, overtimeScoreA: 3, overtimeScoreB: 3, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty',
      })],
    });
    const spiel = withTournamentState(plan, stand).allMatches.find(m => m.matchNumber === 12);

    expect(spiel).toMatchObject({ overtimeScoreA: 3, overtimeScoreB: 3, penaltyScoreA: 4, penaltyScoreB: 3, decidedBy: 'penalty' });
  });
});
