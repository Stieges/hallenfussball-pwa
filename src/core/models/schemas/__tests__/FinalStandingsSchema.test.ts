/**
 * A-20a Endstand-Format (Plan `plan-endstand-abschluss.md` § 3): Gleichlauf-Datei `final-standings-shapes.json` – jede Zeile
 * gültig/ungültig mit Grund, dieselbe Datei prüft am Server `match_engine.final_standings_shape_valid` (A-21a-S).
 * Record `2026-10-01_endstand-und-torschuetzen`: @ET-031 (jedes Team genau einmal, Form), @ET-045 (gespeichertes Format mit
 * App-Version, eine neue Version ändert es nicht). Aus dem Gherkin und dem Plan abgeleitet, nicht am Code abgelesen.
 */
import { describe, expect, it } from 'vitest';
import shapes from '../../../standings/__fixtures__/final-standings-shapes.json';
import { FinalStandingsSnapshotSchema, parseFinalStandingsSnapshot } from '../FinalStandingsSchema';

describe('A-20a Gleichlauf final-standings-shapes.json (FinalStandingsSnapshotSchema == final_standings_shape_valid)', () => {
  for (const row of shapes.rows) {
    it(`${row.name} → ${row.valid ? 'gültig' : `ungültig (${row.reason})`}`, () => {
      expect(FinalStandingsSnapshotSchema.safeParse(row.snapshot).success).toBe(row.valid);
    });
  }

  it('jede ungültige Zeile nennt ihren Grund, jede gültige keinen', () => {
    expect(shapes.rows.filter((r) => (r.reason === '') !== r.valid).map((r) => r.name)).toEqual([]);
  });
});

describe('A-20a Form des gespeicherten Endstands (@ET-031, @ET-045)', () => {
  const gueltig = shapes.rows[0].snapshot;

  it('@ET-045 der gespeicherte Endstand trägt Format 1, die App-Version und den Zeitpunkt der Rechnung', () => {
    const parsed = parseFinalStandingsSnapshot(gueltig);
    expect(parsed).toMatchObject({ format: 1, appVersion: '2.3.0', computedAt: '2026-11-28T15:30:00.000Z' });
  });

  it('@ET-045 Lesen ist verlustfrei: Plätze, Herkunft und Torschützen kommen unverändert zurück', () => {
    expect(parseFinalStandingsSnapshot(JSON.parse(JSON.stringify(gueltig)))).toEqual(gueltig);
  });

  it('@ET-031 Gegenbeispiel: ein Team zweimal im Endstand ist keine gültige Form', () => {
    const doppelt = { ...gueltig, ranking: [gueltig.ranking[0], { ...gueltig.ranking[1], teamId: gueltig.ranking[0].teamId }] };
    expect(parseFinalStandingsSnapshot(doppelt)).toBeUndefined();
  });

  it('Gegenbeispiel: Spieler ohne Nummer und Rang bei Eigentoren sind ungültig, nie still übernommen', () => {
    const [spieler, ohneNummer, eigentore] = gueltig.scorers;
    const { number: _number, ...spielerOhneNummer } = spieler as typeof spieler & { number: number };
    expect(parseFinalStandingsSnapshot({ ...gueltig, scorers: [spielerOhneNummer, ohneNummer, eigentore] })).toBeUndefined();
    expect(parseFinalStandingsSnapshot({ ...gueltig, scorers: [spieler, ohneNummer, { ...eigentore, rank: 3 }] })).toBeUndefined();
  });

  it('Gegenbeispiel: ein unbekannter Schlüssel (Zusatzschlüssel) macht den Endstand ungültig', () => {
    expect(parseFinalStandingsSnapshot({ ...gueltig, ranking: [{ ...gueltig.ranking[0], extra: 1 }, gueltig.ranking[1]] })).toBeUndefined();
  });
});
