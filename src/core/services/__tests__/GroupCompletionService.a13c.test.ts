/**
 * GA4 A-13c: Regeln, die die Oberfläche braucht – aus dem Gherkin abgeleitet.
 * - @TM-149 Rangfolge beim Abschluss ohne entfernte Teams (Befund C-RANKING-ENTFERNTE-TEAMS, Nikolaus echt erzeugt).
 * - @TM-150 Neu-Abschluss einer korrigierten Gruppe legt einen auszuspielenden Platz ohne Folgespiel nie still fest
 *   (Befund C-NEUABSCHLUSS-PFLICHTBLOCK-STILL, Bezug @TM-145).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { activeRanking, prepareGroupCompletion, prepareRecompletion } from '../GroupCompletionService';
import { completion, NK, tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';
import { MemoryRepo } from '../../standings/__tests__/decisionTestKit';

const nikolaus = (places?: number[]): Tournament => ({ ...tournamentFromFixture('nikolaus'), ...(places !== undefined ? { placementsToPlayOut: places } : {}), version: 1 });

const ohneTeam = (t: Tournament, teamId: string): Tournament => ({
  ...t, teams: t.teams.map((team) => (team.id === teamId ? { ...team, isRemoved: true } : team)),
});

const ALLE = [NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau];

describe('@TM-149 Beim Abschluss einer Gruppe zählt die Rangfolge ohne entfernte Teams', () => {
  it('TSV Petting entfernt: die übrigen 5 Teams stehen auf Platz 1 bis 5, Petting steht nicht darin', () => {
    const t = ohneTeam(nikolaus([1, 2]), NK.petting);
    const result = prepareGroupCompletion(t, '');
    // Gleichstand Petting/Otting um Platz 3 und 4 ist mit dem entfernten Team kein Paar mehr
    expect(result).toMatchObject({ code: 'READY', openRanks: [] });
    expect(result.code === 'READY' && result.ranking).toEqual([NK.kammer, NK.wagingRot, NK.otting, NK.fridolfing, NK.wagingBlau]);
    expect(result.code === 'READY' && result.ranking).not.toContain(NK.petting);
    expect(activeRanking(t, '')).toHaveLength(5);
  });

  it('Gegenbeispiel: ohne entferntes Team bleibt es bei 6 Teams und dem Gleichstand', () => {
    const t = nikolaus([1, 2]);
    expect(activeRanking(t, '')).toEqual(expect.arrayContaining(ALLE));
    expect(activeRanking(t, '')).toHaveLength(6);
    expect(prepareGroupCompletion(t, '').code).toBe('DECISION_REQUIRED');
  });

  it('ein Block aus entferntem und einem weiteren Team ist kein Gleichstand mehr; bei drei bleibt ein Paar mit neuem Platz', () => {
    // Platz 1 bis 3 auszuspielen: Petting/Otting (Platz 3) wäre Pflicht – ohne Petting entfällt der Block
    const ohnePetting = ohneTeam(nikolaus([1, 2, 3]), NK.petting);
    expect(prepareGroupCompletion(ohnePetting, '').code).toBe('READY');
    // Gegenbeispiel: ohne Entfernen ist es Pflicht
    expect(prepareGroupCompletion(nikolaus([1, 2, 3]), '').code).toBe('DECISION_REQUIRED');
  });
});

/** Gruppe '' abgeschlossen und nach einer Korrektur veraltet (`stale`): Platz 3 und 4 sind wieder gleich. */
const veraltet = (t: Tournament): Tournament => ({ ...t, groupCompletions: [completion('', ALLE, { stale: true })] });

describe('@TM-150 Der Neu-Abschluss legt einen auszuspielenden Platz ohne Folgespiel nie still fest', () => {
  it.each([
    { zeile: 'Gleichstand auf einem auszuspielenden Platz, kein Folgespiel', plaetze: [1, 2, 3], code: 'DECISION_REQUIRED' },
    { zeile: 'Gleichstand auf einem Platz, der nicht auszuspielen ist', plaetze: [1, 2], code: 'READY' },
  ])('$zeile → $code', ({ plaetze, code }) => {
    const t = veraltet(nikolaus(plaetze));
    expect(prepareRecompletion(t, '').code).toBe(code);
  });

  it('Zeile 1: der Block ist genau der Pflicht-Block (Platz 3, Einstellung); „Besetzung prüfen“ bleibt, solange nicht entschieden ist', () => {
    const t = veraltet(nikolaus([1, 2, 3]));
    const result = prepareRecompletion(t, '');
    expect(result).toEqual({
      code: 'DECISION_REQUIRED',
      blocks: [expect.objectContaining({ teamIds: [NK.petting, NK.otting], place: 3, size: 2, mayShare: false, mandatory: { kind: 'setting', place: 3 } })],
    });
  });

  it('Zeile 2 (Gegenbeispiel): kein Gleichstand auf einem auszuspielenden Platz → neu abgeschlossen, keine offenen Plätze', () => {
    const t = veraltet(nikolaus([1]));
    expect(prepareRecompletion(t, '')).toMatchObject({ code: 'READY', openRanks: [] });
  });

  it('nach Ollis Entscheidung (Strafstoßschießen 4:3) ist der Block entschieden → bereit, die Entscheidung geht mit', async () => {
    const t = veraltet(nikolaus([1, 2, 3]));
    const repo = new MemoryRepo(t);
    const decided = await repo.service(['e-1']).decide(t.id, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.otting, NK.petting], kind: 'shootout', shootout: { winner: 4, loser: 3 } });
    expect(decided.ok).toBe(true);
    const result = prepareRecompletion(repo.tournament, '');
    expect(result).toMatchObject({ code: 'READY', openRanks: [] });
    expect(result.code === 'READY' && result.tieDecisions.map((d) => d.id)).toEqual(['e-1']);
    expect(result.code === 'READY' && result.ranking.slice(2, 4)).toEqual([NK.otting, NK.petting]);
  });
});
