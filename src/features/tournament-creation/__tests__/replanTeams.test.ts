import { describe, it, expect } from 'vitest';
import type { Match, Team } from '../../../types/tournament';
import { removeTeamKeepingHistory, activeTeams } from '../utils/replanTeams';
import { looseVs } from '../../../test/matchSlotFixtures';

const teams: Team[] = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B' },
  { id: '3', name: 'C' },
];

const matches: Match[] = [
  { id: 'm1', round: 1, field: 1, ...looseVs('1', '2'), scoreA: 2, scoreB: 0, matchStatus: 'finished' },
  { id: 'm2', round: 1, field: 2, ...looseVs('2', '3') },
];

describe('Wizard-Teams – isRemoved-Filter', () => {
  it('B-02 – Team mit Ergebnis-Spielen bleibt als isRemoved stehen, Zähler und Duplikatprüfung sehen nur aktive', () => {
    const updated = removeTeamKeepingHistory(teams, matches, '1');

    expect(updated.find((t) => t.id === '1')?.isRemoved).toBe(true);
    expect(activeTeams(updated).map((t) => t.id)).toEqual(['2', '3']);
  });

  it('B-02 – Gegenbeispiel: Team ohne Ergebnisse wird voll entfernt (kein isRemoved-Überrest)', () => {
    const updated = removeTeamKeepingHistory(teams, matches, '3');

    expect(updated.find((t) => t.id === '3')).toBeUndefined();
    expect(activeTeams(updated).map((t) => t.id)).toEqual(['1', '2']);
  });
});
