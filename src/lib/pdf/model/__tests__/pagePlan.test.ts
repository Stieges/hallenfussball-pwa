/**
 * @DR-002 und @DR-033: Verteilung der Gruppenspiele auf Seiten, Mindestzahl auf der Folgeseite, Finalrunde auf der Seite der
 * Tabellen nur, wenn ganz Platz ist. Rein, ohne Schrift.
 */
import { describe, expect, it } from 'vitest';
import { printMatchRow } from '../../../../design-tokens/print-sheet';
import { finalsOnTablesPage, splitRows } from '../pagePlan';

const rows = (count: number, height: number): number[] => Array.from({ length: count }, () => height);

describe('@DR-033 Folgeseite der Gruppenspiele', () => {
  it('@DR-033 passt alles auf Seite 1, gibt es keine Folgeseite', () => {
    expect(splitRows(rows(10, 8), [100, 200], printMatchRow.minRowsOnNextPage).map(p => p.length)).toEqual([10]);
  });

  it('@DR-033 passen die Spiele nicht, laufen sie auf einer Folgeseite weiter', () => {
    expect(splitRows(rows(15, 8), [100, 200], printMatchRow.minRowsOnNextPage).map(p => p.length)).toEqual([12, 3]);
  });

  it('@DR-033 auf der Folgeseite stehen mindestens 3 Spiele: ein einzelnes Waisenspiel zieht Zeilen von Seite 1 nach', () => {
    const pages = splitRows(rows(13, 8), [100, 200], printMatchRow.minRowsOnNextPage);

    expect(pages.map(p => p.length)).toEqual([10, 3]);
    expect(pages.flat()).toEqual(Array.from({ length: 13 }, (_, i) => i));
  });

  it('Gegenbeispiel @DR-033: genau 3 Spiele auf der Folgeseite werden nicht noch einmal verschoben', () => {
    expect(splitRows(rows(15, 8), [100, 200], printMatchRow.minRowsOnNextPage).map(p => p.length)).toEqual([12, 3]);
  });

  it('@DR-002 die Folgeseite hat ihre eigene Kapazität (mehr Platz als Seite 1)', () => {
    expect(splitRows(rows(30, 8), [100, 200], printMatchRow.minRowsOnNextPage).map(p => p.length)).toEqual([12, 18]);
  });
});

describe('@DR-002 Finalrunde und Platzierung auf der Seite der Tabellen', () => {
  it('@DR-002 haben beide ganz Platz, folgen sie auf derselben Seite', () => {
    expect(finalsOnTablesPage(100, 70, 20, 5)).toBe(true);
  });

  it('Gegenbeispiel @DR-002 fehlt auch nur 1 mm, beginnen sie auf einer neuen Seite (große Finalrunde)', () => {
    expect(finalsOnTablesPage(94, 70, 20, 5)).toBe(false);
    expect(finalsOnTablesPage(95, 70, 20, 5)).toBe(true);
  });

  it('@DR-002 ohne Platzierung zählt nur die Finalrunde', () => {
    expect(finalsOnTablesPage(70, 70, 0, 5)).toBe(true);
  });
});
