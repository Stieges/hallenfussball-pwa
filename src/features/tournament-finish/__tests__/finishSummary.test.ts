/**
 * R3-4 Vorschlag „Alles entschieden“, Hinweis nach 7 Tagen, Siegerzeile und Zahlen des Dialogs. Erwartungen aus dem Gherkin
 * docs/anforderungen/2026-10-01_turnier-lebenszyklus.md und 2026-10-01_endstand-und-torschuetzen.md; das Turnier ist das echt
 * erzeugte Nikolaus-Turnier (finishKit), alle Spiele entschieden, Gruppe abgeschlossen.
 *
 * Szenarien: @LZ-007 (Vorschlag, wenn alles entschieden ist), @LZ-008 (kein Vorschlag, solange etwas offen ist), @LZ-005 (Hinweis
 * erst 7 Tage nach dem letzten Spiel), @LZ-006 (nichts wird aus Spielständen „abgeschlossen“), @ET-044 (Strafstoßschießen).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import type { Tournament } from '../../../types/tournament';
import type { FinalStandingRow } from '../../../core/standings/finalStandings';
import { NK, tournamentFromFixture, withMatch } from '../../../core/standings/__tests__/groupCompletionKit';
import { nikolausFertig } from '../../../core/services/__tests__/finishKit';
import { finishFacts, lateFinishHint, pointsByTeam, shouldSuggestFinish, shootoutNote } from '../model/finishSummary';

let fertig: Tournament;
beforeAll(async () => { fertig = await nikolausFertig(); });

describe('@LZ-007 Ist alles entschieden, schlägt die App den Abschluss vor', () => {
  it('alle Spiele entschieden, Gruppe abgeschlossen, nichts in der Klärungsliste, Zustand „Läuft“ → Vorschlag', () => {
    expect(shouldSuggestFinish(fertig, 'running', 0)).toBe(true);
  });
});

describe('@LZ-008 Solange etwas offen ist, schlägt die App den Abschluss nicht vor', () => {
  it('ein Eintrag in der Klärungsliste ist offen → kein Vorschlag', () => {
    expect(shouldSuggestFinish(fertig, 'running', 1)).toBe(false);
  });

  it('ein Spiel läuft noch → kein Vorschlag', () => {
    const letztes = fertig.matches[fertig.matches.length - 1];
    expect(shouldSuggestFinish(withMatch(fertig, letztes.id, { matchStatus: 'running' }), 'running', 0)).toBe(false);
  });

  it('die Gruppe ist noch nicht abgeschlossen (alle Spiele entschieden) → kein Vorschlag (@LZ-013)', () => {
    const offen = { ...fertig, groupCompletions: [] };
    expect(shouldSuggestFinish(offen, 'running', 0)).toBe(false);
  });

  it('@LZ-006 Gegenbeispiel: ein Turnier, das nicht „Läuft“ ist (abgeschlossen, Entwurf), bekommt nie einen Vorschlag', () => {
    expect(shouldSuggestFinish(fertig, 'finished', 0)).toBe(false);
    expect(shouldSuggestFinish(fertig, 'fixed', 0)).toBe(false);
  });
});

describe('@LZ-005 Hinweis, wenn ein Turnier nach dem letzten Spiel nicht abgeschlossen wird', () => {
  const ende = '2026-10-12T16:00:00.000Z';
  const mitEnde = (): Tournament => ({ ...fertig, matches: fertig.matches.map((m) => ({ ...m, finishedAt: ende })) });
  it.each([
    ['18.10.2026 (6 Tage danach)', '2026-10-18T17:00:00.000Z', false],
    ['19.10.2026 (7 Tage danach)', '2026-10-19T17:00:00.000Z', true],
    ['20.10.2026 (8 Tage danach)', '2026-10-20T17:00:00.000Z', true],
  ])('%s → Hinweis: %s', (_name, jetzt, hinweis) => {
    const result = lateFinishHint(mitEnde(), 'running', new Date(jetzt));
    expect(result !== null).toBe(hinweis);
    if (hinweis) {
      expect(result).toBe(ende);
    }
  });

  it('Gegenbeispiele: abgeschlossen oder noch ein Spiel offen → kein Hinweis, auch nach Wochen', () => {
    const spaet = new Date('2026-12-24T12:00:00.000Z');
    expect(lateFinishHint(mitEnde(), 'finished', spaet)).toBeNull();
    const offen = withMatch(mitEnde(), fertig.matches[0].id, { matchStatus: 'scheduled' });
    expect(lateFinishHint(offen, 'running', spaet)).toBeNull();
  });
});

describe('@LZ-005 Liste der Startseite (ohne Spiele, mit dem Ende des letzten Spiels aus der Listenabfrage)', () => {
  it('7 Tage danach ein Hinweis, 6 Tage danach keiner, ohne Ende (ein Spiel offen) keiner', () => {
    const liste = { matches: [], lastMatchEndedAt: '2026-10-12T16:00:00.000Z' };
    expect(lateFinishHint(liste, 'running', new Date('2026-10-19T17:00:00.000Z'))).toBe('2026-10-12T16:00:00.000Z');
    expect(lateFinishHint(liste, 'running', new Date('2026-10-18T17:00:00.000Z'))).toBeNull();
    expect(lateFinishHint({ matches: [] }, 'running', new Date('2026-12-24T12:00:00.000Z'))).toBeNull();
  });
});

describe('Zahlen des Dialogs: „15 von 15 Spielen gespielt · 0 ausgefallen · 6 Teams“', () => {
  it('Nikolaus', () => {
    expect(finishFacts(fertig)).toEqual({ played: 15, total: 15, skipped: 0, teams: 6 });
  });

  it('ein als ausgefallen gewertetes Spiel zählt als ausgefallen, nicht als gespielt', () => {
    const t = withMatch(fertig, fertig.matches[0].id, { matchStatus: 'skipped' });
    expect(finishFacts(t)).toMatchObject({ played: 14, skipped: 1, total: 15 });
  });

  it('ein entferntes Team zählt nicht mit', () => {
    const t = { ...fertig, teams: fertig.teams.map((team, i) => (i === 0 ? { ...team, isRemoved: true } : team)) };
    expect(finishFacts(t).teams).toBe(5);
  });
});

describe('@ET-044 Platz 1 per Strafstoßschießen entschieden', () => {
  const row = (place: number, teamId: string, teamName: string): FinalStandingRow => ({
    place, teamId: teamId as FinalStandingRow['teamId'], teamName, origin: { kind: 'groupPlace', group: '', place },
  });
  const ranking = [row(1, NK.kammer, 'DJK Kammer'), row(2, NK.wagingRot, 'TSV Waging rot'), row(3, NK.otting, 'DJK Otting')];

  it('eine Entscheidung „Strafstoßschießen 4:3“ für den Sieger gegen den Zweiten → Hinweis mit Gegner', () => {
    const decision = { id: 'd1', groupId: '', teamIds: [NK.kammer, NK.wagingRot].sort(), order: [NK.kammer, NK.wagingRot], kind: 'shootout' as const, shootout: { winner: 4, loser: 3 }, basis: 'x' };
    expect(shootoutNote({ standingDecisions: [decision] }, ranking)).toEqual({ winner: 4, loser: 3, otherName: 'TSV Waging rot' });
  });

  it('Gegenbeispiele: Entscheidung um andere Plätze, „Ergebnis so akzeptieren“ oder keine Entscheidung → kein Hinweis', () => {
    expect(shootoutNote(fertig, ranking)).toBeNull(); // Nikolaus: das Strafstoßschießen betraf Platz 3/4
    expect(shootoutNote({ standingDecisions: [] }, ranking)).toBeNull();
    const shared = { id: 'd2', groupId: '', teamIds: [NK.kammer, NK.wagingRot].sort(), order: [NK.kammer, NK.wagingRot], kind: 'shared' as const, basis: 'x' };
    expect(shootoutNote({ standingDecisions: [shared] }, ranking)).toBeNull();
  });
});

describe('Punkte neben den Plätzen nur bei Jeder gegen jeden', () => {
  it('Nikolaus (eine Gruppe, keine Finalrunde): jedes Team hat Punkte', () => {
    const punkte = pointsByTeam(fertig);
    expect(punkte?.size).toBe(6);
    expect(punkte?.get(NK.kammer)).toBeGreaterThan(punkte?.get(NK.fridolfing) ?? 99);
  });

  it('Gegenbeispiel: Gruppen mit Finalrunde → keine Punkte (sie bestimmen den Platz nicht allein)', () => {
    expect(pointsByTeam(tournamentFromFixture('hallencup'))).toBeNull();
  });
});
