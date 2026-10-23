/**
 * Paket TB, Task TB-3: Schreibweg der Gleichstands-Entscheidung (Plan v2 § 3.2, R-TB-5): frisch lesen, prüfen, nur
 * `standingDecisions` mit Versionsprüfung schreiben; Konflikt → einmal neu, sonst STALE; ohne Netz → OFFLINE (F9).
 * Record `2026-09-27_wizard-regelinhalte` (@W2A-060, @W2A-061, @W2A-062), Turniermodi (@TM-146, nur `validateDraft`;
 * Warteschlange/Server gehören zu GA4 A-13b/A-15c). Repository-Attrappe mit echter Versionslogik.
 */
import { describe, expect, it } from 'vitest';
import { validateDraft } from '../../standings/validateDraft';
import { DATA, id } from '../../standings/__tests__/fixtures';
import { jgj, lage048, MemoryRepo, nikolaus, shared, shootout } from '../../standings/__tests__/decisionTestKit';

describe('TB-3 StandingDecisionService', () => {
  // „von wem“ steht nicht im Turnierdatensatz (@W2A-072), sondern im Verlauf der Turnierleitung (GA4 A-13b-C).
  it('@W2A-060 zwei Entscheidungen über denselben Gleichstand – die erste gilt, Maria erfährt, dass schon entschieden wurde', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
    // Olli und Maria haben beide Version v gelesen.
    const gelesenVonMaria = await repo.get();
    if (gelesenVonMaria === null) { throw new Error('Turnier fehlt'); }

    expect((await repo.service(['e-olli']).decide(repo.tournament.id, shootout('R', 'K', 4, 3))).ok).toBe(true);
    repo.staleReads.push(gelesenVonMaria);
    const maria = await repo.service(['e-maria']).decide(repo.tournament.id, shootout('K', 'R', 5, 4));

    expect(maria).toEqual({ ok: false, code: 'ALREADY_DECIDED', by: 'Olli' }); // „von wem“ aus dem Verlauf (A-13b-C)
    expect(repo.writes).toBe(1);
    expect(repo.tournament.standingDecisions).toHaveLength(1);
    expect(repo.tournament.standingDecisions?.[0]).toMatchObject({ id: 'e-olli', order: [id('R'), id('K')], shootout: { winner: 4, loser: 3 } });
  });

  it('@W2A-060 Gegenbeispiel: hat sich der Block inzwischen geändert, meldet die App BLOCK_CHANGED und schreibt nichts', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.W2A_052));
    repo.correct('N', 'O', 1, 1); // FC Nord kommt dazu – der Block ist jetzt Waging rot, FC Nord, Kammer … und aufgelöst
    const result = await repo.service().decide(repo.tournament.id, shootout('K', 'R', 4, 3));
    expect(result).toEqual({ ok: false, code: 'BLOCK_CHANGED' });
    expect(repo.writes).toBe(0);
  });

  it('STALE: kommt auch der zweite Versuch nicht durch (Version ändert sich weiter), schreibt die App nichts', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
    const alt = await repo.get();
    if (alt === null) { throw new Error('Turnier fehlt'); }
    repo.tournament = { ...repo.tournament, version: 5 };
    repo.staleReads.push(alt, alt);
    expect(await repo.service().decide(repo.tournament.id, shootout('K', 'R', 4, 3))).toEqual({ ok: false, code: 'STALE' });
    expect(repo.writes).toBe(0);
  });

  it('@W2A-061 ein Strafstoßschießen-Ergebnis ohne Sieger (4:4) nimmt die App nicht an', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
    expect(await repo.service().decide(repo.tournament.id, shootout('R', 'K', 4, 4))).toEqual({ ok: false, code: 'SHOOTOUT_NEEDS_WINNER' });
    expect(await repo.service().decide(repo.tournament.id, shootout('R', 'K', 3, 4))).toEqual({ ok: false, code: 'SHOOTOUT_NEEDS_WINNER' });
    expect(repo.writes).toBe(0);
    // Gegenbeispiel: 4:3 wird angenommen.
    expect((await repo.service().decide(repo.tournament.id, shootout('R', 'K', 4, 3))).ok).toBe(true);
  });

  it('@W2A-062 ohne Netz übernimmt die Tabelle nichts (OFFLINE); die Prüfung ohne Netz liefert dieselben Fehler', async () => {
    const repo = new MemoryRepo(jgj('RKMUNO', DATA.ET_055));
    repo.online = false;

    expect(await repo.service().decide(repo.tournament.id, shootout('R', 'K', 4, 3))).toEqual({ ok: false, code: 'OFFLINE' });
    expect(repo.writes).toBe(0);
    expect(repo.tournament.standingDecisions).toBeUndefined();
    // Gleiche Fehler mit und ohne Netz (Weg „Gruppe abschließen“ prüft mit validateDraft).
    expect(await repo.service().decide(repo.tournament.id, shootout('R', 'K', 4, 4))).toEqual({ ok: false, code: 'SHOOTOUT_NEEDS_WINNER' });
    expect(validateDraft(shootout('R', 'K', 4, 4), repo.tournament)).toEqual({ ok: false, code: 'SHOOTOUT_NEEDS_WINNER' });
  });

  it('@W2A-062 ohne Netz übernimmt die Tabelle auch „Ergebnis so akzeptieren“ nicht (OFFLINE); validateDraft prüft es ohne Netz', async () => {
    const repo = new MemoryRepo(nikolaus([1, 2]));
    repo.online = false;
    expect(await repo.service().decide(repo.tournament.id, shared(['P', 'D']))).toEqual({ ok: false, code: 'OFFLINE' });
    expect(repo.writes).toBe(0);
    expect(repo.tournament.standingDecisions).toBeUndefined();
    expect(validateDraft(shared(['P', 'D']), repo.tournament)).toEqual({ ok: true, groupId: '', block: { place: 3, size: 2 } });
  });

  it('@TM-146:teil ohne Netz prüft validateDraft den Eintrag beim Abschluss der Gruppe, ohne zu schreiben', () => {
    const t = lage048();
    expect(validateDraft(shootout('W', 'S', 4, 3, 'A'), t)).toEqual({ ok: true, groupId: 'A', block: { place: 2, size: 2 } });
    // Gegenbeispiel: falsche Gruppe (Gruppe B hat keinen offenen Block) → BLOCK_CHANGED.
    expect(validateDraft(shootout('W', 'S', 4, 3, 'B'), t)).toEqual({ ok: false, code: 'BLOCK_CHANGED' });
  });
});
