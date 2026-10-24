/**
 * toStrafenModel (Plan Cockpit v2 B3): @SL-186 – laufende Zeitstrafen als Karten, höchstens zwei je Team, jede weitere als „+ n weitere“.
 * Testwerte aus dem Gherkin: DJK Otting hat 0, 2 oder 3 laufende Zeitstrafen; „Nr. 9, seit Spielzeit 3:18, Restzeit 1:12 bei 2 Minuten“; 1-Minute-Strafe.
 */
import { describe, it, expect } from 'vitest';
import { toStrafenModel, KEINE_STRAFEN, STRAFEN_KARTEN_JE_TEAM } from '../toStrafenModel';
import type { PhasePenalty } from '../../engine/phaseView';
import { makeLiveMatch, KASTEN_HEIM, KASTEN_GAST } from '../../__tests__/cockpitFixtures';

const match = makeLiveMatch({ homeTeam: { id: 'tsv-petting', name: 'TSV Petting' }, awayTeam: { id: 'djk-otting', name: 'DJK Otting' } });
const kasten = { home: KASTEN_HEIM, away: KASTEN_GAST };
const strafe = (id: string, rest: number, ueber: Partial<PhasePenalty> = {}): PhasePenalty =>
  ({ id, teamId: 'djk-otting', playerNumber: 9, remainingMs: rest * 1000, durationMs: 120_000, seitMs: 198_000, ...ueber });

describe('@SL-186 Laufende Zeitstrafen stehen als Karten am Laptop', () => {
  it('0 laufende Zeitstrafen: keine Karte, kein „weitere“ (die Spalte zeigt „Keine aktiven Zeitstrafen“)', () => {
    expect(toStrafenModel([], match, kasten)).toEqual(KEINE_STRAFEN);
    expect(toStrafenModel(undefined, match, kasten)).toEqual(KEINE_STRAFEN);
  });

  it('2 laufende Zeitstrafen: beide als Karte mit großer Restzeit, Spielzeit des Beginns und Balken', () => {
    const m = toStrafenModel([strafe('a', 72), strafe('b', 100, { playerNumber: 4, seitMs: 150_000 })], match, kasten);
    expect(m.karten).toHaveLength(2);
    expect(m.weitere).toBe(0);
    expect(m.karten[0]).toMatchObject({ id: 'a', teamName: 'DJK Otting', nummer: 9, rest: '1:12', minuten: 2, seit: '3:18' });
    expect(m.karten[0].anteil).toBeCloseTo(72 / 120, 5);
    expect(m.karten[1]).toMatchObject({ id: 'b', nummer: 4, rest: '1:40', seit: '2:30' });
  });

  it('3 laufende Zeitstrafen von DJK Otting: zwei als Karte (die mit der kürzesten Restzeit) und „+ 1 weitere“', () => {
    const m = toStrafenModel([strafe('lang', 110), strafe('kurz', 20), strafe('mittel', 60)], match, kasten);
    expect(m.karten.map((k) => k.id)).toEqual(['kurz', 'mittel']);
    expect(m.weitere).toBe(1);
  });

  it('die Grenze gilt je Team: zwei Karten für jedes Team, die dritte des einen Teams zählt zu „weitere“', () => {
    const heim = (id: string, rest: number): PhasePenalty => strafe(id, rest, { teamId: 'tsv-petting' });
    const m = toStrafenModel([heim('h1', 30), heim('h2', 40), strafe('g1', 50), strafe('g2', 60), strafe('g3', 70)], match, kasten);
    expect(m.karten).toHaveLength(2 * STRAFEN_KARTEN_JE_TEAM);
    expect(m.weitere).toBe(1);
    expect(m.karten.map((k) => k.id)).toEqual(['h1', 'h2', 'g1', 'g2']); // nach Restzeit, beide Teams gemischt
  });

  it('der Randstreifen trägt die Teamfarbe des Ergebniskastens (Heim blau, Gast rot in der Vorbelegung)', () => {
    const m = toStrafenModel([strafe('g', 50), strafe('h', 40, { teamId: 'tsv-petting' })], match, kasten);
    expect(m.karten.find((k) => k.id === 'h')?.kasten).toBe(KASTEN_HEIM);
    expect(m.karten.find((k) => k.id === 'g')?.kasten).toBe(KASTEN_GAST);
  });

  it('Gegenprobe 1-Minute-Strafe: „1 Min“, der Balken zählt von 60 s herunter (bei 0:45 Rest drei Viertel)', () => {
    const m = toStrafenModel([strafe('eine', 45, { durationMs: 60_000 })], match, kasten);
    expect(m.karten[0].minuten).toBe(1);
    expect(m.karten[0].anteil).toBeCloseTo(0.75, 5);
  });

  it('ohne Nummer: die Karte nennt keine Nummer (Titel „ohne Nr.“)', () => {
    const m = toStrafenModel([strafe('o', 50, { playerNumber: undefined })], match, kasten);
    expect(m.karten[0].nummer).toBeNull();
  });

  it('Strafe aus einem früheren Abschnitt: kein „seit Spielzeit“ (der Beginn lag vor dem Abschnitt)', () => {
    const m = toStrafenModel([strafe('v', 50, { seitMs: null })], match, kasten);
    expect(m.karten[0].seit).toBeNull();
  });
});
