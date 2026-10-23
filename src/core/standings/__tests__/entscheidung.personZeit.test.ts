/**
 * Paket TB-B, Task TB-3' / GA4 A-13b-C: „wer wann entschieden hat“ sieht allein die Turnierleitung – im öffentlich lesbaren
 * Turnierdatensatz (`config`, `standingDecisions`, Tabellenzeile) steht es nicht (@W2A-072, Daniel B4d). Der interne Weg ist
 * der Verlauf (`Tournament.decisionLog`, Server `bracket_log_read`).
 *
 * Jede Kennung prüft zwei Dinge: Person und Zeit stehen im Verlauf, und beides fehlt in der öffentlichen Entscheidung.
 * (Korrektur der Testform, Lern-Spur: die früheren `it.fails` verlangten Person und Zeit an `standingDecisions[0]`, was
 * @W2A-072 und dem Server widerspricht.)
 */
import { describe, expect, it } from 'vitest';
import { rankTournamentGroup } from '../tournamentTable';
import { jgj, MemoryRepo, nikolaus, shared, shootout } from './decisionTestKit';
import { decidedBy, withdrawnBy } from '../decisionLog';


const DATEN_PLATZ_1 = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';
const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';


/** Person und Zeit im Verlauf, nicht in der öffentlichen Entscheidung (@W2A-072). */
function istNurImVerlauf(repo: MemoryRepo, decisionId: string): void {
  expect(decidedBy(repo.tournament, decisionId)).toEqual({ name: 'Olli', at: expect.any(String) });
  const oeffentlich = JSON.stringify(repo.tournament.standingDecisions);
  expect(oeffentlich).not.toMatch(/decidedBy|decidedAt|Olli|reason/);
  for (const group of ['', 'A']) {
    const rows = rankTournamentGroup(repo.tournament, group).rows;
    expect(JSON.stringify(rows.map((r) => r.decision))).not.toMatch(/decidedBy|decidedAt|Olli/);
  }
}

describe("TB-3' wer und wann – im Verlauf der Turnierleitung, nie im öffentlichen Datensatz", () => {
  it('@W2A-063 wer das Ergebnis wann akzeptiert hat, steht im Verlauf – nicht in der Tabellenzeile', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    istNurImVerlauf(repo, 'e-1');
    expect(repo.tournament.decisionLog?.[0]).toMatchObject({ kind: 'standing_decision', detail: { kind: 'shared' } });
  });

  it('@W2A-070 wer wann entschieden und wer wann zurückgenommen hat, steht im Verlauf', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    repo.author = 'Maria';
    expect((await repo.service().withdraw(repo.tournament.id, 'e-1')).ok).toBe(true);
    expect(decidedBy(repo.tournament, 'e-1')).toEqual({ name: 'Olli', at: expect.any(String) });
    expect(withdrawnBy(repo.tournament, 'e-1')).toEqual({ name: 'Maria', at: expect.any(String) });
    expect(repo.tournament.decisionLog?.map((e) => e.kind)).toEqual(['standing_decision', 'standing_withdraw']);
    expect(JSON.stringify(repo.tournament)).not.toMatch(/"decidedBy"|"decidedAt"/);
  });

  it('@W2A-071 Maria (Co-Admin) liest den Stand: der Verlauf nennt Olli und die Zeit, die Entscheidung selbst nicht', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    const gelesenVonMaria = await repo.get();
    expect(gelesenVonMaria).not.toBeNull();
    if (gelesenVonMaria === null) { return; }
    expect(decidedBy(gelesenVonMaria, 'e-1')?.name).toBe('Olli');
    expect(JSON.stringify(gelesenVonMaria.standingDecisions)).not.toMatch(/Olli|decidedBy|decidedAt/);
  });

  it('@W2A-060 Maria sieht, dass und von wem schon entschieden wurde (Verlauf, GA4 A-13b-C)', async () => {
    const repo = new MemoryRepo(nikolaus());
    const gelesenVonMaria = await repo.get();
    if (gelesenVonMaria === null) { throw new Error('Turnier fehlt'); }
    expect((await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    repo.staleReads.push(gelesenVonMaria);
    expect(await repo.service().decide(repo.tournament.id, shootout('P', 'D', 5, 4))).toMatchObject({ ok: false, code: 'ALREADY_DECIDED', by: 'Olli' });
  });

  it('@ET-029 der Verlauf hält die Annahme mit Person und Zeit fest, sichtbar nur für die Turnierleitung', async () => {
    const repo = new MemoryRepo(jgj('MNUWOB', DATEN_029));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['N', 'U']))).ok).toBe(true);
    istNurImVerlauf(repo, 'e-1');
  });

  it('@W2A-004 die App hält die Entscheidung mit Zeit und Person fest – im Verlauf, nicht im config', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    istNurImVerlauf(repo, 'e-1');
  });

  it('@ET-027 der Verlauf hält die Entscheidung mit Person, Zeit und Ergebnis des Strafstoßschießens fest', async () => {
    const repo = new MemoryRepo(jgj('MNWOUB', DATEN_PLATZ_1));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shootout('M', 'N', 3, 2))).ok).toBe(true);
    istNurImVerlauf(repo, 'e-1');
    expect(repo.tournament.decisionLog?.[0].detail).toMatchObject({ shootout: { winner: 3, loser: 2 } });
    expect(repo.tournament.standingDecisions?.[0]).toMatchObject({ shootout: { winner: 3, loser: 2 } });
  });

  it('Gegenbeispiel: ohne Eintrag im Verlauf (Helfer, vor G1) kennt die App weder Person noch Zeit', async () => {
    const repo = new MemoryRepo(nikolaus());
    await repo.service(['e-1']).decide(repo.tournament.id, shootout('D', 'P', 4, 3));
    expect(decidedBy({ ...repo.tournament, decisionLog: undefined }, 'e-1')).toBeUndefined();
  });
});
