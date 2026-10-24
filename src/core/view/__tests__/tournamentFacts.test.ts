/** @W5-038 / C-ADMIN-DASHBOARD-ZAHLEN: Anzeige-Werte aus dem Turnier, gespeicherte Werte bleiben. */
import { describe, it, expect } from 'vitest';
import { effectiveGroupCount, effectiveFields, effectiveFieldCount } from '../tournamentFacts';

describe('effectiveGroupCount', () => {
  it('@W5-038 Jeder gegen jeden ist eine Gruppe, auch wenn numberOfGroups 2 trägt', () => {
    expect(effectiveGroupCount({ groupSystem: 'roundRobin', numberOfGroups: 2 })).toBe(1);
  });
  it('Gegenbeispiel: Gruppen + Finale mit 2 Gruppen bleibt 2', () => {
    expect(effectiveGroupCount({ groupSystem: 'groupsAndFinals', numberOfGroups: 2 })).toBe(2);
  });
});

describe('effectiveFields', () => {
  it('@W5-038 ohne Feldliste, Spiele auf Feld 1: Feld 1', () => {
    const result = effectiveFields({ matches: [{ field: 1 }, { field: 1 }], numberOfFields: 1 });
    expect(result.map((f) => f.defaultName)).toEqual(['Feld 1']);
    expect(effectiveFieldCount({ matches: [{ field: 1 }] })).toBe(1);
  });
  it('ohne Feldliste und ohne Spiele: numberOfFields Felder', () => {
    expect(effectiveFieldCount({ matches: [], numberOfFields: 2 })).toBe(2);
  });
  it('Gegenbeispiel: gespeicherte Feldliste hat Vorrang, Namen bleiben', () => {
    const result = effectiveFields({ fields: [{ id: 'field-1', defaultName: 'Feld 1', customName: 'Halle Nord' }], matches: [{ field: 2 }] });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ customName: 'Halle Nord', stored: true });
  });
});
