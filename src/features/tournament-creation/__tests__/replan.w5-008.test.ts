import { describe, it, expect } from 'vitest';
import type { Match, Tournament } from '../../../types/tournament';
import { getReplanAvailability } from '../utils/replan';

const baseTournament = (matches: Match[]): Pick<Tournament, 'id' | 'matches' | 'status' | 'publishedAt'> => ({
  id: 't1',
  matches,
  status: 'published',
  publishedAt: '2026-10-04T08:00:00Z',
});

const match = (id: string, matchStatus: Match['matchStatus']): Match => ({
  id,
  round: 1,
  field: 1,
  teamA: 'a',
  teamB: 'b',
  matchStatus,
});

describe('Neuplanung – Anpfiff-Prüfung (getMatchStartState)', () => {
  it('@W5-008 – nach dem ersten Anpfiff wird keine Neuplanung angeboten', () => {
    const tournament = baseTournament([
      match('m1', 'scheduled'),
      match('m2', 'running'),
    ]);

    expect(getReplanAvailability(tournament)).toBe('refused-after-kickoff');
  });

  it('@W5-008 – Gegenbeispiel: ohne angepfiffenes Spiel wird Neuplanung angeboten', () => {
    const tournament = baseTournament([
      match('m1', 'scheduled'),
      match('m2', 'scheduled'),
    ]);

    expect(getReplanAvailability(tournament)).toBe('offered');
  });
});
