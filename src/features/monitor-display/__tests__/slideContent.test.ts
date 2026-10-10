/** B-16f1 – Auswahl-Funktionen für Folieninhalte: Reihenfolge, offene Spiele, Feldplan, Seiten (@ZM-129 Logik). */
import { describe, it, expect } from 'vitest';
import type { Match, MatchStatus } from '../../../types/tournament';
import type { MonitorSlide } from '../../../types/monitor';
import {
  MONITOR_ROWS_PER_PAGE,
  compareKickoff,
  fieldSchedule,
  isUpcoming,
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
    teamA: 'A',
    teamB: 'B',
    matchNumber: 1,
    scheduledTime: um(14, 0),
    ...over,
  };
}

/** Status, den der Typ nicht kennt (z. B. unterbrochen) – nur für den Gegenbeispiel-Test. */
const unbekannterStatus = (s: string) => s as unknown as MatchStatus;

describe('compareKickoff – Anpfiff-Reihenfolge', () => {
  it('sortiert nach Uhrzeit, auch wenn Platz 3 im Array zuerst steht', () => {
    const platz3 = spiel('platz3', { round: 9, matchNumber: 12, scheduledTime: um(15, 20), label: 'Spiel um Platz 3' });
    const gruppe1 = spiel('g1', { matchNumber: 1, scheduledTime: um(14, 0) });
    const gruppe2 = spiel('g2', { matchNumber: 2, scheduledTime: um(14, 20) });
    const sortiert = upcomingMatches([platz3, gruppe2, gruppe1], { count: 3 });
    expect(sortiert.map(m => m.id)).toEqual(['g1', 'g2', 'platz3']);
  });

  it('ohne Uhrzeit nach Spielnummer, dann Runde, dann Id; fehlende Uhrzeit ans Ende', () => {
    const ohneZeit = spiel('ohne', { scheduledTime: undefined, matchNumber: 1 });
    const spaet = spiel('spaet', { matchNumber: 5, scheduledTime: um(16, 0) });
    const nr2 = spiel('nr2', { matchNumber: 2, scheduledTime: undefined });
    const nr1 = spiel('nr1', { matchNumber: 1, scheduledTime: undefined });
    expect([ohneZeit, nr2, spaet, nr1].sort(compareKickoff).map(m => m.id)).toEqual(['spaet', 'nr1', 'ohne', 'nr2']);
  });

  it('liest scheduledTime auch als String (aus JSON)', () => {
    const a = spiel('a', { scheduledTime: new Date(um(15, 0).toISOString()) });
    const b = spiel('b', { scheduledTime: um(14, 0).toISOString() as unknown as Date });
    expect([a, b].sort(compareKickoff).map(m => m.id)).toEqual(['b', 'a']);
  });

  it('gleiche Uhrzeit: Id als letzte Stufe, stabil', () => {
    const x = spiel('x', { matchNumber: 3 });
    const y = spiel('y', { matchNumber: 3 });
    expect([y, x].sort(compareKickoff).map(m => m.id)).toEqual(['x', 'y']);
    expect(compareKickoff(x, x)).toBe(0);
  });
});

describe('isUpcoming – offene Spiele', () => {
  it.each([
    ['ohne Status', undefined],
    ['angesetzt', 'scheduled'],
    ['wartend', 'waiting'],
  ] as const)('%s zählt als offen', (_name, status) => {
    expect(isUpcoming(spiel('m', { matchStatus: status }))).toBe(true);
  });

  it('läuft nie als offen (@ZM-071 Nächste Spiele, Gegenbeispiel)', () => {
    expect(isUpcoming(spiel('m', { matchStatus: 'running' }))).toBe(false);
  });

  it('unterbrochen (paused) zählt nie als offen', () => {
    expect(isUpcoming(spiel('m', { matchStatus: unbekannterStatus('paused') }))).toBe(false);
  });

  it('beendet und übersprungen zählen nie als offen', () => {
    expect(isUpcoming(spiel('m', { matchStatus: 'finished' }))).toBe(false);
    expect(isUpcoming(spiel('m', { matchStatus: 'skipped' }))).toBe(false);
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
    expect(upcomingMatches(liste, { count: 10 }).map(m => m.id)).toEqual(['spiel9', 'spiel10', 'spiel11']);
  });

  it('count begrenzt die Liste', () => {
    expect(upcomingMatches(liste, { count: 2 }).map(m => m.id)).toEqual(['spiel9', 'spiel10']);
  });

  it('field-Filter lässt nur das Feld zu', () => {
    expect(upcomingMatches(liste, { count: 5, field: 1 }).map(m => m.id)).toEqual(['spiel9', 'spiel11']);
  });

  it('liefert eine neue Liste und verändert die Eingabe nicht', () => {
    const vorher = liste.map(m => m.id);
    upcomingMatches(liste, { count: 3 });
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
    expect(fieldSchedule(liste, 2).map(m => m.id)).toEqual(['f2-frueh', 'f2-spaet']);
  });

  it('mehr als sechs Spiele: alle bleiben enthalten (kein slice)', () => {
    const liste = Array.from({ length: 9 }, (_, i) => spiel(`s${i}`, { field: 1, matchNumber: i + 1, scheduledTime: um(9, i) }));
    expect(fieldSchedule(liste, 1)).toHaveLength(9);
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
