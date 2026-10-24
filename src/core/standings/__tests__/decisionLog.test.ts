/**
 * GA4 A-13b-C: wer hat wann entschieden und zurückgenommen – aus dem Verlauf der Turnierleitung (`Tournament.decisionLog`).
 * Aus den Anforderungen: @W2A-004 („hält es mit Zeit und Person fest“), @W2A-060 („von wem schon entschieden wurde“),
 * @W2A-063 („wer das Ergebnis wann akzeptiert hat“), @W2A-070 („wer wann entschieden und wer wann zurückgenommen hat“),
 * @W2A-071 (Helfer sehen es nicht), @W2A-072 (nicht im öffentlichen Datensatz), @ET-027, @ET-029.
 */
import { describe, expect, it } from 'vitest';
import { decidedBy, withdrawnBy, withdrawnForBlock } from '../decisionLog';
import { jgj, MemoryRepo, nikolaus, order, shared, shootout } from './decisionTestKit';
import { DATA } from './fixtures';

describe('Verlauf der Entscheidungen (decisionLog)', () => {
  it('@W2A-004 @ET-027 das Strafstoßschießen steht mit Person und Zeit im Verlauf, das Ergebnis in der Entscheidung', async () => {
    const repo = new MemoryRepo(nikolaus());
    const result = await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3));
    expect(result.ok).toBe(true);
    expect(decidedBy(repo.tournament, 'e-1')).toEqual({ name: 'Olli', at: expect.any(String) });
    expect(repo.tournament.decisionLog?.[0]).toMatchObject({ kind: 'standing_decision', actorName: 'Olli', detail: { id: 'e-1', kind: 'shootout', shootout: { winner: 4, loser: 3 } } });
  });

  it('@W2A-063 @ET-029 die Annahme steht mit Person und Zeit im Verlauf – ohne Grund', async () => {
    const repo = new MemoryRepo(nikolaus());
    await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']));
    expect(decidedBy(repo.tournament, 'e-1')?.name).toBe('Olli');
    expect(repo.tournament.decisionLog?.[0]).not.toHaveProperty('reason');
  });

  it('@W2A-004 der Grund einer Reihenfolge steht NUR im Verlauf, nie in der öffentlichen Entscheidung (@W2A-072)', async () => {
    const repo = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044, [1]));
    expect((await repo.service(['e-reihe']).decide(repo.tournament.id, order(['U', 'W', 'O'], 'Strafstoßschießen'))).ok).toBe(true);
    expect(repo.tournament.decisionLog?.[0]).toMatchObject({ reason: 'Strafstoßschießen' });
    expect(JSON.stringify(repo.tournament.standingDecisions)).not.toMatch(/Strafstoßschießen"|reason|decidedBy|decidedAt|Olli/);
  });

  it('@W2A-070 das Zurücknehmen steht mit Person und Zeit im Verlauf; die Entscheidung davor bleibt dort stehen', async () => {
    const repo = new MemoryRepo(nikolaus());
    await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3));
    repo.author = 'Maria';
    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: true });
    expect(withdrawnBy(repo.tournament, 'e-1')).toEqual({ name: 'Maria', at: expect.any(String) });
    expect(decidedBy(repo.tournament, 'e-1')?.name).toBe('Olli');
    expect(repo.tournament.standingDecisions).toEqual([]);
  });

  it('@W2A-060 ALREADY_DECIDED nennt die Person (Olli), die zuerst entschieden hat; ohne Verlauf bleibt der Name weg', async () => {
    const repo = new MemoryRepo(nikolaus());
    await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3));
    expect(await repo.service().decide(repo.tournament.id, shootout('P', 'D', 5, 4))).toEqual({ ok: false, code: 'ALREADY_DECIDED', by: 'Olli' });
    repo.tournament = { ...repo.tournament, decisionLog: undefined };
    expect(await repo.service().decide(repo.tournament.id, shootout('P', 'D', 5, 4))).toEqual({ ok: false, code: 'ALREADY_DECIDED' });
  });

  it('Gegenbeispiel: eine fremde Kennung findet nichts; ein Eintrag ohne Namen liefert nur die Zeit', () => {
    const log = [{ id: 1, kind: 'standing_decision' as const, detail: { id: 'e-9' }, at: '2026-12-06T12:00:00Z' }];
    expect(decidedBy({ decisionLog: log }, 'e-1')).toBeUndefined();
    expect(decidedBy({ decisionLog: log }, 'e-9')).toEqual({ at: '2026-12-06T12:00:00Z' });
    expect(decidedBy({}, 'e-9')).toBeUndefined();
  });
});

describe('withdrawnForBlock: nur die letzte Eintragung zu den Teams zählt (@W2A-070)', () => {
  const teamIds = ['a', 'b'];
  const eintrag = (id: number, kind: 'standing_decision' | 'standing_withdraw', actorName: string) =>
    ({ id, kind, detail: { id: 'e-1', teamIds: ['b', 'a'] }, actorName, at: `2026-12-06T1${String(id)}:00:00Z` });

  it('[decide, withdraw] nennt Maria', () => {
    expect(withdrawnForBlock({ decisionLog: [eintrag(1, 'standing_decision', 'Olli'), eintrag(2, 'standing_withdraw', 'Maria')] }, teamIds))
      .toEqual({ name: 'Maria', at: '2026-12-06T12:00:00Z' });
  });

  it('Gegenbeispiel [decide, withdraw, decide]: überholt, undefined', () => {
    const log = [eintrag(1, 'standing_decision', 'Olli'), eintrag(2, 'standing_withdraw', 'Maria'), eintrag(3, 'standing_decision', 'Olli')];
    expect(withdrawnForBlock({ decisionLog: log }, teamIds)).toBeUndefined();
  });

  it('andere Teams oder kein Verlauf: undefined', () => {
    expect(withdrawnForBlock({ decisionLog: [eintrag(2, 'standing_withdraw', 'Maria')] }, ['x', 'y'])).toBeUndefined();
    expect(withdrawnForBlock({}, teamIds)).toBeUndefined();
  });
});
