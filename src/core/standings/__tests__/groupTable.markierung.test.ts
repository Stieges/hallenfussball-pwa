/**
 * Paket TB, Task TB-1: Markierung „gleichauf – Entscheidung nötig“ und Platzziffer (Rechnung).
 * Records `2026-09-27_wizard-regelinhalte` (@W2A-044, @W2A-047, @W2A-055) und `2026-10-01_endstand-und-torschuetzen`
 * (@ET-025, @ET-055). Markierung erst, wenn alle Gruppenspiele entschieden sind; „nicht ausgetragen“ zählt als
 * entschieden und in keiner Spalte; gemeinsame Platzziffer mit Sprung (2, 2, 4). Daten: Plan v2 Abschnitt 6.
 */
import { describe, expect, it } from 'vitest';
import { rankGroup, type GroupTableResult, type GroupTableRow } from '../groupTable';
import type { Match } from '../../../types/tournament';
import { BFV_ORDER, DATA, id, league, names, NAME, POINTS_310, type Key } from './fixtures';

function rank(fx: { teams: GroupTableRow['team'][]; matches: Match[] }, groupId = ''): GroupTableResult {
  return rankGroup({
    groupId, teams: fx.teams, matches: fx.matches, pointSystem: POINTS_310, placementLogic: BFV_ORDER, decisions: [], mode: 'group', placesToPlayOut: [1], followUpRanks: [],
  });
}
const row = (rows: GroupTableRow[], key: Key): GroupTableRow => {
  const found = rows.find((r) => r.team.id === id(key));
  if (found === undefined) {
    throw new Error(`Team ${key} fehlt`);
  }
  return found;
};
const marked = (rows: GroupTableRow[]): string[] => rows.filter((r) => r.decisionNeeded).map((r) => r.team.name);

describe('TB-1 Markierung und Platzziffer', () => {
  it('@W2A-044 drei Teams nach allen Kriterien gleich: alle drei markiert, gemeinsame Platzziffer 2, das nächste Team auf 5', () => {
    const result = rank(league('WOUMNB', DATA.W2A_044));
    const { rows } = result;

    expect(result.allGroupMatchesDecided).toBe(true);
    expect(marked(rows).sort()).toEqual([NAME.W, NAME.O, NAME.U].sort());
    expect(['W', 'O', 'U'].map((k) => row(rows, k as Key).place)).toEqual([2, 2, 2]);
    expect(row(rows, 'M').place).toBe(1);
    expect([row(rows, 'B').place, row(rows, 'N').place]).toEqual([5, 6]);
    expect(result.openTies).toHaveLength(1);
    expect([...result.openTies[0]].sort()).toEqual([id('W'), id('O'), id('U')].sort());
    // Gegenbeispiel: kein Team außerhalb des Blocks ist markiert.
    expect(['M', 'B', 'N'].map((k) => row(rows, k as Key).decisionNeeded)).toEqual([false, false, false]);
  });

  it('@W2A-047 mitten in der Gruppe: gleiche Platzziffer mit Sprung (2, 2, 4), kein Strafstoßschießen; nach dem letzten Spiel markiert', () => {
    const offen = rank(league('RKMUNO', DATA.ET_055, { open: ['M–U', 'U–N', 'N–O'] }));

    expect(offen.allGroupMatchesDecided).toBe(false);
    expect(names(offen.rows).slice(0, 4)).toEqual([NAME.M, NAME.R, NAME.K, NAME.U]);
    expect([row(offen.rows, 'R').place, row(offen.rows, 'K').place]).toEqual([2, 2]);
    expect(row(offen.rows, 'U').place).toBe(4);
    expect(marked(offen.rows)).toEqual([]);

    // Gegenbeispiel im selben Test: die drei Spiele sind entschieden, der Gleichstand bleibt → beide markiert (3, 3, 5).
    const fertig = rank(league('RKMUNO', DATA.ET_055));
    expect(fertig.allGroupMatchesDecided).toBe(true);
    expect(marked(fertig.rows).sort()).toEqual([NAME.R, NAME.K].sort());
    expect([row(fertig.rows, 'R').place, row(fertig.rows, 'K').place]).toEqual([3, 3]);
    expect(row(fertig.rows, 'N').place).toBe(5);
  });

  it('@W2A-055 ein als „nicht ausgetragen“ beendetes Spiel hält die Entscheidung nicht auf und zählt in keiner Spalte', () => {
    const fx = league('RKMUNO', DATA.ET_055, { skipped: ['N–O'] });
    // Auch ein liegengebliebener Stand am abgesetzten Spiel zählt nicht.
    const matches = fx.matches.map((m) => (m.matchStatus === 'skipped' ? { ...m, scoreA: 3, scoreB: 0 } : m));
    const { rows, allGroupMatchesDecided } = rank({ teams: fx.teams, matches });

    expect(allGroupMatchesDecided).toBe(true);
    expect(marked(rows).sort()).toEqual([NAME.R, NAME.K].sort());
    expect([row(rows, 'N').played, row(rows, 'O').played]).toEqual([4, 4]);
    expect([row(rows, 'N').goalsFor, row(rows, 'N').goalsAgainst, row(rows, 'N').points]).toEqual([1, 5, 3]);
    expect([row(rows, 'O').goalsFor, row(rows, 'O').goalsAgainst, row(rows, 'O').points]).toEqual([2, 4, 3]);

    // Gegenbeispiel: dasselbe Spiel noch angesetzt, ohne Stand → keine Markierung.
    const angesetzt = rank(league('RKMUNO', DATA.ET_055, { open: ['N–O'] }));
    expect(angesetzt.allGroupMatchesDecided).toBe(false);
    expect(marked(angesetzt.rows)).toEqual([]);
  });

  it('@ET-055 zwei Teams nach allen Kriterien gleich (direktes Spiel 1:1): beide markiert, Platz 3 und 3, Nord auf 5', () => {
    const { rows, openTies } = rank(league('RKMUNO', DATA.ET_055));

    expect(rows.map((r) => r.points)).toEqual([12, 9, 7, 7, 6, 3]);
    expect(marked(rows).sort()).toEqual([NAME.R, NAME.K].sort());
    expect([row(rows, 'R').place, row(rows, 'K').place]).toEqual([3, 3]);
    expect(row(rows, 'N').place).toBe(5);
    expect(openTies).toHaveLength(1);
    // Gegenbeispiel: die Teams davor und dahinter sind nicht markiert.
    expect(['M', 'U', 'N', 'O'].map((k) => row(rows, k as Key).decisionNeeded)).toEqual([false, false, false, false]);
  });

  it.each([
    {
      turnier: 'privates Turnier „Jeder gegen jeden“ mit 6 Teams', teams: 'WOMUNB', paar: ['W', 'O'], plaetze: [3, 3], danach: ['N', 5],
      results: 'W–O 1:1; W–N 2:0; W–B 1:0; M–W 1:0; U–W 2:0; O–M 2:0; O–U 1:0; N–O 1:0; B–O 2:0; M–U 1:0; M–N 2:0; M–B 1:0; U–N 1:0; U–B 2:0; N–B 1:0',
    },
    {
      turnier: 'Turnier „Jeder gegen jeden“ mit 6 Teams', teams: 'MNWOUB', paar: ['M', 'N'], plaetze: [1, 1], danach: ['W', 3],
      results: 'M–N 2:2; M–W 1:0; M–O 1:0; M–U 1:0; M–B 1:0; N–W 1:0; N–O 1:0; N–U 1:0; N–B 1:0; W–O 1:0; W–U 1:0; W–B 1:0; O–U 1:0; O–B 1:0; U–B 1:0',
    },
  ])('@ET-025 $turnier: $paar nach allen Kriterien gleich → beide „gleichauf – Entscheidung nötig“', ({ teams, paar, plaetze, danach, results }) => {
    const { rows } = rank(league(teams, results));

    expect(paar.map((k) => row(rows, k as Key).decisionNeeded)).toEqual([true, true]);
    expect(paar.map((k) => row(rows, k as Key).place)).toEqual(plaetze);
    expect(row(rows, danach[0] as Key).place).toBe(danach[1]);
    // Gegenbeispiel: genau diese zwei sind markiert.
    expect(rows.filter((r) => r.decisionNeeded)).toHaveLength(2);
  });

  it('@ET-025 das Turnier „Hallencup Nord“: DJK Berg und VfB Ufer (Gruppe B) gleich auf Platz 2 und 3 → beide markiert, Gruppe A nicht', () => {
    const a = league('NSWO', 'N–S 2:1; N–W 1:1; N–O 3:0; S–W 2:1; S–O 2:0; W–O 3:1', { group: 'A', idPrefix: 'a' });
    const b = league('MBUT', 'M–B 2:0; M–U 2:0; M–T 2:0; B–U 1:1; B–T 1:0; U–T 1:0', { group: 'B', idPrefix: 'b' });

    const gruppeB = rank({ teams: b.teams, matches: b.matches }, 'B');
    expect(names(gruppeB.rows)[0]).toBe(NAME.M);
    expect(marked(gruppeB.rows).sort()).toEqual([NAME.B, NAME.U].sort());
    expect([row(gruppeB.rows, 'B').place, row(gruppeB.rows, 'U').place, row(gruppeB.rows, 'T').place]).toEqual([2, 2, 4]);
    // Gegenbeispiel: Gruppe A (FC Nord 7, SV Süd 6, TSV West 4, SC Ost 0) hat keinen Gleichstand.
    const gruppeA = rank({ teams: a.teams, matches: a.matches }, 'A');
    expect(names(gruppeA.rows)).toEqual([NAME.N, NAME.S, NAME.W, NAME.O]);
    expect(marked(gruppeA.rows)).toEqual([]);
  });

  it('Stabilität: ein offener Block steht in Eingabereihenfolge, zweimal gerechnet gleich', () => {
    const fx = league('RKMUNO', DATA.ET_055);
    const erst = rank(fx);
    const zweit = rank(fx);
    expect(zweit).toEqual(erst);
    expect(names(erst.rows).slice(2, 4)).toEqual([NAME.R, NAME.K]);
    // Gegenbeispiel: umgekehrte Eingabe dreht nur den offenen Block, die übrigen Plätze bleiben.
    const umgekehrt = rank({ teams: [...fx.teams].reverse(), matches: fx.matches });
    expect(names(umgekehrt.rows)).toEqual([NAME.M, NAME.U, NAME.K, NAME.R, NAME.N, NAME.O]);
  });
});
