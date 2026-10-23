/**
 * C-ZUSCHAUER-TABELLE-OHNE-GRUPPEN: Ein Turnier ohne Gruppen („Jeder gegen jeden“) ist EINE Gruppe
 * (Record Turniermodi: Jeder gegen jeden = „eine Gruppe“). Die Zuordnung der Teams zu Tabellen gibt es an einer Stelle.
 * Nur die Zuordnung, nicht die Sortierung (die ändert das Paket „Tabelle nach BFV privat“).
 */
import { describe, it, expect } from 'vitest';
import { standingsGroups, OVERALL_GROUP } from '../standingsGroups';

const team = (id: string, group?: string) => ({ id, name: id, ...(group === undefined ? {} : { group }) });

describe('standingsGroups', () => {
  it('Jeder gegen jeden: Teams ohne Gruppe bilden eine Gruppe mit allen Teams', () => {
    const teams = [team('a'), team('b'), team('c')];

    expect(standingsGroups(teams)).toEqual([{ group: OVERALL_GROUP, teams }]);
  });

  it('Gegenbeispiel: zwei Gruppen bleiben zwei Gruppen, sortiert, mit ihren Teams', () => {
    const [b1, a1, a2, b2] = [team('b1', 'B'), team('a1', 'A'), team('a2', 'A'), team('b2', 'B')];

    expect(standingsGroups([b1, a1, a2, b2])).toEqual([
      { group: 'A', teams: [a1, a2] },
      { group: 'B', teams: [b1, b2] },
    ]);
  });

  it('eine leere Gruppen-Angabe zählt wie keine Gruppe', () => {
    const teams = [team('a', ''), team('b', '')];

    expect(standingsGroups(teams)).toEqual([{ group: OVERALL_GROUP, teams }]);
  });

  it('ohne Teams gibt es keine Gruppe (nichts anzuzeigen)', () => {
    expect(standingsGroups([])).toEqual([]);
  });
});
