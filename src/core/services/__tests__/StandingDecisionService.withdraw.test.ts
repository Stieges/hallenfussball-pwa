/**
 * Paket TB-B, Task TB-3' (Kern): Gleichstands-Entscheidung zurücknehmen (Daniel „K6 ja“): jede Art – Annahme,
 * Strafstoßschießen, Reihenfolge – bis zum Abschluss der Gruppe, danach nicht mehr (WITHDRAW_NOT_ALLOWED). Schreibweg wie
 * `decide`: frisch lesen, nur `standingDecisions` mit Versionsprüfung, ohne Netz OFFLINE. Den Zustand „Gruppe
 * abgeschlossen“ liefert GA4 A-13; bis dahin ist er eine Pflicht-Abhängigkeit des Dienstes (kein Voreinstellungswert),
 * in der App die Zwischenregel `groupClosedByFollowUp`.
 * Record `2026-09-27_wizard-regelinhalte` (@W2A-070; „wer wann“ → `entscheidung.personZeit.test.ts`).
 */
import { describe, expect, it, vi } from 'vitest';
import { rankTournamentGroup } from '../../standings/tournamentTable';
import { DATA, id } from '../../standings/__tests__/fixtures';
import { jgj, lage048, MemoryRepo, nikolaus, order, shared, shootout } from '../../standings/__tests__/decisionTestKit';
import { groupClosedByFollowUp } from '../../standings/groupClosure';
import { slotSource, teamSlot } from '../../models/matchSlot';
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

describe("TB-3' Fixrunde: Zwischenregel „Gruppe abgeschlossen“ bis GA4 A-13 (Review A1) und Lesefehler (A5)", () => {
  it('@W2A-070 Zwischenregel: geschlossen, sobald ein Spiel mit Herkunft aus der Gruppe besetzt oder angepfiffen ist; Gegenbeispiel: andere Gruppe, nichts besetzt', () => {
    const t = lage048();
    expect([groupClosedByFollowUp(t, 'A'), groupClosedByFollowUp(t, 'B')]).toEqual([false, false]);
    // Gruppe B hat keinen Gleichstand → Halbfinals bekommen ihre B-Seiten; Gruppe A (Süd/West offen) bleibt offen.
    resolvePlayoffPairings(t);
    expect([groupClosedByFollowUp(t, 'A'), groupClosedByFollowUp(t, 'B')]).toEqual([false, true]);
    // Angepfiffen, obwohl die A-Seite noch offen ist: Halbfinale 2 („Zweiter Gruppe A“) läuft.
    const laeuft = { ...t, matches: t.matches.map((m) => (m.id === 'hf-2' ? { ...m, matchStatus: 'running' as const } : m)) };
    expect(groupClosedByFollowUp(laeuft, 'A')).toBe(true);
  });

  // N-A1 (Nachreview): eine von Hand besetzte Seite (`resolvedFrom` fällt weg, `originX` bleibt) schließt die Gruppe;
  // ein angepfiffenes Spiel zählt auch im Laufzeitwert `paused` (der Typ kennt ihn nicht).
  const handBesetzt = (t: Tournament, matchId: string, side: 'A' | 'B', status?: 'running'): Tournament => ({
    ...t,
    matches: t.matches.map((m) => {
      if (m.id !== matchId) {
        return m;
      }
      const slot = side === 'A' ? m.slotA : m.slotB;
      const origin = slotSource(slot);
      return {
        ...m,
        ...(side === 'A' ? { originA: origin, slotA: teamSlot(id('S')) } : { originB: origin, slotB: teamSlot(id('S')) }),
        ...(status !== undefined ? { matchStatus: status } : {}),
      };
    }),
  });

  it('@W2A-070 Zwischenregel: von Hand besetzte Seite aus der Gruppe schließt sie, auch geplant; Gegenbeispiel: Seite aus anderer Gruppe', () => {
    const t = handBesetzt(lage048(), 'hf-2', 'B');
    expect(groupClosedByFollowUp(t, 'A')).toBe(true);
    expect(groupClosedByFollowUp(t, 'B')).toBe(false);
    // Gegenbeispiel: dieselbe Handbesetzung auf der B-Seite von HF1 (Herkunft „Zweiter Gruppe B“) schließt nur Gruppe B.
    const anders = handBesetzt(lage048(), 'hf-1', 'B');
    expect([groupClosedByFollowUp(anders, 'A'), groupClosedByFollowUp(anders, 'B')]).toEqual([false, true]);
    // Gegenbeispiel: Team ohne bekannte Herkunft (kein origin, kein resolvedFrom) schließt keine Gruppe.
    const ohneHerkunft = { ...lage048(), matches: lage048().matches.map((m) => (m.id === 'hf-2' ? { ...m, slotB: teamSlot(id('S')) } : m)) };
    expect(groupClosedByFollowUp(ohneHerkunft, 'A')).toBe(false);
  });

  it('@W2A-070 Zwischenregel: von Hand besetzt und pausiert (Laufzeitwert paused) ist geschlossen; geplant/wartend/ausgefallen allein nicht', () => {
    const paused = handBesetzt(lage048(), 'hf-2', 'B', 'paused' as 'running');
    expect(groupClosedByFollowUp(paused, 'A')).toBe(true);
    // pausiert, Seite noch offen (angepfiffen über die andere, besetzte Seite aus Gruppe A)
    const pausedOffen = { ...lage048(), matches: lage048().matches.map((m) => (m.id === 'hf-2' ? { ...m, matchStatus: 'paused' } : m)) };
    expect(groupClosedByFollowUp(pausedOffen, 'A')).toBe(true);
    for (const status of ['scheduled', 'waiting', 'skipped'] as const) {
      const offen = { ...lage048(), matches: lage048().matches.map((m) => (m.id === 'hf-2' ? { ...m, matchStatus: status } : m)) };
      expect(groupClosedByFollowUp(offen, 'A')).toBe(false);
    }
  });

  it('@W2A-070 Zwischenregel im Dienst: nach dem Besetzen des Halbfinales ist das Strafstoßschießen nicht mehr zurücknehmbar, davor schon', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service(['e-west']).decide(repo.tournament.id, shootout('W', 'S', 4, 3, 'A'))).ok).toBe(true);
    // Gegenbeispiel: vor dem Besetzen geht das Zurücknehmen (Standardregel des Kits = Zwischenregel).
    const vorher = new MemoryRepo(repo.tournament);
    expect(await vorher.service().withdraw(vorher.tournament.id, 'e-west')).toEqual({ ok: true });

    resolvePlayoffPairings(repo.tournament);
    expect(groupClosedByFollowUp(repo.tournament, 'A')).toBe(true);
    expect(await repo.service().withdraw(repo.tournament.id, 'e-west')).toEqual({ ok: false, code: 'WITHDRAW_NOT_ALLOWED' });
    expect(repo.tournament.standingDecisions?.map((d) => d.id)).toEqual(['e-west']);
  });

  it('@W2A-070 liefert das frische Lesen kein Turnier, meldet die App einen Fehler statt eines Zurücknehmens (STALE)', async () => {
    const update = vi.fn();
    const repo = { get: () => Promise.resolve(null), updateStandingDecisions: update } as unknown as ITournamentRepository;
    const service = new StandingDecisionService(repo, { groupClosed: () => false });
    expect(await service.withdraw('t-weg', 'e-1')).toEqual({ ok: false, code: 'STALE' });
    expect(update).not.toHaveBeenCalled();
  });
});
