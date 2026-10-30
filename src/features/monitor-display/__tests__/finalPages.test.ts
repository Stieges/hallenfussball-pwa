/**
 * R3-7 Seiten der Endstand- und Torschützen-Folie (@ZM-129, @ZM-121 Z. 1, @ZM-012 Z. 2): reine Aufteilung ohne React.
 * Gegenstück zu @ZM-129: dichte Folien blättern, Namen nie kürzen, jede Zeile auf genau einer Seite; Gruppen gleichen
 * Rangs (Torschützen mit gleicher Tore-Zahl, geteilte Plätze) bleiben zusammen, solange sie auf eine Seite passen.
 */
import { describe, expect, it } from 'vitest';
import type { FinalStandingRow, ScorerRow } from '../../../core/standings/finalStandings';
import { rankingPages, scorerPages } from '../finalPages';
import { TeamIdSchema } from '../../../core/models/schemas/MatchSlotSchema';
import { testUuid } from '../../../test/matchSlotFixtures';

const teamId = (n: number) => TeamIdSchema.parse(testUuid(n));

const NAME_50 = 'Sportgemeinschaft Rot-Weiß Musterstadt Nord 1904 I';

function row(place: number, teamName: string, index: number): FinalStandingRow {
  return { place, teamId: teamId(index + 1), teamName, origin: { kind: 'groupPlace', group: '', place } };
}
const kurz = (places: number[]): FinalStandingRow[] => places.map((place, i) => row(place, `Team ${String(i + 1)}`, i));

function spieler(rank: number, nummer: number, tore: number, index: number): ScorerRow {
  return { kind: 'player', rank, teamId: teamId(index + 1), teamName: `Team ${String(index + 1)}`, number: nummer, goals: tore };
}

describe('rankingPages (@ZM-129, @ZM-121 Z. 1)', () => {
  it('6 Teams mit kurzen Namen stehen auf einer Seite', () => {
    expect(rankingPages(kurz([1, 2, 3, 4, 5, 6]))).toHaveLength(1);
  });

  it('8 Teams mit kurzen Namen blättern auf 2 Seiten, jede Zeile genau einmal und in Reihenfolge', () => {
    const rows = kurz([1, 2, 3, 4, 5, 6, 7, 8]);
    const pages = rankingPages(rows);
    expect(pages).toHaveLength(2);
    expect(pages.flat().map((r) => r.teamId)).toEqual(rows.map((r) => r.teamId));
  });

  it('@ZM-129: 8 Teams mit 50-Zeichen-Namen: höchstens 2 Teams je Seite (4 Seiten), kein Name gekürzt', () => {
    const rows = [1, 2, 3, 4, 5, 6, 7, 8].map((place, i) => row(place, `${NAME_50} ${String(i)}`.slice(0, 50), i));
    const pages = rankingPages(rows);
    expect(pages).toHaveLength(4);
    expect(Math.max(...pages.map((p) => p.length))).toBe(2);
    expect(pages.flat().map((r) => r.teamName)).toEqual(rows.map((r) => r.teamName));
    expect(pages.flat().some((r) => r.teamName.includes('…'))).toBe(false);
  });

  it('geteilte Plätze (2, 2, 2, 5) bleiben auf einer Seite, wenn sie passen', () => {
    const pages = rankingPages(kurz([1, 2, 2, 2, 5, 6, 7]));
    const seitenMitZwei = pages.map((p) => p.filter((r) => r.place === 2).length).filter((n) => n > 0);
    expect(seitenMitZwei).toEqual([3]);
  });

  it('ein Turnier ohne Teams hat trotzdem eine (leere) Seite – nie 0 Seiten', () => {
    expect(rankingPages([])).toEqual([[]]);
  });
});

describe('scorerPages (@ZM-129 Torschützen blättern in Gruppen gleichen Rangs)', () => {
  it('Gruppe gleichen Rangs wird nie über zwei Seiten zerrissen, wenn sie auf eine Seite passt', () => {
    // Ränge 1 bis 4, dann drei Spieler auf Rang 5 (gleiche Zahl Tore): ohne Gruppenregel würde Seite 1 mit 6 Zeilen mitten in Rang 5 enden
    const rows: ScorerRow[] = [
      spieler(1, 9, 8, 0), spieler(2, 7, 7, 1), spieler(3, 4, 6, 2), spieler(4, 5, 5, 3), spieler(5, 6, 4, 4), spieler(5, 8, 4, 5), spieler(5, 3, 4, 6),
    ];
    const pages = scorerPages(rows);
    expect(pages.flat()).toEqual(rows);
    const seitenMitRang5 = pages.filter((p) => p.some((r) => r.rank === 5));
    expect(seitenMitRang5).toHaveLength(1);
    expect(seitenMitRang5[0].filter((r) => r.rank === 5)).toHaveLength(3);
  });

  it('jede Zeile steht auf genau einer Seite, Reihenfolge bleibt', () => {
    const rows: ScorerRow[] = Array.from({ length: 14 }, (_, i) => spieler(i + 1, i + 1, 20 - i, i));
    const pages = scorerPages(rows);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat()).toEqual(rows);
  });

  it('eine Gruppe, die allein nicht auf eine Seite passt, wird geteilt – nie eine Zeile weggelassen', () => {
    const rows: ScorerRow[] = Array.from({ length: 9 }, (_, i) => spieler(1, i + 1, 3, i));
    const pages = scorerPages(rows);
    expect(pages.flat()).toEqual(rows);
    expect(pages.length).toBeGreaterThan(1);
  });

  it('Sammelzeilen ohne Rang stehen am Ende, nach den Spielern', () => {
    const sammel: ScorerRow = { kind: 'noNumber', rank: null, teamId: teamId(9), teamName: 'Team 9', goals: 2 };
    const pages = scorerPages([spieler(1, 9, 5, 0), sammel]);
    expect(pages.flat().at(-1)).toEqual(sammel);
  });
});
