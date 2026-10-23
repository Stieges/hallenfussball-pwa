/**
 * Paket TB-B, Task TB-6d' (Assistent): welche Plätze der Assistent zur Auswahl anbietet, bevor Teams eingetragen sind –
 * @W2A-066 (Plätze 1 bis Teamzahl, Voreinstellung nur Platz 1) und @W2A-073 (nur vorhandene Plätze: bei weniger Teams weniger
 * Chips). Aus der Teamzahl und der Gruppenzahl der Einrichtung; mit Teams gilt `offeredPlaces` (größte Gruppe).
 */
import { describe, expect, it } from 'vitest';
import { offeredPlaces, offeredPlacesForSetup } from '../playOutPlaces';

describe('Angebotene Plätze im Assistenten (@W2A-066, @W2A-073)', () => {
  it('@W2A-066 Jeder gegen jeden mit 6 Teams: Platz 1 bis 6', () => {
    expect(offeredPlacesForSetup({ groupSystem: 'roundRobin', numberOfTeams: 6, numberOfGroups: 1 })).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('@W2A-073 bei weniger Teams weniger Plätze: 5 Teams bieten nur Platz 1 bis 5 an (Gegenbeispiel zu 6)', () => {
    expect(offeredPlacesForSetup({ groupSystem: 'roundRobin', numberOfTeams: 5, numberOfGroups: 1 })).toEqual([1, 2, 3, 4, 5]);
  });

  it('Gruppen mit Finalrunde: die größte Gruppe zählt (8 Teams in 2 Gruppen = 4, 9 Teams in 2 Gruppen = 5)', () => {
    expect(offeredPlacesForSetup({ groupSystem: 'groupsAndFinals', numberOfTeams: 8, numberOfGroups: 2 })).toEqual([1, 2, 3, 4]);
    expect(offeredPlacesForSetup({ groupSystem: 'groupsAndFinals', numberOfTeams: 9, numberOfGroups: 2 })).toEqual([1, 2, 3, 4, 5]);
  });

  it('ohne Angaben oder Unsinn: keine Plätze, kein Fehler', () => {
    expect(offeredPlacesForSetup({})).toEqual([]);
    expect(offeredPlacesForSetup({ groupSystem: 'groupsAndFinals', numberOfTeams: 8, numberOfGroups: 0 })).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(offeredPlacesForSetup({ groupSystem: 'roundRobin', numberOfTeams: -3 })).toEqual([]);
  });

  it('Gegenbeispiel: mit eingetragenen Teams gilt offeredPlaces (größte Gruppe), nicht die Zahl der Einrichtung', () => {
    expect(offeredPlaces([{ group: 'A' }, { group: 'A' }, { group: 'A' }, { group: 'B' }])).toEqual([1, 2, 3]);
  });
});
