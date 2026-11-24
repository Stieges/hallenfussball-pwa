/**
 * @SL-243 Bei einem Feld nennt das Cockpit kein Feld in der Tafel (Gherkin in `2026-10-02_spiel-leiten.md`):
 * „Spiel 3 · 2. Halbzeit“ mit der gespielten Zeit, vor dem Anpfiff „Anstoß 9:10 · Spiel 3“, nach dem letzten Spiel „Heute folgt kein Spiel mehr“.
 * Aber bei zwei Feldern bleiben „Spiel 3 · Feld 2 · 2. Halbzeit“, „Anstoß 9:10 · Spiel 3 · Feld 2“ und „Auf Feld 2 folgt kein Spiel mehr“.
 * Übersetzung als Schlüssel-Stub: geprüft wird der Inhalt (Schlüssel und Werte).
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf, type LeerGrund } from '../cockpitPhase';
import { makeLiveMatch, makePhaseView } from '../../__tests__/cockpitFixtures';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);
const JETZT = Date.parse('2026-11-28T09:00:00.000Z');

function laeuft(fieldName: string | undefined): ScoreboardInput {
  const v = makePhaseView({ section: 2, sectionLimitMs: 360_000, sectionElapsedMs: 246_000 });
  return {
    match: makeLiveMatch({ number: 3, homeScore: 1, awayScore: 0 }), phase: cockpitPhaseOf({ view: v, matchStatus: 'RUNNING', leer: null }), view: v,
    links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0, jetztMs: JETZT,
    ...(fieldName === undefined ? {} : { fieldName }),
  };
}

function vorAnpfiff(fieldName: string | undefined, leer: LeerGrund | null = null): ScoreboardInput {
  return {
    match: leer ? null : makeLiveMatch({ number: 3, status: 'NOT_STARTED', homeScore: 0, awayScore: 0, scheduledKickoff: '2026-11-28T09:10:00.000Z' }),
    phase: cockpitPhaseOf({ view: null, matchStatus: leer ? null : 'NOT_STARTED', leer }), view: null,
    links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0, jetztMs: JETZT,
    vor: { anstoss: '9:10', mindestpause: null, sperrHinweise: [], leer, uebernahmeVon: null },
    ...(fieldName === undefined ? {} : { fieldName }),
  };
}

describe('@SL-243 Kopfzeile der Tafel im laufenden Spiel', () => {
  it('ein Feld: „Spiel 3 · 2. Halbzeit · gespielt“, ohne Feld', () => {
    const kopf = toScoreboardModel(laeuft(undefined), t).kopfText ?? '';
    expect(kopf.split(' · ')).toEqual(['tafel.kopf.spiel:{"nummer":3}', 'tafel.abschnitt.halbzeit:{"nummer":2}', 'tafel.kopf.gespielt:{"zeit":"4:06"}']);
    expect(kopf).not.toContain('Feld');
  });

  it('Gegenbeispiel zwei Felder: „Spiel 3 · Feld 2 · 2. Halbzeit“ wie bisher', () => {
    expect((toScoreboardModel(laeuft('Feld 2'), t).kopfText ?? '').split(' · ')[1]).toBe('Feld 2');
  });
});

describe('@SL-243 Tafel vor dem Anpfiff', () => {
  it('ein Feld: Unterzeile „Anstoß 9:10 · Spiel 3“ ohne Feld', () => {
    const m = toScoreboardModel(vorAnpfiff(undefined), t);
    expect(m.uhr?.unterzeile).toBe('tafel.kopf.spiel:{"nummer":3}');
    expect(m.uhr?.rest).toBe('9:10');
  });

  it('ein Feld, kleine Zeile am Handy mit Spielzeit: „Anstoß 9:10 · Spiel 3“, ohne Feld', () => {
    const eingang = { ...vorAnpfiff(undefined), spielzeitKlein: true };
    const unterzeile = toScoreboardModel(eingang, t).uhr?.unterzeile ?? '';
    expect(unterzeile).toContain('tafel.vor.anstossSpielFeld:{"zeit":"9:10","spielFeld":"tafel.kopf.spiel:{\\"nummer\\":3}"}');
  });

  it('Gegenbeispiel zwei Felder: „Anstoß 9:10 · Spiel 3 · Feld 2“ wie bisher', () => {
    expect(toScoreboardModel(vorAnpfiff('Feld 2'), t).uhr?.unterzeile).toBe('tafel.vor.spielFeld:{"nummer":3,"feld":"Feld 2"}');
  });
});

describe('@SL-243 nach dem letzten Spiel', () => {
  it('ein Feld: „Heute folgt kein Spiel mehr“, ohne Feldname', () => {
    const m = toScoreboardModel(vorAnpfiff(undefined, { art: 'keinSpiel' }), t);
    expect(m.hinweise).toContain('tafel.vor.keinSpielMehrHeute');
    expect(m.leerAnzeige?.untertitel).toBeNull();
  });

  it('Gegenbeispiel zwei Felder: „Auf Feld 2 folgt kein Spiel mehr“ wie bisher', () => {
    const m = toScoreboardModel(vorAnpfiff('Feld 2', { art: 'keinSpiel', feldName: 'Feld 2' }), t);
    expect(m.hinweise).toContain('tafel.vor.keinSpielMehr:{"feld":"Feld 2"}');
    expect(m.leerAnzeige?.untertitel).toBe('Feld 2');
  });
});
