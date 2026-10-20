/**
 * Paket TB, Task TB-3: die eingetragene Entscheidung wirkt in der Tabelle und verfällt, wenn sich ihre Grundlage ändert.
 * Records `2026-09-27_wizard-regelinhalte` (@W2A-004, @W2A-005, @W2A-044, @W2A-052, @W2A-053) und
 * `2026-10-01_endstand-und-torschuetzen` (@ET-055, @ET-027). Daten: Plan v2 Abschnitt 6 (gegengerechnet).
 * Eingetragen wird über `StandingDecisionService` mit einer Repository-Attrappe (wie Olli in der App).
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings } from '../../../utils/calculations';
import { rankTournamentGroup } from '../tournamentTable';
import type { Standing, Tournament } from '../../../types/tournament';
import { DATA, id, names, NAME, POINTS_210, type Key } from './fixtures';
import { jgj, MemoryRepo, OLLI, order, shootout } from './decisionTestKit';

const table = (t: Tournament): Standing[] => calculateStandings(t.teams, t.matches, t);
const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) { throw new Error(`Team ${key} fehlt`); }
  return found;
};

/** @ET-055-Daten mit eingetragenem Strafstoßschießen 4:3 für DJK Kammer. */
async function et055MitEntscheidung(): Promise<MemoryRepo> {
  const repo = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
  const result = await repo.service(['e-kammer']).decide(repo.tournament.id, shootout('K', 'R', 4, 3), OLLI);
  expect(result.ok).toBe(true);
  return repo;
}

describe('TB-3 Entscheidung in der Tabelle', () => {
  it('@ET-055 nach dem Strafstoßschießen 4:3 steht Kammer vor Waging rot (Platz 3 und 4), die Spielstände bleiben', async () => {
    const vorher = jgj('RKMUNO', DATA.ET_055);
    const repo = await et055MitEntscheidung();
    const rows = table(repo.tournament);

    expect(names(rows).slice(2, 4)).toEqual([NAME.K, NAME.R]);
    expect([row(rows, 'K').place, row(rows, 'R').place]).toEqual([3, 4]);
    expect([row(rows, 'K').decisionNeeded, row(rows, 'R').decisionNeeded]).toEqual([false, false]);
    expect(row(rows, 'K').decision?.shootout).toEqual({ winner: 4, loser: 3 });
    // Gegenbeispiel: alle 15 Spielstände unverändert, die App hat kein Ergebnis angefasst.
    expect(repo.tournament.matches.map((m) => [m.id, m.scoreA, m.scoreB, m.matchStatus]))
      .toEqual(vorher.matches.map((m) => [m.id, m.scoreA, m.scoreB, m.matchStatus]));
  });

  it('@W2A-004 die App zieht nicht selbst: ohne Eintrag markiert, nach dem Eintrag übernommen mit Zeit und Person', async () => {
    const ohne = table(jgj('RKMUNO', DATA.ET_055));
    expect([row(ohne, 'R').decisionNeeded, row(ohne, 'K').decisionNeeded]).toEqual([true, true]);
    expect(row(ohne, 'R').place).toBe(row(ohne, 'K').place);

    const repo = await et055MitEntscheidung();
    const decision = row(table(repo.tournament), 'K').decision;
    expect(decision?.kind).toBe('shootout');
    expect(decision?.decidedBy).toEqual({ userId: OLLI.userId, name: 'Olli' });
    expect(decision?.decidedAt).toBe('2026-12-06T14:32:00.000Z');
  });

  it('@W2A-044 drei Teams: Reihenfolge Ufer, West, Ost mit Grund „Strafstoßschießen“ – so geordnet, kein geteilter Platz', async () => {
    const repo = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044));
    const service = repo.service();

    // Gegenbeispiele: leerer Grund und fremdes Team werden abgelehnt, nichts geschrieben.
    expect(await service.decide(repo.tournament.id, order(['U', 'W', 'O'], '  '), OLLI)).toEqual({ ok: false, code: 'REASON_REQUIRED' });
    const fremd = { ...order(['U', 'W', 'O'], 'Strafstoßschießen'), order: [id('U'), id('W'), id('B')] };
    expect(await service.decide(repo.tournament.id, fremd, OLLI)).toEqual({ ok: false, code: 'ORDER_MISMATCH' });
    expect(repo.writes).toBe(0);

    expect((await service.decide(repo.tournament.id, order(['U', 'W', 'O'], 'Strafstoßschießen'), OLLI)).ok).toBe(true);
    const rows = table(repo.tournament);
    expect(names(rows)).toEqual([NAME.M, NAME.U, NAME.W, NAME.O, NAME.B, NAME.N]);
    expect(rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows.some((r) => r.decisionNeeded === true)).toBe(false);
  });

  it.each([
    { aenderung: 'Olli korrigiert TSV Waging rot – DJK Kammer von 1:1 auf 2:2', aendern: (r: MemoryRepo) => { r.correct('R', 'K', 2, 2); } },
    { aenderung: 'Olli ändert das Punkteschema von 3/1/0 auf 2/1/0', aendern: (r: MemoryRepo) => { r.tournament = { ...r.tournament, pointSystem: POINTS_210 }; } },
  ])('@W2A-005 die Entscheidung verfällt, wenn sich ihre Grundlage ändert: $aenderung', async ({ aendern }) => {
    const repo = await et055MitEntscheidung();
    expect(row(table(repo.tournament), 'K').decision).toBeDefined();

    aendern(repo);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual(['e-kammer']);
    const rows = result.rows;
    expect([row(rows, 'R').decisionNeeded, row(rows, 'K').decisionNeeded]).toEqual([true, true]);
    expect(row(rows, 'R').points).toBe(row(rows, 'K').points);
    expect(row(rows, 'K').decision).toBeUndefined();
  });

  it('@W2A-052 kommt durch eine Korrektur ein weiteres Team in den Gleichstand, verfällt die Entscheidung (Waging rot, FC Nord, Kammer)', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.W2A_052));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('K', 'R', 4, 3), OLLI)).ok).toBe(true);
    expect(names(table(repo.tournament)).slice(1, 3)).toEqual([NAME.K, NAME.R]);

    repo.correct('N', 'O', 1, 1);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual(['e-1']);
    expect(names(result.rows).slice(1, 4)).toEqual([NAME.R, NAME.N, NAME.K]);
    expect(result.rows.slice(1, 4).map((r) => r.points)).toEqual([7, 7, 7]);
    expect(result.rows.some((r) => r.decision !== undefined)).toBe(false);
  });

  it('@W2A-053 eine Korrektur, die den Gleichstand nicht berührt, lässt die Entscheidung stehen (Kammer vor Waging rot, ohne Markierung)', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.W2A_052));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('K', 'R', 4, 3), OLLI)).ok).toBe(true);

    repo.correct('M', 'O', 3, 0);
    const result = rankTournamentGroup(repo.tournament, '');
    expect(result.staleDecisionIds).toEqual([]);
    expect(names(result.rows).slice(1, 3)).toEqual([NAME.K, NAME.R]);
    expect(result.rows.some((r) => r.decisionNeeded)).toBe(false);
    // Gegenbeispiel: ohne Entscheidung wären beide nach derselben Korrektur markiert.
    const ohne = rankTournamentGroup({ ...repo.tournament, standingDecisions: [] }, '');
    expect([row(ohne.rows, 'R').decisionNeeded, row(ohne.rows, 'K').decisionNeeded]).toEqual([true, true]);
  });

  it('@ET-027 nach dem Strafstoßschießen 3:2 für SG Mitte steht sie allein auf Platz 1, FC Nord auf 2; Person, Zeit, Ergebnis festgehalten', async () => {
    const daten = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';
    const repo = new MemoryRepo(jgj('MNWOUB', daten));
    const ohne = table(repo.tournament);
    expect([row(ohne, 'M').place, row(ohne, 'N').place]).toEqual([1, 1]);

    expect((await repo.service().decide(repo.tournament.id, shootout('M', 'N', 3, 2), OLLI)).ok).toBe(true);
    const rows = table(repo.tournament);
    expect([row(rows, 'M').place, row(rows, 'N').place]).toEqual([1, 2]);
    const decision = repo.tournament.standingDecisions?.[0];
    expect(decision).toMatchObject({ decidedBy: { name: 'Olli' }, decidedAt: '2026-12-06T14:32:00.000Z', shootout: { winner: 3, loser: 2 } });
  });
});
