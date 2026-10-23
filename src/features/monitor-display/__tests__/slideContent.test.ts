/** B-16f1 – Auswahl-Funktionen für Folieninhalte: Reihenfolge, offene Spiele, Feldplan, Seiten (@ZM-129 Logik). */
import { describe, it, expect } from 'vitest';
import type { Match, MatchStatus } from '../../../types/tournament';
import type { MatchView, TournamentView } from '../../../core/view';
import { looseVs } from '../../../test/matchSlotFixtures';
import type { MonitorSlide } from '../../../types/monitor';
import { buildTournament } from './monitorFixture';
import { buildMonitorView } from '../monitorView';
import {
  MONITOR_ROWS_PER_PAGE,
  compareKickoff,
  fieldSchedule,
  monitorPageCount,
  pageOf,
  pagesFor,
  upcomingMatches,
} from '../slideContent';

const um = (h: number, min: number) => new Date(2026, 9, 24, h, min);

function spiel(id: string, over: Partial<Match> = {}): Match {
  return {
    id,
    round: 1,
    field: 1,
    ...looseVs('A', 'B'),
    matchNumber: 1,
    scheduledTime: um(14, 0),
    ...over,
  };
}

/** Die Ansicht des Monitors über diese Spiele (A-36c): Status, Anstoß und Sortierung kommen von dort. */
const ansicht = (matches: Match[]): TournamentView => buildMonitorView(buildTournament({ matches, date: '2026-10-24' }));
/** Ein Spiel der Ansicht. */
const viewSpiel = (m: Match): MatchView => {
  const found = ansicht([m]).byId.get(m.id);
  if (!found) { throw new Error('Spiel fehlt in der Ansicht'); }
  return found;
};
const ids = (list: MatchView[]) => list.map(m => m.id);

/** Status, den der Typ nicht kennt (z. B. unterbrochen) – nur für den Gegenbeispiel-Test. */
const unbekannterStatus = (s: string) => s as unknown as MatchStatus;

describe('compareKickoff – Anpfiff-Reihenfolge', () => {
  it('sortiert nach Uhrzeit, auch wenn Platz 3 im Array zuerst steht', () => {
    const platz3 = spiel('platz3', { round: 9, matchNumber: 12, scheduledTime: um(15, 20), label: 'Spiel um Platz 3' });
    const gruppe1 = spiel('g1', { matchNumber: 1, scheduledTime: um(14, 0) });
    const gruppe2 = spiel('g2', { matchNumber: 2, scheduledTime: um(14, 20) });
    const sortiert = upcomingMatches(ansicht([platz3, gruppe2, gruppe1]), { count: 3 });
    expect(ids(sortiert)).toEqual(['g1', 'g2', 'platz3']);
  });

  it('unlesbare Uhrzeit (NaN) steht hinter allen Spielen mit Uhrzeit', () => {
    const kaputt = spiel('kaputt', { matchNumber: 1, scheduledTime: 'kaputt' as unknown as Date });
    const frueh = spiel('frueh', { matchNumber: 9, scheduledTime: um(14, 0) });
    const spaet = spiel('spaet', { matchNumber: 2, scheduledTime: um(15, 0) });
    expect(ids(ansicht([kaputt, spaet, frueh]).matches.slice().sort(compareKickoff))).toEqual(['frueh', 'spaet', 'kaputt']);
  });

  it('ohne Uhrzeit nach Spielnummer, dann Id; fehlende Uhrzeit ans Ende', () => {
    const ohneZeit = spiel('ohne', { scheduledTime: undefined, matchNumber: 1 });
    const spaet = spiel('spaet', { matchNumber: 5, scheduledTime: um(16, 0) });
    const nr2 = spiel('nr2', { matchNumber: 2, scheduledTime: undefined });
    const nr1 = spiel('nr1', { matchNumber: 1, scheduledTime: undefined });
    expect(ids(ansicht([ohneZeit, nr2, spaet, nr1]).matches.slice().sort(compareKickoff))).toEqual(['spaet', 'nr1', 'ohne', 'nr2']);
  });

  it('liest scheduledTime auch als String (aus JSON)', () => {
    const a = spiel('a', { scheduledTime: new Date(um(15, 0).toISOString()) });
    const b = spiel('b', { scheduledTime: um(14, 0).toISOString() as unknown as Date });
    expect(ids(ansicht([a, b]).matches.slice().sort(compareKickoff))).toEqual(['b', 'a']);
  });

  it('gleiche Uhrzeit: Id als letzte Stufe, stabil', () => {
    const x = spiel('x', { matchNumber: 3 });
    const y = spiel('y', { matchNumber: 3 });
    const view = ansicht([y, x]);
    expect(ids(view.matches.slice().sort(compareKickoff))).toEqual(['x', 'y']);
    const vx = viewSpiel(x);
    expect(compareKickoff(vx, vx)).toBe(0);
  });
});

describe('isUpcoming – offene Spiele', () => {
  it.each([
    ['ohne Status', undefined],
    ['angesetzt', 'scheduled'],
    ['wartend', 'waiting'],
  ] as const)('%s zählt als offen', (_name, status) => {
    expect(viewSpiel(spiel('m', { matchStatus: status })).isUpcoming).toBe(true);
  });

  it('läuft nie als offen (@ZM-071 Nächste Spiele, Gegenbeispiel)', () => {
    expect(viewSpiel(spiel('m', { matchStatus: 'running' })).isUpcoming).toBe(false);
  });

  it('unterbrochen (paused) zählt nie als offen', () => {
    expect(viewSpiel(spiel('m', { matchStatus: unbekannterStatus('paused') })).isUpcoming).toBe(false);
  });

  it('Laufzeitstatus paused und finished zählen nie als nächstes Spiel', () => {
    expect(upcomingMatches(ansicht([spiel('p', { matchStatus: unbekannterStatus('paused') })]), { count: 1 })).toEqual([]);
    expect(upcomingMatches(ansicht([spiel('f', { matchStatus: 'finished' })]), { count: 1 })).toEqual([]);
  });

  it('beendet und übersprungen zählen nie als offen', () => {
    expect(viewSpiel(spiel('m', { matchStatus: 'finished' })).isUpcoming).toBe(false);
    expect(viewSpiel(spiel('m', { matchStatus: 'skipped' })).isUpcoming).toBe(false);
  });
});

describe('upcomingMatches – Nächste Spiele', () => {
  const liste = [
    spiel('laeuft', { matchNumber: 7, scheduledTime: um(14, 0), matchStatus: 'running' }),
    spiel('unterbrochen', { matchNumber: 8, scheduledTime: um(14, 5), matchStatus: unbekannterStatus('paused') }),
    spiel('fertig', { matchNumber: 6, scheduledTime: um(13, 40), matchStatus: 'finished' }),
    spiel('spiel9', { matchNumber: 9, scheduledTime: um(14, 40), field: 1 }),
    spiel('spiel10', { matchNumber: 10, scheduledTime: um(14, 40), field: 2 }),
    spiel('spiel11', { matchNumber: 11, scheduledTime: um(15, 0), field: 1 }),
  ];

  it('zählt nur offene Spiele, sortiert, ohne laufende und unterbrochene', () => {
    expect(ids(upcomingMatches(ansicht(liste), { count: 10 }))).toEqual(['spiel9', 'spiel10', 'spiel11']);
  });

  it('count begrenzt die Liste', () => {
    expect(ids(upcomingMatches(ansicht(liste), { count: 2 }))).toEqual(['spiel9', 'spiel10']);
  });

  it('field-Filter lässt nur das Feld zu', () => {
    expect(ids(upcomingMatches(ansicht(liste), { count: 5, field: 1 }))).toEqual(['spiel9', 'spiel11']);
  });

  it('liefert eine neue Liste und verändert die Eingabe nicht', () => {
    const vorher = liste.map(m => m.id);
    upcomingMatches(ansicht(liste), { count: 3 });
    expect(liste.map(m => m.id)).toEqual(vorher);
  });
});

describe('fieldSchedule – Spielplan eines Feldes', () => {
  it('alle Spiele des Feldes in Anpfiff-Reihenfolge, auch beendete', () => {
    const liste = [
      spiel('f2-spaet', { field: 2, matchNumber: 4, scheduledTime: um(15, 0) }),
      spiel('f1', { field: 1, matchNumber: 1, scheduledTime: um(14, 0), matchStatus: 'finished' }),
      spiel('f2-frueh', { field: 2, matchNumber: 2, scheduledTime: um(14, 0) }),
    ];
    expect(ids(fieldSchedule(ansicht(liste), 2))).toEqual(['f2-frueh', 'f2-spaet']);
  });

  it('mehr als sechs Spiele: alle bleiben enthalten (kein slice)', () => {
    const liste = Array.from({ length: 9 }, (_, i) => spiel(`s${i}`, { field: 1, matchNumber: i + 1, scheduledTime: um(9, i) }));
    expect(fieldSchedule(ansicht(liste), 1)).toHaveLength(9);
  });
});

describe('pageOf / pagesFor – Seiten', () => {
  it('Standard sind sechs Zeilen je Seite', () => {
    expect(MONITOR_ROWS_PER_PAGE).toBe(6);
  });

  it('13 Zeilen → 3 Seiten, jede Zeile genau auf einer Seite', () => {
    const zeilen = Array.from({ length: 13 }, (_, i) => `z${i}`);
    const seiten = pagesFor(zeilen.length);
    expect(seiten).toBe(3);
    const alle = Array.from({ length: seiten }, (_, p) => pageOf(zeilen, p));
    expect(alle.flat()).toEqual(zeilen);
    expect(alle.map(s => s.length)).toEqual([6, 6, 1]);
  });

  it('pagesFor ist mindestens 1, auch ohne Zeilen', () => {
    expect(pagesFor(0)).toBe(1);
    expect(pagesFor(6)).toBe(1);
    expect(pagesFor(7)).toBe(2);
  });

  it('pageOf mit eigener Zeilenzahl', () => {
    expect(pageOf([1, 2, 3, 4, 5], 1, 2)).toEqual([3, 4]);
    expect(pageOf([1, 2, 3], 5)).toEqual([]);
  });
});

describe('monitorPageCount – Seitenzahl je Folie (f1: eine Seite)', () => {
  it('liefert 1 für jede Folie', () => {
    expect(monitorPageCount({ id: 'x', type: 'custom-text', config: {}, order: 0 } as MonitorSlide)).toBe(1);
  });
});
