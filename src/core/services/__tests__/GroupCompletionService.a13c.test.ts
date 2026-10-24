/**
 * GA4 A-13c: Regeln, die die Oberfläche braucht – aus dem Gherkin abgeleitet.
 * - @TM-149 Rangfolge beim Abschluss ohne entfernte Teams (Befund C-RANKING-ENTFERNTE-TEAMS, Nikolaus echt erzeugt).
 * - @TM-150 Neu-Abschluss einer korrigierten Gruppe legt einen auszuspielenden Platz ohne Folgespiel nie still fest
 *   (Befund C-NEUABSCHLUSS-PFLICHTBLOCK-STILL, Bezug @TM-145).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import { activeRanking, groupState, prepareGroupCompletion, prepareRecompletion } from '../GroupCompletionService';
import { completion, NK, tournamentFromFixture } from '../../standings/__tests__/groupCompletionKit';
import { MemoryRepo } from '../../standings/__tests__/decisionTestKit';
import { id, league } from '../../standings/__tests__/fixtures';

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
    expect(prepareRecompletion(t, '', 'auto').code).toBe(code);
  });

  it('Zeile 1: der Block ist genau der Pflicht-Block (Platz 3, Einstellung); „Besetzung prüfen“ bleibt, solange nicht entschieden ist', () => {
    const t = veraltet(nikolaus([1, 2, 3]));
    const result = prepareRecompletion(t, '', 'auto');
    expect(result).toEqual({
      code: 'DECISION_REQUIRED',
      blocks: [expect.objectContaining({ teamIds: [NK.petting, NK.otting], place: 3, size: 2, mayShare: false, mandatory: { kind: 'setting', place: 3 } })],
    });
  });

  it('Zeile 2 (Gegenbeispiel): kein Gleichstand auf einem auszuspielenden Platz → neu abgeschlossen, keine offenen Plätze', () => {
    const t = veraltet(nikolaus([1]));
    expect(prepareRecompletion(t, '', 'auto')).toMatchObject({ code: 'READY', openRanks: [] });
  });

  it('nach Ollis Entscheidung (Strafstoßschießen 4:3) ist der Block entschieden → bereit, die Entscheidung geht mit', async () => {
    const t = veraltet(nikolaus([1, 2, 3]));
    const repo = new MemoryRepo(t);
    const decided = await repo.service(['e-1']).decide(t.id, { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.otting, NK.petting], kind: 'shootout', shootout: { winner: 4, loser: 3 } });
    expect(decided.ok).toBe(true);
    const result = prepareRecompletion(repo.tournament, '', 'auto');
    expect(result).toMatchObject({ code: 'READY', openRanks: [] });
    expect(result.code === 'READY' && result.tieDecisions.map((d) => d.id)).toEqual(['e-1']);
    expect(result.code === 'READY' && result.ranking.slice(2, 4)).toEqual([NK.otting, NK.petting]);
  });
});

/**
 * @TM-150 wörtlich (Review #336 A4): Nikolaus-Art (eine Gruppe „Jeder gegen jeden“, Platz 1 als auszuspielender Platz eingestellt, kein Spiel
 * mit der Herkunft „Erster der Gruppe“), Gleichstand bzw. Alleinstellung auf PLATZ 1. Vier Teams genügen für die Regel.
 */
describe('@TM-150 wörtlich: Platz 1 ausgespielt, kein Folgespiel', () => {
  const lage = (wOst: string): Tournament => {
    const { tournament } = league('WONB', `W–O ${wOst}; W–N 2:0; W–B 1:0; O–N 2:0; O–B 1:0; N–B 1:0`, { group: undefined });
    return { ...tournament, placementsToPlayOut: [1], groupCompletions: [completion('', [id('W'), id('O'), id('N'), id('B')], { stale: true })] };
  };

  it('Zeile 1: SC Ost und TSV West nach allen Kriterien gleich auf Platz 1 → Entscheidung nötig, „Besetzung prüfen“ bleibt, die Gruppe ist nicht neu abgeschlossen', () => {
    const t = lage('1:1');
    const result = prepareRecompletion(t, '', 'auto');
    expect(result).toEqual({ code: 'DECISION_REQUIRED', blocks: [expect.objectContaining({ teamIds: expect.arrayContaining([id('W'), id('O')]), place: 1, size: 2, mayShare: false, mandatory: { kind: 'setting', place: 1 } })] });
    expect(groupState(t, '')).toBe('stale'); // nichts abgeschlossen, solange keine Entscheidung vorliegt
  });

  it('Zeile 1: nach Ollis Entscheidung zwischen beiden ist die Gruppe neu abschließbar (bereit, ohne offene Plätze)', async () => {
    const repo = new MemoryRepo({ ...lage('1:1'), version: 1 });
    const gewinner = id('O');
    const entschieden = await repo.service(['e-1']).decide(repo.tournament.id, { groupId: '', teamIds: [id('W'), id('O')], order: [gewinner, id('W')], kind: 'shootout', shootout: { winner: 4, loser: 3 } });
    expect(entschieden.ok).toBe(true);
    expect(prepareRecompletion(repo.tournament, '', 'auto')).toMatchObject({ code: 'READY', openRanks: [] });
  });

  it('Zeile 2: SC Ost allein auf Platz 1 → neu abschließbar ohne offene Plätze (READY)', () => {
    expect(prepareRecompletion(lage('0:1'), '', 'auto')).toMatchObject({ code: 'READY', openRanks: [] });
  });
  // Der Teil „ohne dass ‚Besetzung prüfen‘ erscheint“ braucht den Auslöser nach der Korrektur und steht im A-15b-Brief (kein Test hier).
});
