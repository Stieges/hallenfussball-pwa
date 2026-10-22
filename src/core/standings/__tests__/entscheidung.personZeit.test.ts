/**
 * Paket TB-B, Task TB-3' / GA4 A-13b-C: „wer wann entschieden hat“ sieht allein die Turnierleitung – im öffentlich lesbaren
 * Turnierdatensatz steht es nicht (@W2A-072, Daniel B4d). Der interne Weg ist der Verlauf (`Tournament.decisionLog`, Server
 * `bracket_log_read`). Geprüft wird, was die App der Turnierleitung nach der Entscheidung über Person und Zeit liefert.
 *
 * Grün: @W2A-060 „von wem“ (`ALREADY_DECIDED` nennt die Person aus dem Verlauf).
 * `it.fails` bleiben die Fälle, die Person und Zeit an der ÖFFENTLICHEN Entscheidung (`standingDecisions[0]`, Tabellenzeile)
 * verlangen oder ein Feld `standingDecisionLog` nennen: Das widerspricht @W2A-072 („weder Name noch Zeitpunkt im öffentlichen
 * Lesepfad“) und dem Plan („Verlauf → `Tournament.decisionLog`“). Die Szenarien selbst sind erfüllt, belegt durch
 * `decisionLog.test.ts` und die Oberflächen-Tests (Befund C-ENTSCHEIDUNG-PERSON-OEFFENTLICH bleibt für diese Testform offen,
 * Bericht A-13b-C).
 */
import { describe, expect, it } from 'vitest';
import { rankTournamentGroup } from '../tournamentTable';
import { id } from './fixtures';
import { jgj, MemoryRepo, nikolaus, shared, shootout } from './decisionTestKit';

const PERSON_ZEIT = { decidedBy: { name: 'Olli' }, decidedAt: expect.any(String) as unknown };
const DATEN_PLATZ_1 = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';
const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';

describe("TB-3' wer und wann – nur intern, im Verlauf der Turnierleitung (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)", () => {
  it.fails('@W2A-063 die Turnierleitung sieht, wer das Ergebnis wann akzeptiert hat (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service().decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    const row = rankTournamentGroup(repo.tournament, '').rows.find((r) => r.team.id === id('P'));
    expect(row?.decision).toMatchObject(PERSON_ZEIT);
  });

  it.fails('@W2A-070 die Turnierleitung sieht, wer wann entschieden und wer wann zurückgenommen hat (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    expect((await repo.service().withdraw(repo.tournament.id, 'e-1')).ok).toBe(true);
    expect(repo.tournament).toMatchObject({ standingDecisionLog: [{ ...PERSON_ZEIT, action: 'decide' }, { ...PERSON_ZEIT, action: 'withdraw' }] });
  });

  it.fails('@W2A-071 Maria (Co-Admin) sieht, dass Olli das Strafstoßschießen eingetragen hat, und wann (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    const gelesenVonMaria = await repo.get();
    expect(gelesenVonMaria?.standingDecisions?.[0]).toMatchObject(PERSON_ZEIT);
  });

  it('@W2A-060 Maria sieht, dass und von wem schon entschieden wurde (Verlauf, GA4 A-13b-C)', async () => {
    const repo = new MemoryRepo(nikolaus());
    const gelesenVonMaria = await repo.get();
    if (gelesenVonMaria === null) { throw new Error('Turnier fehlt'); }
    expect((await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    repo.staleReads.push(gelesenVonMaria);
    expect(await repo.service().decide(repo.tournament.id, shootout('P', 'D', 5, 4))).toMatchObject({ ok: false, code: 'ALREADY_DECIDED', by: 'Olli' });
  });

  it.fails('@ET-029 der Verlauf hält die Annahme mit Person und Zeit fest, sichtbar nur für die Turnierleitung (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', async () => {
    const repo = new MemoryRepo(jgj('MNUWOB', DATEN_029));
    expect((await repo.service().decide(repo.tournament.id, shared(['N', 'U']))).ok).toBe(true);
    expect(repo.tournament.standingDecisions?.[0]).toMatchObject(PERSON_ZEIT);
  });

  it.fails('@W2A-004 die App hält die Entscheidung mit Zeit und Person fest (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service().decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(repo.tournament.standingDecisions?.[0]).toMatchObject(PERSON_ZEIT);
  });

  it.fails('@ET-027 der Verlauf hält die Entscheidung mit Person, Zeit und Ergebnis des Strafstoßschießens fest (C-ENTSCHEIDUNG-PERSON-OEFFENTLICH)', async () => {
    const repo = new MemoryRepo(jgj('MNWOUB', DATEN_PLATZ_1));
    expect((await repo.service().decide(repo.tournament.id, shootout('M', 'N', 3, 2))).ok).toBe(true);
    expect(repo.tournament.standingDecisions?.[0]).toMatchObject({ ...PERSON_ZEIT, shootout: { winner: 3, loser: 2 } });
  });
});
