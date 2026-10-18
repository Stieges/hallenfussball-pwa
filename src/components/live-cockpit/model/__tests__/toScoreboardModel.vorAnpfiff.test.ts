/**
 * Tafel vor dem Anpfiff und zwischen den Spielen (Aufgabe 2.5). Testwerte aus dem Gherkin von „Spiel leiten“
 * (Beispielturnier „Hallencup Süd“: Spiel 13 TSV West – SG Mitte, 15:15, Feld 1; Halbfinale 1; Feld 2 letztes Spiel 14).
 * Übersetzung als Schlüssel-Stub: geprüft wird der Inhalt (Team, Zahl, Zeit), nicht der Wortlaut.
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf, type LeerGrund } from '../cockpitPhase';
import { makeLiveMatch } from '../../__tests__/cockpitFixtures';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);

/** Spiel 13 TSV West – SG Mitte, angesetzt 15:15 (Ortszeit-unabhängig: ISO mit Offset). */
const SPIEL_13 = makeLiveMatch({
  id: 'm13', number: 13, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, scheduledKickoff: '2026-11-28T15:15:00.000Z',
  homeTeam: { id: 'tsv-west', name: 'TSV West' }, awayTeam: { id: 'sg-mitte', name: 'SG Mitte' },
});
const um = (hhmm: string) => Date.parse(`2026-11-28T${hhmm}:00.000Z`);

function vorAnpfiff(vor: Partial<NonNullable<ScoreboardInput['vor']>> = {}, jetzt = um('15:14'), leer: LeerGrund | null = null): ScoreboardInput {
  return {
    match: leer ? null : SPIEL_13,
    phase: cockpitPhaseOf({ view: null, matchStatus: leer ? null : 'NOT_STARTED', leer }),
    view: null, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0,
    jetztMs: jetzt, fieldName: 'Feld 1', tournamentName: 'Hallencup Süd',
    vor: { anstoss: '15:15', mindestpause: null, sperrHinweise: [], leer, uebernahmeVon: null, ...vor },
  };
}

describe('Tafel vor dem Anpfiff', () => {
  it('@SL-049 nach dem Bestätigen steht Spiel 13 TSV West – SG Mitte, 15:15, Feld 1 zum Anpfiff bereit', () => {
    const m = toScoreboardModel(vorAnpfiff(), t);
    expect(m.zustandText).toBe('tafel.zustand.vorAnpfiff');
    expect(m.ton).toBe('neutral');
    expect([m.links.name, m.rechts.name]).toEqual(['TSV West', 'SG Mitte']);
    expect(m.uhr).toMatchObject({ rest: '15:15', label: 'tafel.uhr.anstoss', unterzeile: 'tafel.vor.spielFeld:{"nummer":13,"feld":"Feld 1"}' });
    expect(m.abschnittText).toBe('Hallencup Süd');
  });

  it('@SL-001 vor dem Anpfiff steht der Stand 0:0 und keine laufende Uhr (Restzeit, Spielzeit)', () => {
    const m = toScoreboardModel(vorAnpfiff(), t);
    expect([m.links.tore, m.rechts.tore]).toEqual([0, 0]);
    expect(m.uhr?.gespielt).toBeNull();
    expect(m.uhr?.steht).toBe(false);
  });

  it('@SL-051 Mindestpause unterschritten: SG Mitte hätte nur 6 statt 10 Minuten Pause – ein Hinweis, der nichts sperrt', () => {
    const m = toScoreboardModel(vorAnpfiff({ mindestpause: { teamName: 'SG Mitte', minuten: 6, mindestMinuten: 10 } }), t);
    expect(m.hinweise).toContain('tafel.vor.mindestpause:{"teamName":"SG Mitte","minuten":6,"mindestMinuten":10}');
    expect(m.ton).toBe('neutral'); // kein Sperrzustand, die Tafel bleibt anpfeifbar
  });

  it('@SL-051 Gegenbeispiel: ohne unterschrittene Mindestpause kein Hinweis', () => {
    expect(toScoreboardModel(vorAnpfiff(), t).hinweise.some((h) => h.startsWith('tafel.vor.mindestpause'))).toBe(false);
  });

  it('@SL-118 um 15:22 ist Spiel 13 seit 7 Minuten überfällig (angesetzt 15:15)', () => {
    const m = toScoreboardModel(vorAnpfiff({}, um('15:22')), t);
    expect(m.hinweise).toContain('tafel.vor.ueberfaellig:{"minuten":7}');
  });

  it('@SL-118 Gegenbeispiel: um 15:14 (vor der Anstoßzeit) und genau um 15:15 ist das Spiel nicht überfällig', () => {
    for (const jetzt of [um('15:14'), um('15:15')]) {
      expect(toScoreboardModel(vorAnpfiff({}, jetzt), t).hinweise.some((h) => h.startsWith('tafel.vor.ueberfaellig'))).toBe(false);
    }
  });

  it('@SL-089 Sperr-Hinweis: „Nr. 7 ist für dieses Turnier gesperrt“ mit dem Team, und es bleibt ein Hinweis', () => {
    const m = toScoreboardModel(vorAnpfiff({ sperrHinweise: [{ teamId: 'tsv-west', playerNumber: 7, ausSpielNummer: 8 }] }), t);
    expect(m.hinweise).toContain('tafel.vor.gesperrt:{"nummer":7,"team":"TSV West"}');
  });

  it('@SL-089 Sperr-Hinweis eines Teams, das nicht im Spiel steht, erscheint nicht', () => {
    const m = toScoreboardModel(vorAnpfiff({ sperrHinweise: [{ teamId: 'fremd', playerNumber: 7, ausSpielNummer: 8 }] }), t);
    expect(m.hinweise.some((h) => h.startsWith('tafel.vor.gesperrt'))).toBe(false);
  });
});

describe('Tafel: wartet auf die Herkunft, kein Spiel mehr', () => {
  const wartet: LeerGrund = { art: 'wartetAufHerkunft', gruende: ['Gruppe B ist noch nicht abgeschlossen'], paarung: 'FC Nord – Zweiter Gruppe B', spielLabel: 'Halbfinale 1 · Feld 1' };

  it('@SL-052 Halbfinale 1 „FC Nord gegen Zweiter Gruppe B“ steht mit dem Grund da; der Anpfiff wird nicht angeboten (kein Spiel im Modell)', () => {
    const m = toScoreboardModel(vorAnpfiff({}, um('15:00'), wartet), t);
    expect(m.zustandText).toBe('tafel.zustand.wartet');
    expect(m.leerAnzeige).toEqual({ titel: 'FC Nord – Zweiter Gruppe B', untertitel: 'Halbfinale 1 · Feld 1' });
    expect(m.hinweise).toContain('tafel.vor.wartetAuf:{"grund":"Gruppe B ist noch nicht abgeschlossen"}');
    expect(m.uhr).toBeNull();
    expect(m.ton).toBe('info');
  });

  it('@SL-119 die Tafel nennt den Grund und dass nur die Turnierleitung die Reihenfolge auf Feld 1 ändert', () => {
    const m = toScoreboardModel(vorAnpfiff({}, um('15:00'), wartet), t);
    expect(m.hinweise).toEqual(expect.arrayContaining(['tafel.vor.wartetAuf:{"grund":"Gruppe B ist noch nicht abgeschlossen"}', 'tafel.vor.reihenfolgeNurLeitung']));
  });

  it('@TM-035 ohne Netz nennt die Tafel zusätzlich, dass der Stand dieses Geräts ohne Netz ist', () => {
    const m = toScoreboardModel(vorAnpfiff({}, um('15:00'), { ...wartet, offline: true }), t);
    expect(m.hinweise).toContain('tafel.vor.wartetOffline');
    expect(toScoreboardModel(vorAnpfiff({}, um('15:00'), wartet), t).hinweise).not.toContain('tafel.vor.wartetOffline');
  });

  it('@SL-054 nach dem letzten Spiel von Feld 2 sagt die Tafel, dass auf Feld 2 kein weiteres Spiel folgt', () => {
    const m = toScoreboardModel(vorAnpfiff({}, um('15:30'), { art: 'keinSpiel', feldName: 'Feld 2' }), t);
    expect(m.zustandText).toBe('tafel.zustand.keinSpiel');
    expect(m.hinweise).toContain('tafel.vor.keinSpielMehr:{"feld":"Feld 2"}');
    expect(m.leerAnzeige?.untertitel).toBe('Feld 2');
  });

  it('@SL-054 Gegenbeispiel: mit einem Spiel gibt es keinen Hinweis „kein Spiel mehr“ und keine Leer-Anzeige', () => {
    const m = toScoreboardModel(vorAnpfiff(), t);
    expect(m.hinweise.some((h) => h.startsWith('tafel.vor.keinSpielMehr'))).toBe(false);
    expect(m.leerAnzeige ?? null).toBeNull();
  });
});

describe('Tafel nach der Übernahme', () => {
  it('@SL-015 nach der Übernahme: „Spielzeit beruht auf Toms Gerät – bitte prüfen“, in jedem Zustand', () => {
    const input = vorAnpfiff({ uebernahmeVon: 'Tom' });
    const m = toScoreboardModel({ ...input, phase: { ...input.phase, zustand: 'laeuft' } }, t);
    expect(m.hinweise).toContain('tafel.uebernahmePruefen:{"name":"Tom"}');
  });

  it('@SL-015 Gegenbeispiel: ohne Übernahme kein Hinweis', () => {
    expect(toScoreboardModel(vorAnpfiff(), t).hinweise.some((h) => h.startsWith('tafel.uebernahmePruefen'))).toBe(false);
  });
});
