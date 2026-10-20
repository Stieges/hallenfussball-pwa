/**
 * Paket TB, Task TB-1: direkter Vergleich zuerst (@ET-056, @W2A-003) und Gruppenblöcke über die Fassade
 * `calculateStandings` (Befund C-TABELLE-GRUPPENUEBERGREIFEND, Rechnung zu @W2A-049): je Gruppe rechnen, keine
 * gruppenübergreifende Sondertabelle; ohne Gruppe bei mehreren Gruppen kein direkter Vergleich und keine Markierung.
 * Daten: Plan v2 Abschnitt 6 (@ET-056, @ET-055), Gruppe B eigens gebaut und gegengerechnet.
 */
import { describe, expect, it } from 'vitest';
import { calculateStandings } from '../../../utils/calculations';
import { createMockTournament } from '../../../test/factories';
import type { Standing } from '../../../types/tournament';
import { BFV_ORDER, DATA, GD_FIRST_ORDER, id, league, names, NAME, type Key } from './fixtures';

const row = (rows: Standing[], key: Key): Standing => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) {
    throw new Error(`Team ${key} fehlt`);
  }
  return found;
};
const before = (rows: Standing[], a: Key, b: Key): boolean =>
  rows.findIndex((r) => r.team.id === id(a)) < rows.findIndex((r) => r.team.id === id(b));

/** Gruppe B: TSV Waging blau 9 Punkte (+3), TSV Petting 6, SV Süd 3, TuS Tal 0 – gegengerechnet. */
const GRUPPE_B = 'X–P 1:0; X–S 1:0; X–T 1:0; P–S 1:0; P–T 1:0; S–T 1:0';

function zweiGruppen(gruppeA: string) {
  const a = league('KRMUNO', gruppeA, { group: 'A', idPrefix: 'a' });
  const b = league('XPST', GRUPPE_B, { group: 'B', idPrefix: 'b' });
  const teams = [...a.teams, ...b.teams];
  const matches = [...a.matches, ...b.matches];
  const tournament = createMockTournament({ teams, matches, placementLogic: BFV_ORDER, groupSystem: 'groupsAndFinals' });
  return { teams, matches, tournament };
}

describe('TB-1 direkter Vergleich zuerst und Gruppenblöcke', () => {
  it('@ET-056 @W2A-003 Kammer gewann das direkte Spiel 2:1 und steht vor Waging rot (bessere Tordifferenz), kein Strafstoßschießen', () => {
    const { teams, matches, tournament } = league('RKMUNO', DATA.ET_056);
    const rows = calculateStandings(teams, matches, tournament);

    expect(names(rows).slice(0, 2)).toEqual([NAME.K, NAME.R]);
    expect([row(rows, 'K').points, row(rows, 'R').points]).toEqual([9, 9]);
    expect(row(rows, 'R').goalDifference).toBeGreaterThan(row(rows, 'K').goalDifference);
    expect(rows.some((r) => r.decisionNeeded === true)).toBe(false);
    expect(rows.map((r) => r.place)).toEqual([1, 2, 3, 4, 5, 6]);

    // Gegenbeispiel: Reihenfolge „Punkte, Tordifferenz, Tore, direkter Vergleich“ → Waging rot vor Kammer.
    const anders = league('RKMUNO', DATA.ET_056, { placementLogic: GD_FIRST_ORDER });
    expect(names(calculateStandings(anders.teams, anders.matches, anders.tournament)).slice(0, 2)).toEqual([NAME.R, NAME.K]);
  });

  it('@W2A-049 C-TABELLE-GRUPPENUEBERGREIFEND je Gruppe: ein Team aus Gruppe B gerät nicht in die Sondertabelle von Gruppe A', () => {
    const { teams, matches, tournament } = zweiGruppen(DATA.ET_056);

    const gruppeA = calculateStandings(teams, matches, tournament, 'A');
    expect(gruppeA.map((r) => r.team.group)).toEqual(Array(6).fill('A'));
    expect(names(gruppeA).slice(0, 2)).toEqual([NAME.K, NAME.R]);
    expect(row(calculateStandings(teams, matches, tournament, 'B'), 'X').points).toBe(9);

    // Aufruf ohne Gruppe bei zwei Gruppen: gruppenübergreifend, ohne direkten Vergleich (Waging rot +6, Waging blau +3, Kammer +1).
    const gesamt = calculateStandings(teams, matches, tournament);
    expect(names(gesamt).slice(0, 3)).toEqual([NAME.R, NAME.X, NAME.K]);

    // Gegenbeispiel: Jeder gegen jeden ohne Gruppenbuchstaben und ohne `group` → der direkte Vergleich wirkt.
    const jgj = league('RKMUNO', DATA.ET_056);
    expect(before(calculateStandings(jgj.teams, jgj.matches, jgj.tournament), 'K', 'R')).toBe(true);
  });

  it('@W2A-049 C-TABELLE-GRUPPENUEBERGREIFEND ohne Gruppe bei zwei Gruppen: keine Markierung; je Gruppe markiert', () => {
    const { teams, matches, tournament } = zweiGruppen(DATA.ET_055);

    const gesamt = calculateStandings(teams, matches, tournament);
    expect(gesamt.some((r) => r.decisionNeeded === true)).toBe(false);
    expect(row(gesamt, 'R').place).toBe(row(gesamt, 'K').place);

    // Gegenbeispiel: dieselben Daten je Gruppe A → Waging rot und Kammer markiert (Platz 3 und 3).
    const gruppeA = calculateStandings(teams, matches, tournament, 'A');
    expect([row(gruppeA, 'R').decisionNeeded, row(gruppeA, 'K').decisionNeeded]).toEqual([true, true]);
    expect([row(gruppeA, 'R').place, row(gruppeA, 'K').place]).toEqual([3, 3]);
    // Und Jeder gegen jeden ohne Gruppe markiert ebenfalls (eine Tabellengruppe).
    const jgj = league('RKMUNO', DATA.ET_055);
    expect(row(calculateStandings(jgj.teams, jgj.matches, jgj.tournament), 'K').decisionNeeded).toBe(true);
  });
});
