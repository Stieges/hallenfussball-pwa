/**
 * Paket TB-B, Task TB-6b' (Oberfläche): Sicht auf Gleichstände einer Gruppe für die App – offene Blöcke mit Hinweisform
 * („Strafstoßschießen nötig“ / „Gleichstand – Entscheidung nötig“), Grund der Pflicht (Einstellung oder weiteres Spiel,
 * Daniel G2), entschiedene Blöcke, Marke je Team – und die Wirkung einer geänderten Einstellung auf bestehende
 * Annahmen (@W2A-068 Zeile 3, Rückfrage vor dem Speichern, K15). Aus dem Gherkin, nicht am Code abgelesen.
 * Records: `2026-09-27_wizard-regelinhalte` (@W2A-047, @W2A-050, @W2A-063, @W2A-064, @W2A-067, @W2A-068, @W2A-071),
 * `2026-10-01_endstand-und-torschuetzen` (@ET-025, @ET-055).
 */
import { describe, expect, it } from 'vitest';
import { DATA, id, league } from './fixtures';
import { rankTournamentGroup } from '../tournamentTable';
import { teamSlot } from '../../models/matchSlot';
import { closeGroup, jgj, lage048, MemoryRepo, nikolaus, order, shared, shootout } from './decisionTestKit';
import { groupTieView, placesChangeEffects, tieMarkerOf } from '../tieViews';

const marker = (t: ReturnType<typeof nikolaus>, key: Parameters<typeof id>[0]) => tieMarkerOf(groupTieView(t, ''), id(key));

describe('Paket TB-B Oberfläche: Sicht auf Gleichstände (tieViews)', () => {
  it('@W2A-067 Nikolaus mit Voreinstellung (nur Platz 1): Petting und Otting auf Platz 3 und 4 sind eine Wahl; Gegenbeispiel: Einstellung 1 bis 3 macht Strafstoßschießen zur Pflicht', () => {
    const view = groupTieView(nikolaus(), '');
    expect(view.open).toEqual([expect.objectContaining({ teamIds: expect.arrayContaining([id('P'), id('D')]), place: 3, size: 2, mayShare: true })]);
    expect(view.open[0].mandatory).toBeUndefined();
    expect(marker(nikolaus(), 'P')).toEqual({ kind: 'open' });
    expect(marker(nikolaus(), 'K')).toBeUndefined(); // Gegenbeispiel: Teams ohne Gleichstand tragen keine Marke

    const pflicht = groupTieView(nikolaus([1, 2, 3]), '');
    expect(pflicht.open[0]).toMatchObject({ mayShare: false, mandatory: { kind: 'setting', place: 3 } });
    expect(marker(nikolaus([1, 2, 3]), 'D')).toEqual({ kind: 'need' });
    // Gegenbeispiel: Plätze 1 und 2 berühren den Block auf 3 und 4 nicht
    expect(groupTieView(nikolaus([1, 2]), '').open[0].mayShare).toBe(true);
  });

  it('@W2A-064 Platz führt in ein weiteres Spiel: Strafstoßschießen nötig, Grund „weiteres Spiel“ – schlägt die Einstellung (kein Sprung in die Turnierregeln)', () => {
    const view = groupTieView(lage048(), 'A');
    expect(view.open[0]).toMatchObject({ place: 2, size: 2, mayShare: false, mandatory: { kind: 'followUp', place: 2 } });
    // Gegenbeispiel: steht Platz 2 auch in der Einstellung, bleibt der Grund das weitere Spiel – eine Änderung der Einstellung würde nichts helfen
    const beides = { ...lage048(), placementsToPlayOut: [2] };
    expect(groupTieView(beides, 'A').open[0].mandatory).toEqual({ kind: 'followUp', place: 2 });
    // Gruppe B hat keinen Gleichstand
    expect(groupTieView(lage048(), 'B').open).toEqual([]);
  });

  it('@W2A-047 mitten in der Gruppe: zwei Teams tragen dieselbe Ziffer 2, aber keine offenen Blöcke und keine Marke; Gegenbeispiel: nach allen Spielen markiert', () => {
    const mitten = { ...league('RKMUNO', DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }).tournament, version: 1 };
    expect(rankTournamentGroup(mitten, '').rows.filter((r) => [id('R'), id('K')].includes(r.team.id)).map((r) => r.place)).toEqual([2, 2]);
    expect(groupTieView(mitten, '').open).toEqual([]);
    expect(tieMarkerOf(groupTieView(mitten, ''), id('R'))).toBeUndefined();
    const fertig = { ...league('RKMUNO', DATA.ET_055).tournament, version: 1, placementsToPlayOut: [1, 2, 3] };
    expect(groupTieView(fertig, '').open[0]).toMatchObject({ place: 3, size: 2, mayShare: false });
    expect(tieMarkerOf(groupTieView(fertig, ''), id('R'))).toEqual({ kind: 'need' });
  });

  it('@W2A-063 nach „Ergebnis so akzeptieren“: Gleicher Platz für beide, entschiedener Block ohne offenen Hinweis', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-1']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    const view = groupTieView(repo.tournament, '');
    expect(view.open).toEqual([]);
    expect(view.decided).toEqual([expect.objectContaining({ place: 3, size: 2, decision: expect.objectContaining({ id: 'e-1', kind: 'shared' }) })]);
    expect(tieMarkerOf(view, id('P'))).toEqual({ kind: 'same' });
    expect(tieMarkerOf(view, id('D'))).toEqual({ kind: 'same' });
    expect(view.closed).toBe(false);
  });

  it('@ET-055 Strafstoßschießen 4:3 für Otting: Otting trägt „gewonnen 4:3“, Petting „verloren 3:4“; Reihenfolge von drei Teams wird als festgelegt markiert', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-2']).decide(repo.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    const view = groupTieView(repo.tournament, '');
    expect(tieMarkerOf(view, id('D'))).toEqual({ kind: 'shootoutWon', winner: 4, loser: 3 });
    expect(tieMarkerOf(view, id('P'))).toEqual({ kind: 'shootoutLost', winner: 4, loser: 3 });
    expect(view.decided[0].place).toBe(3);

    const drei = new MemoryRepo(jgj('WOUMNB', DATA.W2A_044, [1]));
    expect((await drei.service(['e-3']).decide(drei.tournament.id, order(['U', 'W', 'O'], 'Strafstoßschießen'))).ok).toBe(true);
    expect(tieMarkerOf(groupTieView(drei.tournament, ''), id('U'))).toEqual({ kind: 'ordered' });
  });

  it('@W2A-070 „Gruppe abgeschlossen“ ist der echte Abschluss: erst nach „Gruppe abschließen“ geschlossen, nach dem Wiederöffnen wieder offen', async () => {
    const repo = new MemoryRepo(lage048());
    expect((await repo.service(['e-w']).decide(repo.tournament.id, shootout('W', 'S', 4, 3, 'A'))).ok).toBe(true);
    expect(groupTieView(repo.tournament, 'A').closed).toBe(false);
    await closeGroup(repo, 'A');
    expect(groupTieView(repo.tournament, 'A').closed).toBe(true);
    expect(groupTieView(repo.tournament, 'B').closed).toBe(false); // Gegenbeispiel: andere Gruppe bleibt offen
    expect((await repo.reopenGroup(repo.tournament.id, 'A', 'Ergebnis falsch eingetragen')).status).toBe('ok');
    expect(groupTieView(repo.tournament, 'A').closed).toBe(false);
  });

  it('@W2A-070 Gegenbeispiel: ein besetztes Folgespiel aus der Gruppe schließt sie NICHT (Zwischenregel abgelöst)', () => {
    const t = lage048();
    const besetzt = {
      ...t,
      matches: t.matches.map((m) => (m.id === 'hf-1' ? { ...m, slotA: teamSlot(id('N')), originA: { kind: 'groupRank' as const, group: 'A', rank: 1 } } : m)),
    };
    expect(groupTieView(besetzt, 'A').closed).toBe(false);
  });

  it('@W2A-070 Jeder gegen jeden: der Abschluss der Gruppe „“ schließt, ein Abschluss unter „all“ ebenso (eine Abbildung)', () => {
    const t = nikolaus();
    expect(groupTieView({ ...t, groupCompletions: [{ groupId: '', ranking: [], openRanks: [], stale: false }] }, '').closed).toBe(true);
    expect(groupTieView({ ...t, groupCompletions: [{ groupId: 'all', ranking: [], openRanks: [], stale: false }] }, '').closed).toBe(true);
    expect(groupTieView({ ...t, groupCompletions: [{ groupId: '', ranking: [], openRanks: [], stale: false, reopenedAt: '2026-12-06T12:00:00Z' }] }, '').closed).toBe(false);
  });
});

describe('Paket TB-B Oberfläche: Wirkung einer geänderten Einstellung auf Annahmen (@W2A-068 Zeile 3, K15)', () => {
  it('@W2A-068 Platz 3 anhaken hebt die Annahme für Petting und Otting auf; Strafstoßschießen bleibt (Zeile 6); Gegenbeispiel: Platz außerhalb des Blocks ändert nichts', async () => {
    const repo = new MemoryRepo(nikolaus());
    expect((await repo.service(['e-annahme']).decide(repo.tournament.id, shared(['P', 'D']))).ok).toBe(true);
    expect(placesChangeEffects(repo.tournament, [1, 3]).lost.map((d) => d.id)).toEqual(['e-annahme']);
    expect(placesChangeEffects(repo.tournament, [1, 2, 3]).lost.map((d) => d.id)).toEqual(['e-annahme']);
    // Gegenbeispiele
    expect(placesChangeEffects(repo.tournament, [1, 2]).lost).toEqual([]);
    expect(placesChangeEffects(repo.tournament, [1]).lost).toEqual([]);
    expect(placesChangeEffects(repo.tournament, [1, 5, 6]).lost).toEqual([]);

    const mitSchiessen = new MemoryRepo(nikolaus());
    expect((await mitSchiessen.service(['e-sso']).decide(mitSchiessen.tournament.id, shootout('D', 'P', 4, 3))).ok).toBe(true);
    expect(placesChangeEffects(mitSchiessen.tournament, [1, 2, 3, 4]).lost).toEqual([]);
  });
});
