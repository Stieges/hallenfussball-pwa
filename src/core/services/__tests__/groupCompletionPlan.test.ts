/**
 * GA4 A-13c: Plan des Abschlusses (reine Logik hinter Banner und Dialog). Aus dem Gherkin abgeleitet:
 * @TM-016 @TM-047 (Plätze nach dem Abschluss, jede Gruppe für sich), @TM-043 @TM-048 @TM-049 (Gleichstand, ohne Eingabe bleibt die
 * Gruppe offen), @TM-054 (nicht vorzeitig), @TM-057 (Jeder gegen jeden), @TM-060 (Angebot je Zeile), @W2A-048 @W2A-058 (schon
 * entschieden: nicht erneut fragen), @W2A-063 (Annahme ohne Grund), @TM-145 (offene Plätze), @TM-149 (ohne entfernte Teams).
 * Hallencup Nord und Nikolaus echt erzeugt (`group-state.json`).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { completionEffect, draftToDecision, planCompletion } from '../groupCompletionPlan';
import { completion, HC, matchLabelled, matchOf, NK, tournamentFromFixture, withMatch } from '../../standings/__tests__/groupCompletionKit';
import { MemoryRepo } from '../../standings/__tests__/decisionTestKit';
import type { DecisionDraft } from '../../standings/decisions';

const hallencup = (): Tournament => tournamentFromFixture('hallencup');
const nikolaus = (places?: number[]): Tournament => ({ ...tournamentFromFixture('nikolaus'), ...(places !== undefined ? { placementsToPlayOut: places } : {}), version: 1 });

const westGewinnt: DecisionDraft = { groupId: 'A', teamIds: [HC.west, HC.sued], order: [HC.west, HC.sued], kind: 'shootout', shootout: { winner: 4, loser: 3 } };

describe('@TM-054 @TM-049 Plan: ablehnen, solange nicht alles entschieden ist, und ohne Entscheidung nicht bereit', () => {
  it('@TM-054 5 von 6 entschieden: OPEN_MATCHES mit der Zahl, keine Anfrage', () => {
    const t = hallencup();
    const lauf = matchOf(t, HC.sued, HC.west);
    const plan = planCompletion(withMatch(t, lauf.id, { matchStatus: 'running' }), 'A');
    expect(plan).toEqual({ code: 'OPEN_MATCHES', open: 1 });
  });

  it('@TM-049 Gleichstand ohne Eingabe: DECISION_REQUIRED, keine Anfrage', () => {
    const plan = planCompletion(hallencup(), 'A');
    expect(plan.code).toBe('DECISION_REQUIRED');
    expect('request' in plan).toBe(false);
  });

  it('Gegenbeispiel: unbekannte Gruppe → UNKNOWN_GROUP', () => {
    expect(planCompletion(hallencup(), 'Z')).toEqual({ code: 'UNKNOWN_GROUP' });
  });
});

describe('@TM-048 @W2A-048 Plan mit neuer Entscheidung: 4:3 für West → Rangfolge, Kopie der Entscheidung, Stand', () => {
  it('Rangfolge Nord, West, Süd, Ost; die neue Entscheidung geht mit; bekannte Kennungen leer; Stand der Gruppe A', () => {
    const t = hallencup();
    const decision = draftToDecision(t, westGewinnt, 'neu-1');
    const plan = planCompletion(t, 'A', [decision]);
    expect(plan.code).toBe('READY');
    if (plan.code !== 'READY') {
      return;
    }
    expect(plan.request).toMatchObject({
      groupId: 'A',
      ranking: [HC.nord, HC.west, HC.sued, HC.ost],
      openRanks: [],
      knownDecisionIds: [],
    });
    expect(plan.request.tieDecisions).toEqual([decision]);
    expect(plan.request.expectedState).toHaveLength(6);
    expect(plan.again).toBe(false);
  });

  it('das Turnier selbst bleibt unverändert (nichts gespeichert, @TM-049): die Entscheidung steht nur in der Vorschau', () => {
    const t = hallencup();
    const plan = planCompletion(t, 'A', [draftToDecision(t, westGewinnt, 'neu-1')]);
    expect(t.standingDecisions ?? []).toEqual([]);
    expect(plan.code === 'READY' && plan.preview.standingDecisions?.map((d) => d.id)).toEqual(['neu-1']);
  });

  it('@W2A-058 Entscheidung schon in der Tabelle: der Plan verlangt sie nicht erneut, sie geht als bekannte Kopie mit', async () => {
    const repo = new MemoryRepo({ ...hallencup(), version: 1 });
    expect((await repo.service(['alt-1']).decide(repo.tournament.id, westGewinnt)).ok).toBe(true);
    const plan = planCompletion(repo.tournament, 'A');
    expect(plan.code).toBe('READY');
    expect(plan.code === 'READY' && plan.request.tieDecisions.map((d) => d.id)).toEqual(['alt-1']);
    expect(plan.code === 'READY' && plan.request.knownDecisionIds).toEqual(['alt-1']);
  });

  it('Gegenbeispiel @W2A-058: eine Entscheidung einer anderen Gruppe zählt nicht als bekannte Kennung von Gruppe A', async () => {
    const repo = new MemoryRepo({ ...hallencup(), version: 1 });
    expect((await repo.service(['alt-1']).decide(repo.tournament.id, westGewinnt)).ok).toBe(true);
    const plan = planCompletion({ ...repo.tournament, standingDecisions: repo.tournament.standingDecisions?.map((d) => ({ ...d, groupId: 'B' })) }, 'A');
    expect(plan.code).toBe('DECISION_REQUIRED');
  });
});

describe('Grund nur bei einer Reihenfolge (@W2A-064, @W2A-072)', () => {
  it('Reihenfolge: der Grund geht (gekürzt) mit; Strafstoßschießen und Annahme: nie ein Grund', () => {
    const t = nikolaus([1, 2]);
    const order = draftToDecision(t, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.otting, NK.petting], kind: 'order', reason: '  Strafstoßschießen in der Halle  ' }, 'o-1');
    expect(order.reason).toBe('Strafstoßschießen in der Halle');
    const shared = draftToDecision(t, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared', reason: 'egal' }, 's-1');
    expect(shared).not.toHaveProperty('reason');
    const shootout = draftToDecision(t, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.otting, NK.petting], kind: 'shootout', shootout: { winner: 4, loser: 3 }, reason: 'egal' }, 'p-1');
    expect(shootout).not.toHaveProperty('reason');
  });

  it('der Grund steht in der Anfrage, nie im Turnier-Entwurf der Vorschau (@W2A-072)', () => {
    const t = nikolaus([1, 2, 3]);
    const order = draftToDecision(t, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.otting, NK.petting], kind: 'order', reason: 'Grund' }, 'o-1');
    const plan = planCompletion(t, '', [order]);
    expect(plan.code === 'READY' && plan.request.tieDecisions[0]).toMatchObject({ id: 'o-1', reason: 'Grund' });
    expect(plan.code === 'READY' && JSON.stringify(plan.preview.standingDecisions)).not.toContain('Grund');
  });
});

describe('@TM-057 @W2A-063 Jeder gegen jeden: Gruppe \'\', Annahme ohne Grund', () => {
  it('Platz 1 und 2 auszuspielen: „Ergebnis so akzeptieren“ → bereit, Gruppe \'\' (nicht \'all\'), beide auf Platz 3', () => {
    const t = nikolaus([1, 2]);
    const shared = draftToDecision(t, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' }, 's-1');
    const plan = planCompletion(t, '', [shared]);
    expect(plan.code).toBe('READY');
    expect(plan.code === 'READY' && plan.request.groupId).toBe('');
    expect(plan.code === 'READY' && plan.request.ranking).toEqual([NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau]);
    expect(plan.code === 'READY' && plan.request.expectedState).toHaveLength(15);
  });
});

describe('@TM-149 Plan ohne entfernte Teams', () => {
  it('TSV Petting entfernt: die Anfrage enthält die übrigen 5 Teams', () => {
    const t = nikolaus([1, 2]);
    const plan = planCompletion({ ...t, teams: t.teams.map((team) => (team.id === NK.petting ? { ...team, isRemoved: true } : team)) }, '');
    expect(plan.code === 'READY' && plan.request.ranking).toEqual([NK.kammer, NK.wagingRot, NK.otting, NK.fridolfing, NK.wagingBlau]);
  });
});

describe('@TM-016 @TM-047 Wirkung: welche Seiten der Finalrunde der Abschluss besetzt', () => {
  it('Gruppe A abgeschlossen: Halbfinale 1 Heim = Nord, Halbfinale 2 Gast = Süd; Gruppe B bleibt außen vor', () => {
    const t = hallencup();
    const effect = completionEffect(t, 'A', [HC.nord, HC.sued, HC.west, HC.ost]);
    const hf1 = matchLabelled(t, '1. Halbfinale');
    const hf2 = matchLabelled(t, '2. Halbfinale');
    expect(effect).toEqual([
      { matchId: hf1.id, label: '1. Halbfinale', side: 'A', rank: 1, teamId: HC.nord },
      { matchId: hf2.id, label: '2. Halbfinale', side: 'B', rank: 2, teamId: HC.sued },
    ]);
  });

  it('Gleichstand entschieden (West vor Süd): Halbfinale 2 Gast = West', () => {
    const t = hallencup();
    const effect = completionEffect(t, 'A', [HC.nord, HC.west, HC.sued, HC.ost]);
    expect(effect.find((e) => e.label === '2. Halbfinale')).toMatchObject({ side: 'B', teamId: HC.west });
  });

  it('@TM-145 offene Plätze (nach Korrektur) bleiben offen und werden nicht genannt', () => {
    const effect = completionEffect(hallencup(), 'A', [HC.nord, HC.sued, HC.west, HC.ost], [2]);
    expect(effect.map((e) => e.rank)).toEqual([1]);
  });

  it('@TM-057 Jeder gegen jeden hat keine Finalrunde: keine Wirkung', () => {
    expect(completionEffect(nikolaus(), '', [NK.kammer])).toEqual([]);
  });

  it('wieder geöffnete Gruppe: „Erneut abschließen“ (again), nie abgeschlossene Gruppe: nicht', () => {
    const t = hallencup();
    const decision = draftToDecision(t, westGewinnt, 'neu-1');
    const wiederOffen: Tournament = { ...t, groupCompletions: [completion('A', [HC.nord, HC.sued, HC.west, HC.ost], { reopenedAt: '2026-11-28T12:00:00Z' })] };
    const wieder = planCompletion(wiederOffen, 'A', [decision]);
    const erst = planCompletion(t, 'A', [decision]);
    expect(wieder.code === 'READY' && wieder.again).toBe(true);
    expect(erst.code === 'READY' && erst.again).toBe(false);
  });
});
