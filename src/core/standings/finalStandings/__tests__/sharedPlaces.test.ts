/**
 * A-19a Platzziffern im Endstand (R-EA-4, Review W4): Platz = 1 + Zahl der Teams davor, geteilte Plätze mit Sprung.
 * Gleichlauf-Datei `final-standings-roundrobin.json` geht an A-21a-S P-8 (TS-Platzziffern == Server-Prüfung).
 * Record `2026-10-01_endstand-und-torschuetzen` (@ET-020, @ET-029, @ET-057, @ET-058, @ET-022 / N7c).
 */
import { describe, expect, it } from 'vitest';
import fixture from '../../__fixtures__/final-standings-roundrobin.json';
import { placeNumbers, placeNumbersValid } from '../sharedPlaces';
import { completeGroup, decide } from './finalStandingsKit';
import { computeFinalStandings } from '..';
import { NK, tournamentFromFixture } from '../../__tests__/groupCompletionKit';

describe('A-19a Gleichlauf final-standings-roundrobin.json – Platzziffern aus Reihenfolge und geteilten Blöcken', () => {
  for (const c of fixture.cases) {
    it(c.name, () => {
      expect(placeNumbers(c.order, c.sharedBlocks)).toEqual(c.places);
      expect(placeNumbersValid(c.places)).toBe(true);
    });
  }
  for (const v of fixture.validity) {
    it(`Platzziffern ${v.places.join(', ')}: ${v.name} → ${v.valid ? 'gültig' : 'ungültig'}`, () => {
      expect(placeNumbersValid(v.places)).toBe(v.valid);
    });
  }
});

describe('A-19a Platzziffern – Gegenbeispiele', () => {
  it('ein geteilter Block, dessen Teams nicht hintereinander stehen, passt nicht zur Reihenfolge', () => {
    expect(placeNumbers(['a', 'b', 'c'], [['a', 'c']])).toBeUndefined();
  });

  it('@ET-022 N7c: der echt erzeugte Nikolaus-Endstand trägt genau die Reihenfolge und Platzziffern der Gleichlauf-Datei', async () => {
    const t = { ...tournamentFromFixture('nikolaus'), version: 1 };
    const abgeschlossen = completeGroup(await decide(t, { groupId: '', teamIds: [NK.otting, NK.petting], order: [NK.otting, NK.petting], kind: 'shootout', shootout: { winner: 4, loser: 3 } }));
    const { ranking } = computeFinalStandings(abgeschlossen);
    expect({ order: ranking.map((row) => row.teamId as string), places: ranking.map((row) => row.place) })
      .toEqual({ order: fixture.cases[0].order, places: fixture.cases[0].places });
  });
});
