/**
 * @SL-241 Tafel vor dem Anpfiff: mit `spielzeitKlein` steht die Spielzeit nur klein in der Zeile („Anstoß … · Spiel … · Feld … · Spielzeit …“),
 * ohne große Ziffern; ohne das Merkmal bleibt sie groß wie in @SL-197. Übersetzung als Schlüssel-Stub (geprüft werden Zahl und Reihenfolge).
 */
import { describe, it, expect } from 'vitest';
import { toScoreboardModel, type ScoreboardInput } from '../toScoreboardModel';
import { cockpitPhaseOf } from '../cockpitPhase';
import { makeLiveMatch } from '../../__tests__/cockpitFixtures';

const t = (key: string, o?: Record<string, unknown>) => (o ? `${key}:${JSON.stringify(o)}` : key);
const SPIEL = makeLiveMatch({ id: 'm3', number: 3, status: 'NOT_STARTED', scheduledKickoff: '2026-11-28T10:20:00.000Z' });

function eingang(extra: Partial<ScoreboardInput>, abschnitte = 1): ScoreboardInput {
  return {
    match: SPIEL, phase: cockpitPhaseOf({ view: null, matchStatus: 'NOT_STARTED', leer: null }),
    view: null, links: 'home', rechts: 'away', uhrArt: 'durchlaufend-letzte-minute-angehalten', eintraegeWarten: 0, helferAnfragen: 0,
    jetztMs: Date.parse('2026-11-28T10:00:00.000Z'), fieldName: 'Feld 1', tournamentName: 'Cup',
    vor: { anstoss: '10:20', mindestpause: null, sperrHinweise: [], leer: null, uebernahmeVon: null, spielzeit: { abschnitte, abschnittSekunden: abschnitte > 1 ? 240 : 540 } },
    ...extra,
  };
}

describe('@SL-241 Spielzeit klein in der Zeile der Tafel', () => {
  it('klein: nur die Zeile mit Anstoß, Spiel, Feld und Spielzeit 9:00; keine großen Ziffern, kein Label', () => {
    const uhr = toScoreboardModel(eingang({ spielzeitKlein: true }), t).uhr;
    expect(uhr?.nurZeile).toBe(true);
    expect(uhr?.label ?? null).toBeNull();
    expect(uhr?.unterzeile).toContain('tafel.vor.zeileMitSpielzeit');
    expect(uhr?.unterzeile).toContain('"spielzeit":"9:00"');
  });
  it('klein, zwei Abschnitte: „2 × 4:00“ steht in der Zeile', () => {
    const uhr = toScoreboardModel(eingang({ spielzeitKlein: true }, 2), t).uhr;
    expect(uhr?.unterzeile).toMatch(/"spielzeit":"tafel\.vor\.abschnitteMal:.*anzahl.*2.*\\u00a04:00"|abschnitteMal.*4:00/);
  });
  it('Gegenbeispiel ohne das Merkmal (kein Handy oder keine Karte): groß wie in @SL-197', () => {
    const uhr = toScoreboardModel(eingang({}), t).uhr;
    expect(uhr?.nurZeile).toBeUndefined();
    expect(uhr).toMatchObject({ rest: '9:00', label: 'tafel.uhr.spielzeit' });
  });
  it('Gegenbeispiel nach dem Anpfiff: das Merkmal ändert die laufende Uhr nicht (groß, mit Restzeit)', () => {
    const laeuft = makeLiveMatch({ id: 'm3', number: 3, status: 'RUNNING', elapsedSeconds: 60 });
    const uhr = toScoreboardModel(eingang({ match: laeuft, phase: cockpitPhaseOf({ view: null, matchStatus: 'RUNNING', leer: null }), spielzeitKlein: true }), t).uhr;
    expect(uhr?.nurZeile).toBeUndefined();
  });
});
