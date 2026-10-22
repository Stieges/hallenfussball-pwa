/**
 * A-19a Endstand „Jeder gegen jeden“, vorläufig, genau ein Platz (Plan `plan-endstand-abschluss.md` § 3).
 * Record `2026-10-01_endstand-und-torschuetzen`: @ET-022, @ET-020, @ET-029, @ET-057, @ET-026/@ET-027 (Endstand-Teil),
 * @ET-055/@ET-056 (Endstand-Teil), @ET-031 Zeile 4, @ET-042 (Rechnung), @ET-058 (entferntes Team, Daniel F5);
 * Record `2026-10-01_turniermodi`: @TM-058. Aus dem Gherkin abgeleitet, nicht am Code abgelesen.
 * Nikolaus (Pflichttest) ist ECHT ERZEUGT: Generator → publish → Mapper (`group-state.json`, `groupCompletionKit`).
 */
import { describe, expect, it } from 'vitest';
import type { Tournament } from '../../../../types/tournament';
import { computeFinalStandings } from '..';
import { prepareGroupCompletion } from '../../../services/GroupCompletionService';
import { completion, matchOf, NK, tournamentFromFixture, withMatch } from '../../__tests__/groupCompletionKit';
import { jgj, shared, shootout } from '../../__tests__/decisionTestKit';
import { DATA, GD_FIRST_ORDER } from '../../__tests__/fixtures';
import { completeGroup, decide, placed } from './finalStandingsKit';

const nikolaus = (places?: number[]): Tournament => ({
  ...tournamentFromFixture('nikolaus'), ...(places !== undefined ? { placementsToPlayOut: places } : {}), version: 1,
});
/** N6d: Strafstoßschießen 4:3 für DJK Otting gegen TSV Petting. */
const ottingGewinnt = { groupId: '', teamIds: [NK.otting, NK.petting], order: [NK.otting, NK.petting], kind: 'shootout' as const, shootout: { winner: 4, loser: 3 } };

/** @ET-022: 1. SG Mitte, 2. FC Nord, 3. VfB Ufer, 4. SV Süd, 5. TSV West, 6. SC Ost (alle Spiele 1:0, keine Gleichstände). */
const DATEN_022 = 'M–N 1:0; M–U 1:0; M–S 1:0; M–W 1:0; M–O 1:0; N–U 1:0; N–S 1:0; N–W 1:0; N–O 1:0; U–S 1:0; U–W 1:0; U–O 1:0; S–W 1:0; S–O 1:0; W–O 1:0';
/** @ET-029: Mitte allein auf 1, Nord und Ufer gleich auf 2 und 3 (Abschnitt 6, gegengerechnet). */
const DATEN_029 = 'M–N 1:0; M–U 1:0; M–W 1:0; M–O 1:0; M–B 1:0; N–U 1:1; N–W 1:0; N–O 1:0; N–B 1:0; U–W 1:0; U–O 1:0; U–B 1:0; W–O 1:0; W–B 1:0; O–B 1:0';
/** @ET-026/@ET-027/@ET-057: SG Mitte und FC Nord gleich auf 1 und 2, direktes Spiel 2:2. */
const DATEN_PLATZ_1 = 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0';

describe('A-19a Pflichttest Nikolaus (eine Gruppe, 6 Teams, echt erzeugt)', () => {
  it('@ET-022 @ET-055 Gruppe abgeschlossen (Strafstoßschießen 4:3 für Otting) → Endstand fest, Plätze 1 bis 6 wie N7c', async () => {
    const t = nikolaus();
    expect(t.matches).toHaveLength(15);
    const abgeschlossen = completeGroup(await decide(t, ottingGewinnt));
    const result = computeFinalStandings(abgeschlossen);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking)).toEqual([
      ['DJK Kammer', 1], ['TSV Waging rot', 2], ['DJK Otting', 3], ['TSV Petting', 4], ['TSV 1921 Fridolfing', 5], ['TSV Waging blau', 6],
    ]);
    expect(result.ranking.map((row) => row.origin)).toEqual([1, 2, 3, 4, 5, 6].map((place) => ({ kind: 'groupPlace', group: '', place })));
  });

  it('@ET-031 Jeder gegen jeden: jedes der 6 Teams steht genau einmal im Endstand, kein Team fehlt', async () => {
    const t = completeGroup(await decide(nikolaus(), ottingGewinnt));
    const ids = computeFinalStandings(t).ranking.map((row) => row.teamId as string);
    expect([...ids].sort()).toEqual(t.teams.map((team) => team.id).sort());
  });

  it('@TM-058 14 von 15 entschieden, Tom pfeift das letzte Spiel ab (15/15): ohne Gruppenabschluss steht der Endstand noch nicht fest', async () => {
    const t = nikolaus();
    const letztes = matchOf(t, NK.fridolfing, NK.wagingBlau);
    const vierzehn = withMatch(t, letztes.id, { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined });
    expect(vierzehn.matches.filter((m) => m.matchStatus === 'finished')).toHaveLength(14); // Vorbedingung
    expect(computeFinalStandings(vierzehn).state).toBe('provisional');
    // Abpfiff des letzten Spiels mit dem echten Stand; der Gleichstand Petting/Otting ist entschieden, nur der Abschluss fehlt.
    const fuenfzehn = await decide(withMatch(vierzehn, letztes.id, { matchStatus: 'finished', scoreA: letztes.scoreA, scoreB: letztes.scoreB }), ottingGewinnt);
    expect(fuenfzehn.matches.every((m) => m.matchStatus === 'finished')).toBe(true);
    expect(prepareGroupCompletion(fuenfzehn, '').code).toBe('READY');
    expect(fuenfzehn.groupCompletions ?? []).toEqual([]);
    expect(computeFinalStandings(fuenfzehn).state).toBe('provisional');
    // Gegenprobe: erst mit „Gruppe abschließen“ steht er fest.
    expect(computeFinalStandings(completeGroup(fuenfzehn)).state).toBe('complete');
  });

  it('@ET-031 Gegenbeispiel: ein Abschluss, in dem ein Team fehlt oder ein fremdes Team steht, macht den Endstand nicht fest (kein Team fehlt)', async () => {
    const t = await decide(nikolaus(), ottingGewinnt);
    const ohneFridolfing = [NK.kammer, NK.wagingRot, NK.otting, NK.petting, NK.wagingBlau];
    expect(computeFinalStandings({ ...t, groupCompletions: [completion('', ohneFridolfing)] }).state).toBe('provisional');
    const fremd = [...ohneFridolfing.slice(0, 4), '00000000-0000-4000-8000-000000000999', NK.wagingBlau];
    expect(computeFinalStandings({ ...t, groupCompletions: [completion('', fremd)] }).state).toBe('provisional');
  });

  it('Gegenbeispiel: Abschluss nicht als veraltet gemeldet, aber ein Gruppenspiel ist wieder offen → nicht fest', async () => {
    const t = completeGroup(await decide(nikolaus(), ottingGewinnt));
    const spiel = matchOf(t, NK.kammer, NK.fridolfing);
    const wiederOffen = withMatch(t, spiel.id, { matchStatus: 'scheduled', scoreA: undefined, scoreB: undefined });
    expect(wiederOffen.groupCompletions?.[0]).toMatchObject({ stale: false });
    expect(computeFinalStandings(wiederOffen).state).toBe('provisional');
  });

  it('Gegenbeispiel: ein Abschluss mit offenen Plätzen (Herkunft zurückgegeben, @TM-145) ist nicht fest', async () => {
    // Bei Jeder gegen jeden ohne Folgespiel setzt die App keine offenen Plätze (prepareRecompletion); die Zeile kommt aber vom
    // Server (`group_completions.open_ranks`) und wird nie als fester Endstand gelesen.
    const t = completeGroup(await decide(nikolaus(), ottingGewinnt));
    const mitOffenenPlaetzen: Tournament = { ...t, groupCompletions: (t.groupCompletions ?? []).map((c) => ({ ...c, openRanks: [3] })) };
    expect(computeFinalStandings(mitOffenenPlaetzen).state).toBe('provisional');
  });

  it('@ET-042 alle Spiele entschieden, Gruppe noch nicht abgeschlossen → vorläufig, so wie die Tabelle gerade steht', async () => {
    const t = await decide(nikolaus(), ottingGewinnt);
    const result = computeFinalStandings(t);
    expect(result.state).toBe('provisional');
    expect(placed(result.ranking).map(([name]) => name)).toEqual(['DJK Kammer', 'TSV Waging rot', 'DJK Otting', 'TSV Petting', 'TSV 1921 Fridolfing', 'TSV Waging blau']);
  });

  it('Gegenbeispiel: ein offener Gleichstand ohne Entscheidung wird nie still geteilt – auch ein Abschluss-Eintrag macht ihn nicht fest', () => {
    const t = nikolaus([1, 2]);
    expect(prepareGroupCompletion(t, '').code).toBe('DECISION_REQUIRED');
    expect(computeFinalStandings(t).state).toBe('provisional');
    const mitAbschluss: Tournament = { ...t, groupCompletions: [completion('', [NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau])] };
    expect(computeFinalStandings(mitAbschluss).state).toBe('provisional');
  });

  it('@W2A-063 Nikolaus, nur Platz 1 und 2: nach „Ergebnis so akzeptieren“ teilen Petting und Otting Platz 3, danach 5 und 6', async () => {
    const t = completeGroup(await decide(nikolaus([1, 2]), { groupId: '', teamIds: [NK.petting, NK.otting], order: [NK.petting, NK.otting], kind: 'shared' }));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(result.ranking.map((row) => row.place)).toEqual([1, 2, 3, 3, 5, 6]);
  });

  it('Gegenbeispiel: nach einer Korrektur (Abschluss „Besetzung prüfen“) ist der Endstand wieder vorläufig', async () => {
    const t = completeGroup(await decide(nikolaus(), ottingGewinnt));
    const korrigiert: Tournament = { ...t, groupCompletions: (t.groupCompletions ?? []).map((c) => ({ ...c, stale: true })) };
    expect(computeFinalStandings(korrigiert).state).toBe('provisional');
    const wiederOffen: Tournament = { ...t, groupCompletions: (t.groupCompletions ?? []).map((c) => ({ ...c, reopenedAt: '2026-11-28T12:00:00Z' })) };
    expect(computeFinalStandings(wiederOffen).state).toBe('provisional');
  });
});

describe('A-19a @ET-022 der Endstand ist die abgeschlossene Tabelle', () => {
  it('@ET-022 Gruppe mit 1. SG Mitte, 2. FC Nord, 3. VfB Ufer, 4. SV Süd, 5. TSV West, 6. SC Ost abgeschlossen → genau diese Reihenfolge auf 1 bis 6', () => {
    const t = completeGroup(jgj('NSWOMU', DATEN_022));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking)).toEqual([['SG Mitte', 1], ['FC Nord', 2], ['VfB Ufer', 3], ['SV Süd', 4], ['TSV West', 5], ['SC Ost', 6]]);
  });

  it('@ET-022 die Reihenfolge kommt aus dem Gruppenabschluss: eine spätere andere Rechnung (Kriterien-Reihenfolge) ändert sie nicht', () => {
    // @ET-056: Kammer gewann das direkte Spiel 2:1, Waging rot hat die bessere Tordifferenz – abgeschlossen unter BFV privat.
    const t = completeGroup(jgj('RKMUNO', DATA.ET_056));
    const neueRechnung: Tournament = { ...t, placementLogic: GD_FIRST_ORDER };
    const result = computeFinalStandings(neueRechnung);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking).slice(0, 2)).toEqual([['DJK Kammer', 1], ['TSV Waging rot', 2]]);
  });

  it('@ET-056 punktgleich, DJK Kammer gewann das direkte Spiel: Kammer steht im Endstand vor Waging rot, ohne Strafstoßschießen', () => {
    const t = jgj('RKMUNO', DATA.ET_056);
    expect(prepareGroupCompletion(t, '').code).toBe('READY');
    const names = computeFinalStandings(completeGroup(t)).ranking.map((row) => row.teamName);
    expect(names.indexOf('DJK Kammer')).toBeLessThan(names.indexOf('TSV Waging rot'));
  });

  it.each([
    { sieger: 'K' as const, verlierer: 'R' as const, dritter: 'DJK Kammer', vierter: 'TSV Waging rot' },
    { sieger: 'R' as const, verlierer: 'K' as const, dritter: 'TSV Waging rot', vierter: 'DJK Kammer' },
  ])('@ET-055 Strafstoßschießen für $dritter: der Sieger steht im Endstand vor dem anderen (3 vor 4)', async ({ sieger, verlierer, dritter, vierter }) => {
    const t = completeGroup(await decide(jgj('RKMUNO', DATA.ET_055, [1, 2, 3]), shootout(sieger, verlierer, 4, 3)));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking).slice(2, 4)).toEqual([[dritter, 3], [vierter, 4]]);
  });
});

describe('A-19a geteilte Plätze mit Platzziffern und Sprung (Review W4)', () => {
  it('@ET-020 drei Teams akzeptieren das Ergebnis auf Platz 2 bis 4: alle auf Platz 2, das nächste Team auf Platz 5', async () => {
    const t = completeGroup(await decide(jgj('WOUMNB', DATA.W2A_044), shared(['U', 'W', 'O'])));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(result.ranking[0]).toMatchObject({ teamName: 'SG Mitte', place: 1 });
    const zweite = result.ranking.filter((row) => ['VfB Ufer', 'TSV West', 'SC Ost'].includes(row.teamName));
    expect(zweite.map((row) => row.place)).toEqual([2, 2, 2]);
    expect(result.ranking.map((row) => row.place)).toEqual([1, 2, 2, 2, 5, 6]);
  });

  it('@ET-029 FC Nord und VfB Ufer akzeptieren das Ergebnis auf Platz 2: beide auf 2, das nächste Team auf 4', async () => {
    const t = completeGroup(await decide(jgj('MNUWOB', DATEN_029), shared(['N', 'U'])));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking).slice(0, 4)).toEqual([['SG Mitte', 1], ['FC Nord', 2], ['VfB Ufer', 2], ['TSV West', 4]]);
  });

  it.each([
    { plaetze: 'nur Platz 3', einstellung: [3] },
    { plaetze: 'kein Platz', einstellung: [] },
  ])('@ET-057 Platz 1 abgewählt ($plaetze): nach „Ergebnis so akzeptieren“ stehen SG Mitte und FC Nord beide auf Platz 1, das nächste Team auf 3', async ({ einstellung }) => {
    const t = completeGroup(await decide(jgj('MNWOUB', DATEN_PLATZ_1, einstellung), shared(['M', 'N'])));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking).slice(0, 3)).toEqual([['SG Mitte', 1], ['FC Nord', 1], ['TSV West', 3]]);
  });

  it('@ET-026 Platz 1 auszuspielen (Voreinstellung), SG Mitte und FC Nord gleich: ohne Strafstoßschießen kein fester Endstand', () => {
    const t = jgj('MNWOUB', DATEN_PLATZ_1);
    expect(prepareGroupCompletion(t, '').code).toBe('DECISION_REQUIRED');
    expect(computeFinalStandings(t).state).toBe('provisional');
  });

  it('@ET-027 nach dem Strafstoßschießen 3:2 für SG Mitte steht sie allein auf Platz 1 und FC Nord auf Platz 2', async () => {
    const t = completeGroup(await decide(jgj('MNWOUB', DATEN_PLATZ_1), shootout('M', 'N', 3, 2)));
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(placed(result.ranking).slice(0, 2)).toEqual([['SG Mitte', 1], ['FC Nord', 2]]);
  });
});

describe('A-19a @ET-058 ein entferntes Team steht nicht im Endstand (Daniel F5)', () => {
  /** TSV Petting nach dem zweiten Spieltag entfernt; seine Spiele zählen in der Tabelle wie eingestellt. */
  const ohnePetting = (): Tournament => {
    const t = nikolaus();
    return { ...t, teams: t.teams.map((team) => (team.id === NK.petting ? { ...team, isRemoved: true, removedAt: '2026-11-28T10:30:00Z' } : team)) };
  };
  const uebrige = [NK.kammer, NK.wagingRot, NK.otting, NK.fridolfing, NK.wagingBlau];

  it('@ET-058 Gruppe abgeschlossen (Rangfolge am Server ohne entferntes Team) → die übrigen 5 Teams auf den Plätzen 1 bis 5, Petting fehlt', () => {
    const t: Tournament = { ...ohnePetting(), groupCompletions: [completion('', uebrige)] };
    const result = computeFinalStandings(t);
    expect(result.state).toBe('complete');
    expect(result.ranking.map((row) => row.place)).toEqual([1, 2, 3, 4, 5]);
    expect(result.ranking.map((row) => row.teamId as string)).toEqual(uebrige);
    expect(result.ranking.some((row) => row.teamName === 'TSV Petting')).toBe(false);
  });

  it('@ET-058 auch vorläufig und auch, wenn eine Rangfolge das entfernte Team noch enthält: kein Platz für Petting, die übrigen rücken auf', () => {
    expect(computeFinalStandings(ohnePetting()).ranking.map((row) => [row.teamId as string, row.place])).toEqual(uebrige.map((id, i) => [id, i + 1]));
    const alt: Tournament = { ...ohnePetting(), groupCompletions: [completion('', [NK.kammer, NK.wagingRot, NK.petting, NK.otting, NK.fridolfing, NK.wagingBlau])] };
    const result = computeFinalStandings(alt);
    expect(result.state).toBe('complete');
    expect(result.ranking.map((row) => [row.teamId as string, row.place])).toEqual(uebrige.map((id, i) => [id, i + 1]));
  });

  it('@ET-031 Gegenbeispiel: ohne entferntes Team fehlt kein Team – Petting steht mit Platz im Endstand', async () => {
    const t = completeGroup(await decide(nikolaus(), ottingGewinnt));
    expect(computeFinalStandings(t).ranking.find((row) => row.teamName === 'TSV Petting')?.place).toBe(4);
  });
});
