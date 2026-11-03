/**
 * Wächter der Handzettel-Fixtures (PDF-Paket V1): Die Fälle a, b, c und b-lang kommen über den echten Lesepfad so im Plan
 * an, wie das Mockup sie zeigt (Spielnummern, Uhrzeiten, Paarungen, Herkunft, Schiedsrichter, Zustände). Prüft die
 * Testdaten, nicht das PDF.
 */
import { describe, expect, it } from 'vitest';
import { roundEndTime } from '../model/endTime';
import { FALL_A, FALL_B, FALL_B_LANG, FALL_C, fallBLang, mitRegelnDR019, mitStandA } from './fixtures/handzettelFaelle';
import { fallMatches, fallMatchId, fallSchedule, fallTournament } from './fixtures/handzettelTurnier';

const clock = (d: Date): string => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

describe('Handzettel-Fixtures (Mockup-Runde 2)', () => {
  it('a: 15 Spiele jeder gegen jeden, 16:30 bis 18:50, Spiel 1 DJK Kammer – TSV 1921 Fridolfing, Ende ca. 19:00', () => {
    const plan = fallSchedule(FALL_A);
    const spiele = plan.allMatches;

    expect(spiele.map(m => m.matchNumber)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1));
    expect(clock(spiele[0].startTime)).toBe('16:30');
    expect(clock(spiele[14].startTime)).toBe('18:50');
    expect([spiele[0].homeTeam, spiele[0].awayTeam]).toEqual(['DJK Kammer', 'TSV 1921 Fridolfing']);
    expect(spiele.some(m => m.referee !== undefined)).toBe(false);
    expect(roundEndTime(clock(plan.endTime))).toBe(FALL_A.mockup.endeCa);
  });

  it('c: lange Namen, Schiedsrichter 1–3 mit eingetragenen Namen, gleiche Paarungen wie a', () => {
    const plan = fallSchedule(FALL_C);

    expect(plan.allMatches.map(m => m.referee)).toEqual(Array.from({ length: 15 }, (_, i) => (i % 3) + 1));
    expect(fallTournament(FALL_C).refereeConfig?.refereeNames?.[1]).toBe('Paul Schmidt');
    expect(plan.allMatches[0].homeTeam).toBe('TSV 1860 Rosenheim-Westerndorf');
  });

  it('b: 20 Gruppenspiele 10:00–13:48 in Gruppe A/B, Finalrunde 21–28 ab 14:08 mit Herkunft über die Spielnummer', () => {
    const plan = fallSchedule(FALL_B);
    const gruppe = plan.allMatches.filter(m => m.phase === 'groupStage');
    const finale = plan.allMatches.filter(m => m.phase !== 'groupStage');

    expect(gruppe).toHaveLength(20);
    expect(clock(gruppe[19].startTime)).toBe('13:48');
    expect(gruppe.map(m => m.group)).toEqual(FALL_B.spiele.map(s => s.gruppe));
    expect(finale.map(m => m.matchNumber)).toEqual([21, 22, 23, 24, 25, 26, 27, 28]);
    expect(finale.map(m => clock(m.startTime))).toEqual(FALL_B.finale!.map(f => f.zeit));
    const halbfinale1 = finale.find(m => m.matchNumber === 25)!;
    expect(halbfinale1.slotA).toEqual({ kind: 'pending', source: { kind: 'matchResult', matchId: fallMatchId(FALL_B, 22), role: 'winner' } });
    expect(finale.find(m => m.matchNumber === 21)!.slotA).toEqual({ kind: 'pending', source: { kind: 'groupRank', group: 'A', rank: 1 } });
    expect(finale.find(m => m.matchNumber === 27)!.finalType).toBe('thirdPlace');
  });

  it('b: Ende nach Plan 15:42, nach @DR-031 gerundet 15:40 (das Mockup zeigte „ca. 15:45“, offene Frage im V1-Bericht)', () => {
    const plan = fallSchedule(FALL_B);

    expect(clock(plan.endTime)).toBe('15:42');
    expect(roundEndTime(clock(plan.endTime))).toBe('15:40');
  });

  it('b-lang: ein bzw. zwei lange Namen in je 4 Spielen, Kurzname nur auf Wunsch', () => {
    const lang = 'SG Grabenstätt/Chieming/Übersee';
    expect(FALL_B_LANG.spiele.filter(s => s.heim === lang || s.gast === lang)).toHaveLength(4);
    expect(fallBLang(2).spiele.filter(s => [s.heim, s.gast].some(n => n.length > 30))).toHaveLength(8);
    expect(FALL_B_LANG.teams.find(t => t.name === lang)?.kurzname).toBeUndefined();
    expect(fallBLang(1, true).teams.find(t => t.name === lang)?.kurzname).toBe('SG Grabenstätt');
    expect(fallSchedule(FALL_B_LANG).allMatches.filter(m => m.homeTeam === lang || m.awayTeam === lang)).toHaveLength(4);
  });

  it('Stand a (@DR-019): beendet, ausgefallen, läuft bzw. Halbzeit stehen an den Spielen des Turniers', () => {
    const status = (fall: typeof FALL_A, nr: number) => fallMatches(fall).find(m => m.matchNumber === nr)?.matchStatus;

    expect(status(mitStandA(), 1)).toBe('finished');
    expect(fallSchedule(mitStandA()).allMatches[0]).toMatchObject({ scoreA: 2, scoreB: 1 });
    expect(status(mitStandA(), 6)).toBe('skipped');
    expect(status(mitStandA(), 7)).toBe('running');
    expect(status(mitStandA(FALL_A, true), 7)).toBe('paused');
    expect(status(mitStandA(), 8)).toBe('scheduled');
  });

  it('Regeln je Runde (@DR-019): b mit Golden Goal im Spiel um Platz 3 und Verlängerung im Finale', () => {
    const config = fallTournament(mitRegelnDR019()).finalsConfig;

    expect(config?.tiebreakerByRound).toMatchObject({ semifinal: 'shootout', final: 'overtime-then-shootout', placement: 'goldenGoal' });
    expect(fallTournament(FALL_B).finalsConfig?.tiebreakerByRound?.final).toBe('shootout');
  });
});
