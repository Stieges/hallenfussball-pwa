/**
 * Paket TB-B, Task TB-3' (Kern): Gleichstands-Entscheidung zurücknehmen (Daniel „K6 ja“): jede Art – Annahme,
 * Strafstoßschießen, Reihenfolge – bis zum Abschluss der Gruppe, danach nicht mehr (WITHDRAW_NOT_ALLOWED). Schreibweg wie
 * `decide`: frisch lesen, nur `standingDecisions` mit Versionsprüfung, ohne Netz OFFLINE. Den Zustand „Gruppe
 * abgeschlossen“ liefert GA4 A-13; bis dahin ist er hier eine Abhängigkeit des Dienstes (Voreinstellung: nie).
 * Record `2026-09-27_wizard-regelinhalte` (@W2A-070; „wer wann“ → `entscheidung.personZeit.test.ts`).
 */
import { describe, expect, it } from 'vitest';
import { rankTournamentGroup } from '../../standings/tournamentTable';
import { DATA, id } from '../../standings/__tests__/fixtures';
import { jgj, MemoryRepo, nikolaus, order, shared, shootout } from '../../standings/__tests__/decisionTestKit';
import type { Tournament } from '../../../types/tournament';

const petting = (t: Tournament) => rankTournamentGroup(t, '').rows.filter((r) => [id('P'), id('D')].includes(r.team.id));

describe("TB-3' Entscheidung zurücknehmen (@W2A-070)", () => {
  it.each([
    { entscheidung: 'das Ergebnis akzeptiert', person: 'Olli', draft: shared(['P', 'D']), places: [1, 2] },
    { entscheidung: 'das Strafstoßschießen 4:3 für DJK Otting eingetragen', person: 'Olli', draft: shootout('D', 'P', 4, 3), places: undefined },
    { entscheidung: 'das Ergebnis akzeptiert', person: 'Maria (Co-Admin)', draft: shared(['P', 'D']), places: [1, 2] },
  ])('@W2A-070 Olli hat $entscheidung, $person nimmt sie zurück: wieder markiert, beide auf Platz 3', async ({ draft, places }) => {
    const repo = new MemoryRepo(nikolaus(places));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, draft)).ok).toBe(true);
    expect(petting(repo.tournament).some((r) => r.decisionNeeded)).toBe(false);

    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: true });
    expect(repo.tournament.standingDecisions).toEqual([]);
    expect(petting(repo.tournament).map((r) => [r.place, r.decisionNeeded])).toEqual([[3, true], [3, true]]);
    expect(repo.writes).toBe(2);
  });

  it('@W2A-070 auch eine Reihenfolge von drei Teams ist bis zum Gruppenabschluss zurücknehmbar', async () => {
    const repo = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044));
    expect((await repo.service(['e-reihe']).decide(repo.tournament.id, order(['U', 'W', 'O'], 'Strafstoßschießen'))).ok).toBe(true);
    expect(await repo.service().withdraw(repo.tournament.id, 'e-reihe')).toEqual({ ok: true });
    const { openTies } = rankTournamentGroup(repo.tournament, '');
    expect(openTies).toEqual([[id('W'), id('O'), id('U')]]);
  });

  it.each([
    { entscheidung: 'Annahme', draft: shared(['P', 'D']), places: [1, 2] },
    { entscheidung: 'Strafstoßschießen', draft: shootout('D', 'P', 4, 3), places: undefined },
  ])('@W2A-070 nach dem Abschluss der Gruppe bietet die App das Zurücknehmen nicht mehr an ($entscheidung): WITHDRAW_NOT_ALLOWED, nichts geschrieben', async ({ draft, places }) => {
    const repo = new MemoryRepo(nikolaus(places));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, draft)).ok).toBe(true);
    const abgeschlossen = repo.service([], (groupId) => groupId === '');
    expect(await abgeschlossen.withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: false, code: 'WITHDRAW_NOT_ALLOWED' });
    expect(repo.writes).toBe(1);
    expect(repo.tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-1']);
    // Gegenbeispiel: eine andere, nicht abgeschlossene Gruppe sperrt nicht.
    expect(await repo.service([], (groupId) => groupId === 'B').withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: true });
  });

  it('@W2A-070 ohne Netz nimmt die Tabelle nichts zurück (OFFLINE), die Entscheidung bleibt', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    repo.online = false;
    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: false, code: 'OFFLINE' });
    expect(repo.tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-1']);
  });

  it('@W2A-070 hat jemand zwischen Lesen und Schreiben geschrieben, liest die App neu und nimmt dann zurück (Versionsprüfung)', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    const alt = await repo.get();
    if (alt === null) { throw new Error('Turnier fehlt'); }
    repo.tournament = { ...repo.tournament, version: (repo.tournament.version ?? 0) + 1 };
    repo.staleReads.push(alt);
    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: true });
    expect(repo.tournament.standingDecisions).toEqual([]);
  });

  it('@W2A-070 ist die Entscheidung schon zurückgenommen (zwei Geräte), bleibt es dabei, ohne erneut zu schreiben', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: true });
    expect(await repo.service().withdraw(repo.tournament.id, 'e-1')).toEqual({ ok: true });
    expect(repo.writes).toBe(2);
  });
});
