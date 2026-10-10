import { describe, it, expect } from 'vitest';
import type { Team } from '../../../types/tournament';
import { activeTeams } from '../utils/replanTeams';

const teams: Team[] = [
  { id: '1', name: 'A' },
  { id: '2', name: 'B', isRemoved: true, removedAt: '2026-10-10T10:00:00Z' },
  { id: '3', name: 'C' },
];

describe('Wizard-Teams – isRemoved-Filter', () => {
  it('B-02 – Zähler und Duplikatprüfung sehen nur aktive Teams (isRemoved bleibt außen vor)', () => {
    expect(activeTeams(teams).map((t) => t.id)).toEqual(['1', '3']);
  });
});
