/**
 * GA4 A-13a (Plan `task-GA4-plan-v2.md` § 5): „Gruppe abschließen“ vorbereiten – offene Spiele, Gleichstände (Blöcke
 * UNVERÄNDERT aus `groupTieView`, Paket TB-B), Rangfolge, gültige Entscheidungen, Stand für den Server (R-GA4v2-3),
 * erneuter Abschluss nach Korrektur (R-GA4v2-4). Aus dem Gherkin abgeleitet, nicht am Code abgelesen.
 * Record `2026-10-01_turniermodi` (@TM-043, @TM-048, @TM-049, @TM-057, @TM-060, @TM-145),
 * `2026-09-27_wizard-regelinhalte` (@W2A-048, @W2A-058, @W2A-063, @W2A-064, @W2A-067).
 */
import { describe, expect, it } from 'vitest';
import type { Match, StandingDecision, Tournament } from '../../../types/tournament';
import type { DecisionDraft } from '../../standings/decisions';
import { expectedState, groupState, prepareGroupCompletion, prepareRecompletion, proposeGroupCompletion } from '../GroupCompletionService';
import { groupTieView } from '../../standings/tieViews';
import { teamSlot } from '../../models/matchSlot';
import { groupRank, slots } from '../../../test/matchSlotFixtures';
import { MemoryRepo } from '../../standings/__tests__/decisionTestKit';
import { ET021_GRUPPE_A, ET021_GRUPPE_B, zweiGruppen } from '../../standings/__tests__/tb4Kit';
import { id } from '../../standings/__tests__/fixtures';
import { completion, HC, matchLabelled, matchOf, NK, tournamentFromFixture, withMatch } from '../../standings/__tests__/groupCompletionKit';

const hallencup = (): Tournament => tournamentFromFixture('hallencup');
const nikolaus = (places?: number[]): Tournament => ({ ...tournamentFromFixture('nikolaus'), ...(places !== undefined ? { placementsToPlayOut: places } : {}), version: 1 });

/** Entscheidung wie die Turnierleitung in der Tabelle (Dienst TB-3', echte Grundlage); wirft bei Ablehnung. */
async function decide(t: Tournament, draft: DecisionDraft): Promise<{ tournament: Tournament; decision: StandingDecision }> {
  const repo = new MemoryRepo({ ...t, version: t.version ?? 1 });
  const result = await repo.service(['entscheidung-1']).decide(repo.tournament.id, draft);
  if (!result.ok) {
    throw new Error(`Entscheidung abgelehnt: ${result.code}`);
  }
  const decision = repo.tournament.standingDecisions?.find((d) => d.id === 'entscheidung-1');
  if (decision === undefined) {
    throw new Error('Entscheidung nicht gespeichert');
  }
  return { tournament: repo.tournament, decision };
}

const westGewinnt = (groupId = 'A'): DecisionDraft => ({
  groupId, teamIds: [HC.west, HC.sued], order: [HC.west, HC.sued], kind: 'shootout', shootout: { winner: 4, loser: 3 },
});

describe('A-13a Gleichstand im Abschluss (@W2A-048, Hallencup Nord als Cloud-Zeilen)', () => {
  it('@TM-048 @W2A-048 Süd und West gleich auf 2 und 3: der Abschluss verlangt zuerst das Strafstoßschießen – Block unverändert aus groupTieView', () => {
    const t = hallencup();
    const result = prepareGroupCompletion(t, 'A');
    expect(result).toEqual({
      code: 'DECISION_REQUIRED',
      blocks: [{ groupId: 'A', teamIds: [HC.sued, HC.west], place: 2, size: 2, mayShare: false, mandatory: { kind: 'followUp', place: 2 } }],
    });
    expect(result.code === 'DECISION_REQUIRED' && result.blocks).toEqual(groupTieView(t, 'A').open);
  });

  it('@TM-043 keine Auslosung: der Block bietet nur das Strafstoßschießen an (keine weitere Wahl im Ergebnis)', () => {
    const result = prepareGroupCompletion(hallencup(), 'A');
    expect(result.code).toBe('DECISION_REQUIRED');
    const block = result.code === 'DECISION_REQUIRED' ? result.blocks[0] : undefined;
    expect(Object.keys(block ?? {}).sort()).toEqual(['groupId', 'mandatory', 'mayShare', 'place', 'size', 'teamIds']);
    expect(block?.mayShare).toBe(false);
  });

  it('@TM-049 ohne Entscheidung bleibt Gruppe A offen: kein „bereit“-Ergebnis, nicht abgeschlossen, Halbfinals zeigen weiter die Herkunft', () => {
    const t = hallencup();
    expect(prepareGroupCompletion(t, 'A').code).not.toBe('READY');
    expect(groupState(t, 'A')).toBe('finished');
    expect([matchLabelled(t, '1. Halbfinale').slotA.kind, matchLabelled(t, '2. Halbfinale').slotB.kind]).toEqual(['pending', 'pending']);
  });

  it('@W2A-058 @TM-048 4:3 für West in der Tabelle: Abschluss fragt nicht erneut, bereit mit Rangfolge Nord, West, Süd, Ost und der Entscheidung; die Tabelle allein schließt nicht ab', async () => {
    const { tournament, decision } = await decide(hallencup(), westGewinnt());
    expect(groupState(tournament, 'A')).toBe('finished');
    expect(matchLabelled(tournament, '2. Halbfinale').slotB.kind).toBe('pending');
    expect(proposeGroupCompletion(tournament)).toEqual(['A']);
    expect(prepareGroupCompletion(tournament, 'A')).toEqual({
      code: 'READY',
      ranking: [HC.nord, HC.west, HC.sued, HC.ost],
      openRanks: [],
      tieDecisions: [decision],
      expectedState: expectedState(tournament, 'A'),
    });
  });

  it('@W2A-048 Gegenbeispiel: eine Entscheidung einer anderen Gruppe zählt für Gruppe A nicht', () => {
    const fremd: StandingDecision = { id: 'fremd', groupId: 'B', teamIds: [HC.sued, HC.west], order: [HC.west, HC.sued], kind: 'shootout', shootout: { winner: 4, loser: 3 }, basis: 'x' };
    expect(prepareGroupCompletion({ ...hallencup(), standingDecisions: [fremd] }, 'A').code).toBe('DECISION_REQUIRED');
  });
});

/** @TM-060: Gruppe A (Nord, Süd, West, Ost) mit West und Ost gleich auf 3 und 4, Gruppe B ohne Gleichstand, Halbfinals. */
function lage060(places: number[], spielUmPlatz5: boolean): Tournament {
  const t = zweiGruppen('NSWO', ET021_GRUPPE_A, 'MBUT', ET021_GRUPPE_B);
  const finals: Match[] = [
    { id: 'hf-1', round: 7, field: 1, isFinal: true, phase: 'semifinal', label: '1. Halbfinale', ...slots(groupRank('A', 1), groupRank('B', 2)) },
    { id: 'hf-2', round: 7, field: 2, isFinal: true, phase: 'semifinal', label: '2. Halbfinale', ...slots(groupRank('B', 1), groupRank('A', 2)) },
    ...(spielUmPlatz5 ? [{ id: 'p5', round: 8, field: 1, isFinal: true, finalType: 'fifthSixth' as const, label: 'Spiel um Platz 5', ...slots(groupRank('A', 3), groupRank('B', 3)) }] : []),
  ];
  return { ...t, matches: [...t.matches, ...finals], placementsToPlayOut: places };
}

describe('A-13a @TM-060 „Ergebnis so akzeptieren“ nur, wenn der Platz weder ausgespielt werden muss noch in ein weiteres Spiel führt', () => {
  it.each([
    { plaetze: [1, 2], herkunft: 'kein Spiel hat die Herkunft „Dritter/Vierter Gruppe A“', p5: false, mayShare: true, mandatory: undefined },
    { plaetze: [1, 2, 3], herkunft: 'kein Spiel hat die Herkunft „Dritter/Vierter Gruppe A“', p5: false, mayShare: false, mandatory: { kind: 'setting', place: 3 } },
    { plaetze: [1, 2], herkunft: 'Spiel um Platz 5 „Dritter Gruppe A gegen Dritter Gruppe B“', p5: true, mayShare: false, mandatory: { kind: 'followUp', place: 3 } },
  ])('@TM-060 Plätze $plaetze, $herkunft → Abschluss verlangt die Entscheidung, akzeptieren erlaubt: $mayShare', ({ plaetze, p5, mayShare, mandatory }) => {
    const t = lage060(plaetze, p5);
    const result = prepareGroupCompletion(t, 'A');
    expect(result.code).toBe('DECISION_REQUIRED');
    const blocks = result.code === 'DECISION_REQUIRED' ? result.blocks : [];
    expect(blocks).toEqual(groupTieView(t, 'A').open); // keine eigene Regel neben TB-B
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toMatchObject({ teamIds: [id('W'), id('O')], place: 3, size: 2, mayShare });
    expect(blocks[0].mandatory).toEqual(mandatory);
  });
});

describe('A-13a Nikolaus (Jeder gegen jeden, echt erzeugt): Annahme und Pflicht im Abschluss', () => {
  it('@W2A-063 @W2A-067 nur Platz 1 und 2 auszuspielen: „Ergebnis so akzeptieren“ ohne Grund → bereit, beide auf Platz 3', async () => {
    const draft: DecisionDraft = { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' };
    const { tournament, decision } = await decide(nikolaus([1, 2]), draft);
    expect(prepareGroupCompletion(tournament, '')).toEqual({
      code: 'READY',
      ranking: [NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau],
      openRanks: [],
      tieDecisions: [decision],
      expectedState: expectedState(tournament, ''),
    });
  });

  it('@W2A-064 @W2A-067 Platz 1 bis 3: nur das Strafstoßschießen (Grund Einstellung Platz 3); Gegenbeispiel kein Platz: akzeptieren erlaubt', () => {
    const pflicht = prepareGroupCompletion(nikolaus([1, 2, 3]), '');
    expect(pflicht).toEqual({ code: 'DECISION_REQUIRED', blocks: [expect.objectContaining({ mayShare: false, mandatory: { kind: 'setting', place: 3 } })] });
    const frei = prepareGroupCompletion(nikolaus([]), '');
    expect(frei).toEqual({ code: 'DECISION_REQUIRED', blocks: [expect.objectContaining({ mayShare: true })] });
  });

  it('@TM-057 der Stand der einzigen Gruppe umfasst alle 15 Spiele (Spiele „all“), keine eigene Gruppe „all“', () => {
    expect(expectedState(nikolaus(), '')).toHaveLength(15);
    expect(expectedState(nikolaus(), 'all')).toEqual([]);
    expect(prepareGroupCompletion(nikolaus(), 'all')).toEqual({ code: 'UNKNOWN_GROUP' });
  });
});

describe('A-13a Stand für den Vergleich am Server (R-GA4v2-3, Auflage 7; Server-Tests RT-2, RT-18)', () => {
  it('Korrektur bei gleichem Status ändert den Stand (Tore gehören dazu)', () => {
    const t = hallencup();
    const m = matchOf(t, HC.nord, HC.sued);
    const vorher = expectedState(t, 'A');
    const nachher = expectedState(withMatch(t, m.id, { scoreA: 1, scoreB: 2 }), 'A');
    expect(nachher).not.toEqual(vorher);
    expect(nachher.find((e) => e.id === m.id)).toMatchObject({ s: 'finished', a: 1, b: 2 });
  });

  it('Team-Tausch im Gruppenspiel ändert den Stand (Teams gehören dazu); Gegenbeispiel: Finalrunde gehört nie dazu', () => {
    const t = hallencup();
    const m = matchOf(t, HC.nord, HC.sued);
    const getauscht = withMatch(t, m.id, { slotA: teamSlot(HC.sued), slotB: teamSlot(HC.nord) });
    expect(expectedState(getauscht, 'A')).not.toEqual(expectedState(t, 'A'));
    expect(expectedState(getauscht, 'A').find((e) => e.id === m.id)).toMatchObject({ ta: HC.sued, tb: HC.nord });
    const hf2 = matchLabelled(t, '2. Halbfinale');
    const besetzt = withMatch(t, hf2.id, { slotB: teamSlot(HC.west, { kind: 'groupRank', group: 'A', rank: 2 }) });
    expect(expectedState(besetzt, 'A')).toEqual(expectedState(t, 'A'));
  });

  it('Nichtantritt gehört dazu; fehlende Werte fehlen, statt null zu sein', () => {
    const b = expectedState(hallencup(), 'B');
    expect(b.find((e) => e.f !== undefined)).toMatchObject({ a: 0, b: 2, s: 'finished', f: 'A' });
    expect(b.filter((e) => e.s === 'scheduled').every((e) => !('a' in e) && !('b' in e) && !('f' in e))).toBe(true);
  });
});

describe('A-13a @TM-145 erneuter Abschluss nach Korrektur: offene Plätze mit Folgespiel gehen auf die Herkunft zurück', () => {
  async function abgeschlossen(): Promise<Tournament> {
    const { tournament } = await decide(hallencup(), westGewinnt());
    const hf1 = matchLabelled(tournament, '1. Halbfinale');
    const hf2 = matchLabelled(tournament, '2. Halbfinale');
    const besetzt = withMatch(withMatch(tournament, hf1.id, { slotA: teamSlot(HC.nord, { kind: 'groupRank', group: 'A', rank: 1 }) }),
      hf2.id, { slotB: teamSlot(HC.west, { kind: 'groupRank', group: 'A', rank: 2 }) });
    return { ...besetzt, groupCompletions: [completion('A', [HC.nord, HC.west, HC.sued, HC.ost])] };
  }

  it('@TM-145 Süd – West 1:1 → 2:2, beide weiter gleich: Entscheidung aufgehoben, Plätze 2 und 3 offen, Gruppe „abgeschlossen“ mit „Besetzung prüfen“', async () => {
    const t = await abgeschlossen();
    const korrigiert = withMatch(t, matchOf(t, HC.sued, HC.west).id, { scoreA: 2, scoreB: 2 });
    const stale = { ...korrigiert, groupCompletions: [completion('A', [HC.nord, HC.west, HC.sued, HC.ost], { stale: true })] };
    expect(groupState(stale, 'A')).toBe('stale');
    const result = prepareRecompletion(stale, 'A');
    expect(result).toMatchObject({ code: 'READY', openRanks: [2, 3], tieDecisions: [], expectedState: expectedState(stale, 'A') });
    expect(result.code === 'READY' && result.ranking[0]).toBe(HC.nord);
    // Gegenbeispiel: der erste Abschluss darf keine Plätze offen lassen – dort wird die Entscheidung verlangt
    expect(prepareGroupCompletion(stale, 'A').code).toBe('DECISION_REQUIRED');
  });

  it('@TM-145 @TM-150 Gegenbeispiele: nicht veraltet → wie der erste Abschluss; Pflicht-Block nur aus der Einstellung (ohne Folgespiel) wird nie still festgelegt', async () => {
    const t = await abgeschlossen();
    expect(prepareRecompletion(t, 'A')).toEqual(prepareGroupCompletion(t, 'A'));

    // @TM-150 (Entscheidung Daniel 2026-10-22, Befund C-NEUABSCHLUSS-PFLICHTBLOCK-STILL): kein Folgespiel, aber Platz 3 auszuspielen
    // → die Turnierleitung entscheidet; „Besetzung prüfen“ bleibt stehen, nichts geht still nach openRanks.
    const ohneFolgespiel = { ...lage060([1, 2, 3], false), groupCompletions: [completion('A', [id('N'), id('S'), id('W'), id('O')], { stale: true })] };
    expect(prepareRecompletion(ohneFolgespiel, 'A')).toMatchObject({ code: 'DECISION_REQUIRED', blocks: [{ mandatory: { kind: 'setting', place: 3 } }] });
    const mitFolgespiel = { ...lage060([1, 2], true), groupCompletions: [completion('A', [id('N'), id('S'), id('W'), id('O')], { stale: true })] };
    expect(prepareRecompletion(mitFolgespiel, 'A')).toMatchObject({ code: 'READY', openRanks: [3, 4] });
  });

  it('@TM-145 ein danach wieder offenes Gruppenspiel hält auch den erneuten Abschluss auf', async () => {
    const t = await abgeschlossen();
    const offen = withMatch(t, matchOf(t, HC.sued, HC.west).id, { matchStatus: 'running' });
    const stale = { ...offen, groupCompletions: [completion('A', [HC.nord, HC.west, HC.sued, HC.ost], { stale: true })] };
    expect(prepareRecompletion(stale, 'A')).toEqual({ code: 'OPEN_MATCHES', open: 1 });
  });
});
