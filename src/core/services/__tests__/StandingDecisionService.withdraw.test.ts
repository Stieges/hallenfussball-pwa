/**
 * Paket TB-B, Task TB-3' (Kern): Gleichstands-Entscheidung zurücknehmen (Daniel „K6 ja“): jede Art – Annahme,
 * Strafstoßschießen, Reihenfolge – bis zum Abschluss der Gruppe, danach nicht mehr (WITHDRAW_NOT_ALLOWED). Schreibweg wie
 * `decide`: frisch lesen, über `record_standing_decision` mit Versionsprüfung, ohne Netz OFFLINE. Den Zustand „Gruppe
 * abgeschlossen“ liefert GA4 A-13; er ist eine Pflicht-Abhängigkeit des Dienstes (kein Voreinstellungswert), in der App
 * der echte Abschluss (`groupClosedFromCompletions`, A-13b-C).
 * Record `2026-09-27_wizard-regelinhalte` (@W2A-070; „wer wann“ → `entscheidung.personZeit.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';
import { rankTournamentGroup } from '../../standings/tournamentTable';
import { DATA, id } from '../../standings/__tests__/fixtures';
import { closeGroup, jgj, lage048, MemoryRepo, nikolaus, order, shared, shootout } from '../../standings/__tests__/decisionTestKit';
import { resolvePlayoffPairings } from '../../generators/playoffResolver';
import { StandingDecisionService } from '../StandingDecisionService';
import type { ITournamentRepository } from '../../repositories/ITournamentRepository';
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

describe("A-13b-C: echter Zustand „Gruppe abgeschlossen“ (löst die Zwischenregel ab, Review TB-3' A1) und Lesefehler (A5)", () => {
  it('@W2A-070 nach „Gruppe abschließen“ ist das Strafstoßschießen nicht mehr zurücknehmbar (WITHDRAW_NOT_ALLOWED, nichts geschrieben), vorher und nach dem Wiederöffnen schon', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service(['e-west']).decide(repo.tournament.id, shootout('W', 'S', 4, 3, 'A'))).ok).toBe(true);
    // Gegenbeispiel: vor dem Abschluss geht das Zurücknehmen.
    const vorher = new MemoryRepo(repo.tournament);
    expect(await vorher.service().withdraw(vorher.tournament.id, 'e-west')).toEqual({ ok: true });

    await closeGroup(repo, 'A');
    const writes = repo.writes;
    expect(await repo.service().withdraw(repo.tournament.id, 'e-west')).toEqual({ ok: false, code: 'WITHDRAW_NOT_ALLOWED' });
    expect(repo.writes).toBe(writes);
    expect(repo.tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-west']);

    expect((await repo.reopenGroup(repo.tournament.id, 'A', 'Ergebnis falsch eingetragen')).status).toBe('ok');
    expect(await repo.service().withdraw(repo.tournament.id, 'e-west')).toEqual({ ok: true });
  });

  it('@W2A-070 ein besetztes oder angepfiffenes Folgespiel allein macht die Gruppe nicht „abgeschlossen“ (Zwischenregel abgelöst)', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service(['e-west']).decide(repo.tournament.id, shootout('W', 'S', 4, 3, 'A'))).ok).toBe(true);
    resolvePlayoffPairings(repo.tournament);
    repo.tournament = { ...repo.tournament, matches: repo.tournament.matches.map((m) => (m.id === 'hf-2' ? { ...m, matchStatus: 'running' as const } : m)) };
    expect(await repo.service().withdraw(repo.tournament.id, 'e-west')).toEqual({ ok: true });
  });

  it('@W2A-070 liefert das frische Lesen kein Turnier, meldet die App einen Fehler statt eines Zurücknehmens (STALE)', async () => {
    const record = vi.fn();
    const repo = { get: () => Promise.resolve(null), recordStandingDecision: record } as unknown as ITournamentRepository;
    const service = new StandingDecisionService(repo, { groupClosed: () => false });
    expect(await service.withdraw('t-weg', 'e-1')).toEqual({ ok: false, code: 'STALE' });
    expect(record).not.toHaveBeenCalled();
  });
});
