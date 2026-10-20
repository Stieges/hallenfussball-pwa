/**
 * Paket TB, Task TB-1: Sondertabelle und Blöcke nach BFV Teil 3 § 20 (13) (Record `2026-09-27_wizard-regelinhalte`).
 * Lesart 1 (Daniel 2026-10-20, endgültig): jedes Kriterium nur auf die bis dahin noch gleichen Teams; nach dem direkten
 * Vergleich gilt das NÄCHSTE Kriterium der Liste, kein erneuter direkter Vergleich für die Teilmenge.
 * Daten: Plan v2 Abschnitt 6 (`fixtures.ts`), gegengerechnet. Tests aus dem Gherkin, nicht am Code abgelesen.
 */
import { describe, expect, it } from 'vitest';
import { rankGroup, type GroupTableRow } from '../groupTable';
import type { PlacementCriterion, PointSystem } from '../../../types/tournament';
import { BFV_ORDER, DATA, id, league, names, NAME, POINTS_210, POINTS_310, type Key } from './fixtures';

function table(keys: string, results: string, opts: { pointSystem?: PointSystem; placementLogic?: PlacementCriterion[] } = {}) {
  const { teams, matches } = league(keys, results, opts);
  return rankGroup({
    groupId: '',
    teams,
    matches,
    pointSystem: opts.pointSystem ?? POINTS_310,
    placementLogic: opts.placementLogic ?? BFV_ORDER,
    decisions: [],
    mode: 'group',
  });
}

const row = (rows: GroupTableRow[], key: Key): GroupTableRow => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) {
    throw new Error(`Team ${key} fehlt`);
  }
  return found;
};
const before = (rows: GroupTableRow[], a: Key, b: Key): boolean =>
  rows.findIndex((r) => r.team.id === id(a)) < rows.findIndex((r) => r.team.id === id(b));

describe('TB-1 Sondertabelle (BFV privat, Lesart 1)', () => {
  it('@W2A-041 @W2A-002 drei punktgleiche Teams: die Sondertabelle entscheidet vor der Tordifferenz aller Spiele (Ost, West, Ufer)', () => {
    const { rows } = table('WOUMNB', DATA.W2A_041);

    expect(names(rows)).toEqual([NAME.M, NAME.O, NAME.W, NAME.U, NAME.N, NAME.B]);
    expect(rows.map((r) => r.points)).toEqual([10, 7, 7, 7, 5, 5]);
    // Gegenbeispiel: West gewann das direkte Spiel gegen Ost (1:0) und steht trotzdem dahinter;
    // Ufer hat die beste Gesamt-Tordifferenz (+5) und ist Letzter der drei.
    expect(before(rows, 'O', 'W')).toBe(true);
    expect(row(rows, 'U').goalDifference).toBe(5);
    expect(row(rows, 'U').goalDifference).toBeGreaterThan(row(rows, 'O').goalDifference);
    expect(before(rows, 'W', 'U')).toBe(true);
    expect(rows.some((r) => r.decisionNeeded)).toBe(false);
  });

  it('@W2A-042 @W2A-002 ausgeglichene Sondertabelle: die Tordifferenz aller Gruppenspiele entscheidet (West, Ost, Ufer), kein Strafstoßschießen', () => {
    const { rows, openTies } = table('WOUMNB', DATA.W2A_042);

    expect(names(rows)).toEqual([NAME.M, NAME.W, NAME.O, NAME.U, NAME.B, NAME.N]);
    expect([row(rows, 'W').goalDifference, row(rows, 'O').goalDifference, row(rows, 'U').goalDifference]).toEqual([3, 1, -1]);
    expect(rows.some((r) => r.decisionNeeded)).toBe(false);
    expect(openTies).toEqual([]);
    expect(rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);

    // Gegenbeispiel: ohne Rückgriff auf die Gruppenspiele (nur Punkte + direkter Vergleich) wären alle drei offen.
    const ohneRueckgriff = table('WOUMNB', DATA.W2A_042, { placementLogic: BFV_ORDER.slice(0, 2) });
    expect(['W', 'O', 'U'].map((k) => row(ohneRueckgriff.rows, k as Key).decisionNeeded)).toEqual([true, true, true]);
    expect(['W', 'O', 'U'].map((k) => row(ohneRueckgriff.rows, k as Key).place)).toEqual([2, 2, 2]);
  });

  it('@W2A-043 trennt die Sondertabelle nur ein Team ab, zählt für die übrigen nicht erneut das direkte Spiel (Mitte, Ost, West)', () => {
    const { rows } = table('WOUMNB', DATA.W2A_043);

    expect(names(rows)).toEqual([NAME.B, NAME.M, NAME.O, NAME.W, NAME.U, NAME.N]);
    expect(rows.slice(1, 4).map((r) => r.points)).toEqual([6, 6, 6]);
    expect(rows.some((r) => r.decisionNeeded)).toBe(false);
    // Gegenbeispiel: West gewann 2:0 gegen Ost – eine Wiederanwendung des direkten Vergleichs ergäbe West vor Ost.
    expect(before(rows, 'O', 'W')).toBe(true);
    // Ohne Tordifferenz/Tore in der Liste bleiben West und Ost gleich (offen) – der direkte Vergleich wird nicht
    // auf die Teilmenge wiederholt, er setzt West nicht nach vorn.
    const nurDirekt = table('WOUMNB', DATA.W2A_043, { placementLogic: BFV_ORDER.slice(0, 2) });
    expect(row(nurDirekt.rows, 'M').place).toBe(2);
    expect([row(nurDirekt.rows, 'W').place, row(nurDirekt.rows, 'O').place]).toEqual([3, 3]);
    expect(row(nurDirekt.rows, 'W').decisionNeeded).toBe(true);
  });

  it('@W2A-057 trennt die Sondertabelle ein Team ab, entscheidet die Turnierleitung nur über die übrigen zwei (Strafstoßschießen)', () => {
    const { rows, openTies } = table('WOUMNB', DATA.W2A_057);

    expect(names(rows).slice(0, 2)).toEqual([NAME.B, NAME.M]);
    expect(before(rows, 'M', 'W') && before(rows, 'M', 'O')).toBe(true);
    expect(row(rows, 'W').decisionNeeded).toBe(true);
    expect(row(rows, 'O').decisionNeeded).toBe(true);
    expect([row(rows, 'W').place, row(rows, 'O').place]).toEqual([3, 3]);
    expect([row(rows, 'U').place, row(rows, 'N').place]).toEqual([5, 6]);
    // Zwei Teams → Ergebnis eines Strafstoßschießens, keine Reihenfolge von dreien.
    expect(openTies).toHaveLength(1);
    expect([...openTies[0]].sort()).toEqual([id('W'), id('O')].sort());
    expect([...(row(rows, 'W').tieBlock ?? [])].sort()).toEqual([id('W'), id('O')].sort());
    // Gegenbeispiel: SG Mitte (vom selben Punktestand) ist nicht markiert, obwohl West das direkte Spiel 2:0 gewann.
    expect(row(rows, 'M').decisionNeeded).toBe(false);
    expect(row(rows, 'M').tieBlock).toBeUndefined();
  });

  it('@W2A-045 die Sondertabelle zählt Punkte nach dem eingestellten Punkteschema 2/1/0 (Ost, Ufer, West, Mitte, Nord)', () => {
    const { rows } = table('MWOUN', DATA.W2A_045, { pointSystem: POINTS_210 });

    expect(names(rows)).toEqual([NAME.O, NAME.U, NAME.W, NAME.M, NAME.N]);
    expect(rows.map((r) => r.points)).toEqual([5, 5, 5, 5, 0]);
    // Gegenbeispiel: Ufer steht vor Mitte; mit 3/1/0 stünde Ufer hinter Mitte.
    expect(before(rows, 'U', 'M')).toBe(true);
    const mit310 = table('MWOUN', DATA.W2A_045, { pointSystem: POINTS_310 });
    expect(before(mit310.rows, 'M', 'U')).toBe(true);
  });
});
